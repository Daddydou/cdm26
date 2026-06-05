import { createAdminClient } from '@/lib/supabase/admin'
import {
  getESPNMatches,
  getESPNRatings,
  ESPN_TO_DB_NAME,
  normalizeName,
  type EspnPlayerRating,
} from '@/app/scripts/espn-ratings'

// Recherche le meilleur match de nom dans une liste de joueurs
function findPlayer(
  espnName: string,
  players: Array<{ id: string; name: string }>
): string | null {
  const norm = normalizeName(espnName)

  // 1. Correspondance exacte normalisée
  const exact = players.find(p => normalizeName(p.name) === norm)
  if (exact) return exact.id

  // 2. Correspondance sur le nom de famille (dernier mot)
  const lastName = norm.split(' ').at(-1) ?? ''
  if (lastName.length >= 3) {
    const byLast = players.filter(p => {
      const pNorm = normalizeName(p.name)
      return pNorm.split(' ').at(-1) === lastName
    })
    if (byLast.length === 1) return byLast[0].id
  }

  // 3. Correspondance partielle : un nom contient l'autre
  const partial = players.find(p => {
    const pNorm = normalizeName(p.name)
    return pNorm.includes(norm) || norm.includes(pNorm)
  })
  if (partial) return partial.id

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('match_id')
  if (!matchId) return Response.json({ error: 'match_id requis' }, { status: 400 })

  const admin = createAdminClient()

  // ── 1. Récupère le match Supabase ─────────────────────────────────────────
  const { data: match, error: matchErr } = await admin
    .from('cdm_matches')
    .select(`
      id, kickoff_at, status,
      nation_a:cdm_nations!nation_a_id ( id, name ),
      nation_b:cdm_nations!nation_b_id ( id, name )
    `)
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    return Response.json({ error: 'Match introuvable' }, { status: 404 })
  }

  const nationA = match.nation_a as unknown as { id: string; name: string }
  const nationB = match.nation_b as unknown as { id: string; name: string }
  const kickoff  = new Date(match.kickoff_at)

  // ── 2. Date YYYYMMDD ──────────────────────────────────────────────────────
  const date = kickoff.toISOString().slice(0, 10).replace(/-/g, '')

  // ── 3. Trouve le match ESPN correspondant ─────────────────────────────────
  let espnMatches: Awaited<ReturnType<typeof getESPNMatches>>
  try {
    espnMatches = await getESPNMatches(date)
  } catch (err) {
    return Response.json({ error: `ESPN scoreboard: ${String(err)}` }, { status: 502 })
  }

  // Normalise les noms DB pour la comparaison (FR → EN via inverse lookup)
  function dbToEspn(dbName: string): string[] {
    const direct = Object.entries(ESPN_TO_DB_NAME)
      .filter(([, v]) => v === dbName)
      .map(([k]) => k)
    return [dbName, ...direct]
  }

  const namesA = dbToEspn(nationA.name).map(normalizeName)
  const namesB = dbToEspn(nationB.name).map(normalizeName)

  const espnMatch = espnMatches.find(m => {
    const h = normalizeName(m.home_team)
    const a = normalizeName(m.away_team)
    return (
      (namesA.some(n => h.includes(n) || n.includes(h)) && namesB.some(n => a.includes(n) || n.includes(a))) ||
      (namesB.some(n => h.includes(n) || n.includes(h)) && namesA.some(n => a.includes(n) || n.includes(a)))
    )
  })

  if (!espnMatch) {
    return Response.json({
      error:        'Match ESPN introuvable',
      date,
      searched:     { teamA: nationA.name, teamB: nationB.name },
      espnMatches:  espnMatches.map(m => `${m.home_team} vs ${m.away_team}`),
    }, { status: 404 })
  }

  // ── 4. Récupère les notes ESPN ────────────────────────────────────────────
  let espnRatings: EspnPlayerRating[]
  try {
    espnRatings = await getESPNRatings(espnMatch.espn_id)
  } catch (err) {
    return Response.json({
      error:      `ESPN summary: ${String(err)}`,
      espn_id:    espnMatch.espn_id,
    }, { status: 502 })
  }

  if (espnRatings.length === 0) {
    return Response.json({
      error:     'Aucune note ESPN disponible (match pas encore terminé ?)',
      espn_id:   espnMatch.espn_id,
      completed: espnMatch.completed,
    }, { status: 404 })
  }

  // ── 5. Récupère les joueurs des deux nations ──────────────────────────────
  const { data: players } = await admin
    .from('cdm_players')
    .select('id, name, nation_id')
    .in('nation_id', [nationA.id, nationB.id])

  const allPlayers = players ?? []

  // ── 6. Mappe ESPN players → cdm_players et upsert ─────────────────────────
  const matched:   Array<{ espn_name: string; player_id: string; rating: number | null }> = []
  const unmatched: Array<{ espn_name: string; team: string }> = []

  const upsertRows: Array<{
    match_id:       string
    player_id:      string
    fotmob_rating:  number | null
    goals:          number
    assists:        number
    penalty_saved:  boolean
    minutes_played: number | null
    source:         string
  }> = []

  for (const ep of espnRatings) {
    const playerId = findPlayer(ep.player_name, allPlayers)
    if (playerId) {
      matched.push({ espn_name: ep.player_name, player_id: playerId, rating: ep.rating })
      upsertRows.push({
        match_id:       matchId,
        player_id:      playerId,
        fotmob_rating:  ep.rating,
        goals:          ep.goals,
        assists:        ep.assists,
        penalty_saved:  ep.penalty_saves > 0,
        minutes_played: ep.minutes_played,
        source:         'espn',
      })
    } else {
      unmatched.push({ espn_name: ep.player_name, team: ep.team_name })
    }
  }

  let upsertError: string | null = null
  if (upsertRows.length > 0) {
    const { error } = await admin
      .from('cdm_player_ratings')
      .upsert(upsertRows, { onConflict: 'player_id,match_id' })
    if (error) upsertError = error.message
  }

  return Response.json({
    espn_id:    espnMatch.espn_id,
    espn_match: `${espnMatch.home_team} vs ${espnMatch.away_team}`,
    matched:    matched.length,
    unmatched,
    upsert_error: upsertError,
    ratings:    matched,
  })
}
