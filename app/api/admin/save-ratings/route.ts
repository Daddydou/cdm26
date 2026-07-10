import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName } from '@/app/scripts/sofascore-ratings'

// Empêche l'évaluation/collecte statique au build — le client Supabase lit les env vars au runtime
export const dynamic = 'force-dynamic'

type PlayerRating = {
  playerName:   string
  teamName:     string
  rating:       number | null
  goals:        number
  assists:      number
  minutesPlayed: number | null
}

function findPlayer(
  name: string,
  players: Array<{ id: string; name: string }>
): string | null {
  const norm = normalizeName(name)
  const exact = players.find(p => normalizeName(p.name) === norm)
  if (exact) return exact.id
  const last = norm.split(' ').at(-1) ?? ''
  if (last.length >= 3) {
    const byLast = players.filter(p => normalizeName(p.name).split(' ').at(-1) === last)
    if (byLast.length === 1) return byLast[0].id
  }
  return players.find(p => {
    const pn = normalizeName(p.name)
    return pn.includes(norm) || norm.includes(pn)
  })?.id ?? null
}

// ─── POST /api/admin/save-ratings ─────────────────────────────────────────────

export async function POST(request: Request) {
  let matchId: string
  let ratings: PlayerRating[]

  try {
    const body = await request.json()
    matchId = body.matchId
    ratings = body.ratings
  } catch {
    return Response.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!matchId || !Array.isArray(ratings)) {
    return Response.json({ error: 'matchId et ratings requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Match + nations ──────────────────────────────────────────────────────
  const { data: match, error: matchErr } = await admin
    .from('cdm_matches')
    .select(`
      id,
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

  // ── 2. Joueurs des deux nations ─────────────────────────────────────────────
  const { data: players } = await admin
    .from('cdm_players')
    .select('id, name, nation_id')
    .in('nation_id', [nationA.id, nationB.id])

  const allPlayers = (players ?? []) as Array<{ id: string; name: string; nation_id: string }>

  // ── 3. Matching + build upsert ──────────────────────────────────────────────
  const matched:    string[] = []
  const unmatched:  string[] = []
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

  for (const r of ratings) {
    const playerId = findPlayer(r.playerName, allPlayers)
    if (playerId) {
      matched.push(r.playerName)
      upsertRows.push({
        match_id:       matchId,
        player_id:      playerId,
        fotmob_rating:  r.rating,
        goals:          r.goals,
        assists:        r.assists,
        penalty_saved:  false,
        minutes_played: r.minutesPlayed ?? null,
        source:         'sofascore',
      })
    } else {
      unmatched.push(`${r.playerName} [${r.teamName}]`)
    }
  }

  // ── 4. Upsert ───────────────────────────────────────────────────────────────
  if (upsertRows.length > 0) {
    const { error: upsertErr } = await admin
      .from('cdm_player_ratings')
      .upsert(upsertRows, { onConflict: 'player_id,match_id' })

    if (upsertErr) {
      return Response.json({ error: upsertErr.message }, { status: 500 })
    }
  }

  return Response.json({ matched: matched.length, unmatched })
}
