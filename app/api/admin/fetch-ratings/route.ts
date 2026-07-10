import { createAdminClient } from '@/lib/supabase/admin'
import {
  getSofaScoreMatches,
  getSofaScoreRatings,
  SOFA_TO_DB_NAME,
  normalizeName,
  type SofaPlayerRating,
} from '@/app/scripts/sofascore-ratings'

// Empêche l'évaluation/collecte statique au build — le client Supabase lit les env vars au runtime
export const dynamic = 'force-dynamic'

// ─── Matching nom joueur ───────────────────────────────────────────────────────

function findPlayer(
  sofaName: string,
  players: Array<{ id: string; name: string }>
): string | null {
  const norm = normalizeName(sofaName)

  // 1. Exacte
  const exact = players.find(p => normalizeName(p.name) === norm)
  if (exact) return exact.id

  // 2. Nom de famille uniquement (dernier mot)
  const lastName = norm.split(' ').at(-1) ?? ''
  if (lastName.length >= 3) {
    const byLast = players.filter(p => normalizeName(p.name).split(' ').at(-1) === lastName)
    if (byLast.length === 1) return byLast[0].id
  }

  // 3. Partiel : un nom contient l'autre
  const partial = players.find(p => {
    const pNorm = normalizeName(p.name)
    return pNorm.includes(norm) || norm.includes(pNorm)
  })
  return partial?.id ?? null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('match_id')
  if (!matchId) return Response.json({ error: 'match_id requis' }, { status: 400 })

  const admin = createAdminClient()

  // ── 1. Match Supabase ─────────────────────────────────────────────────────
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

  const nationA  = match.nation_a as unknown as { id: string; name: string }
  const nationB  = match.nation_b as unknown as { id: string; name: string }
  const kickoff  = new Date(match.kickoff_at)

  // ── 2. Date YYYY-MM-DD pour SofaScore ────────────────────────────────────
  const date = kickoff.toISOString().slice(0, 10)

  // ── 3. Matchs SofaScore du jour ──────────────────────────────────────────
  let sofaMatches: Awaited<ReturnType<typeof getSofaScoreMatches>>
  try {
    sofaMatches = await getSofaScoreMatches(date)
  } catch (err) {
    return Response.json({ error: `SofaScore scoreboard: ${String(err)}` }, { status: 502 })
  }

  // Lookup inverse : nom DB → noms SofaScore possibles
  function dbToSofa(dbName: string): string[] {
    const mapped = Object.entries(SOFA_TO_DB_NAME)
      .filter(([, v]) => v === dbName)
      .map(([k]) => k)
    return [dbName, ...mapped]
  }

  const namesA = dbToSofa(nationA.name).map(normalizeName)
  const namesB = dbToSofa(nationB.name).map(normalizeName)

  const sofaMatch = sofaMatches.find(m => {
    const h = normalizeName(m.home_team)
    const a = normalizeName(m.away_team)
    return (
      (namesA.some(n => h.includes(n) || n.includes(h)) && namesB.some(n => a.includes(n) || n.includes(a))) ||
      (namesB.some(n => h.includes(n) || n.includes(h)) && namesA.some(n => a.includes(n) || n.includes(a)))
    )
  })

  if (!sofaMatch) {
    return Response.json({
      error:       'Match SofaScore introuvable',
      date,
      searched:    { teamA: nationA.name, teamB: nationB.name },
      sofaMatches: sofaMatches.map(m => `${m.home_team} vs ${m.away_team} [${m.tournament}]`),
    }, { status: 404 })
  }

  // ── 4. Notes SofaScore ───────────────────────────────────────────────────
  let sofaRatings: SofaPlayerRating[]
  try {
    sofaRatings = await getSofaScoreRatings(sofaMatch.event_id)
  } catch (err) {
    return Response.json({
      error:    `SofaScore summary: ${String(err)}`,
      event_id: sofaMatch.event_id,
    }, { status: 502 })
  }

  if (sofaRatings.length === 0) {
    return Response.json({
      error:     'Aucune note SofaScore disponible (match pas encore terminé ?)',
      event_id:  sofaMatch.event_id,
      status:    sofaMatch.status,
    }, { status: 404 })
  }

  // ── 5. Joueurs des deux nations ──────────────────────────────────────────
  const { data: players } = await admin
    .from('cdm_players')
    .select('id, name, nation_id')
    .in('nation_id', [nationA.id, nationB.id])

  const allPlayers = players ?? []

  // ── 6. Matching + upsert ─────────────────────────────────────────────────
  const matched:   Array<{ sofa_name: string; player_id: string; rating: number | null }> = []
  const unmatched: Array<{ sofa_name: string; team: string }> = []

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

  for (const sr of sofaRatings) {
    const playerId = findPlayer(sr.player_name, allPlayers)
    if (playerId) {
      matched.push({ sofa_name: sr.player_name, player_id: playerId, rating: sr.rating })
      upsertRows.push({
        match_id:       matchId,
        player_id:      playerId,
        fotmob_rating:  sr.rating,
        goals:          sr.goals,
        assists:        sr.assists,
        penalty_saved:  sr.penalty_saves > 0,
        minutes_played: sr.minutes_played,
        source:         'sofascore',
      })
    } else {
      unmatched.push({ sofa_name: sr.player_name, team: sr.team_name })
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
    event_id:     sofaMatch.event_id,
    sofa_match:   `${sofaMatch.home_team} vs ${sofaMatch.away_team}`,
    matched:      matched.length,
    unmatched,
    upsert_error: upsertError,
    ratings:      matched,
  })
}
