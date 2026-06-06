import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName, SOFA_TO_DB_NAME } from '@/app/scripts/sofascore-ratings'

// ─── Types ────────────────────────────────────────────────────────────────────

type IncomingPlayer = {
  name:    string
  team:    string
  rating:  number | null
  goals:   number
  assists: number
  minutes: number
}

type IncomingMatch = {
  sofaId:  string | number
  home:    string
  away:    string
  status?: string
  players: IncomingPlayer[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function sofaNameVariants(sofaTeamName: string): string[] {
  const dbName = SOFA_TO_DB_NAME[sofaTeamName] ?? sofaTeamName
  return [sofaTeamName, dbName].map(normalizeName)
}

function matchTeams(
  sofaHome: string, sofaAway: string,
  dbA: string, dbB: string,
): boolean {
  const varA = sofaNameVariants(sofaHome)
  const varB = sofaNameVariants(sofaAway)
  const na   = normalizeName(dbA)
  const nb   = normalizeName(dbB)
  const hit  = (variants: string[], target: string) =>
    variants.some(v => v.includes(target) || target.includes(v))
  return (
    (hit(varA, na) && hit(varB, nb)) ||
    (hit(varB, na) && hit(varA, nb))
  )
}

// ─── CORS (requis pour file:// → localhost) ───────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

// ─── POST /api/admin/import-from-browser ──────────────────────────────────────

export async function POST(request: Request) {
  let body: { date?: string; matches?: IncomingMatch[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body JSON invalide' }, { status: 400, headers: CORS })
  }

  const { date, matches } = body
  if (!date || !Array.isArray(matches)) {
    return Response.json({ error: 'date et matches requis' }, { status: 400, headers: CORS })
  }

  const admin = createAdminClient()

  // ── Matchs DB terminés pour le matching ─────────────────────────────────────
  const { data: dbMatchesRaw } = await admin
    .from('cdm_matches')
    .select(`
      id,
      nation_a:cdm_nations!nation_a_id ( id, name ),
      nation_b:cdm_nations!nation_b_id ( id, name )
    `)
    .eq('status', 'termine')

  type DbMatch = { id: string; nation_a: { id: string; name: string }; nation_b: { id: string; name: string } }
  const dbMatches = (dbMatchesRaw ?? []) as unknown as DbMatch[]

  let totalMatched     = 0
  const allUnmatched:  string[] = []
  let matchesProcessed = 0

  // ── Traite chaque match reçu du navigateur ───────────────────────────────────
  for (const incoming of matches) {
    if (!incoming.home || !incoming.away || incoming.players.length === 0) continue

    // Trouve le match en DB par fuzzy matching des noms
    const dbMatch = dbMatches.find(m =>
      matchTeams(incoming.home, incoming.away, m.nation_a.name, m.nation_b.name)
    )

    if (!dbMatch) {
      allUnmatched.push(`[match non trouvé] ${incoming.home} vs ${incoming.away}`)
      continue
    }

    // Joueurs des deux nations
    const { data: dbPlayers } = await admin
      .from('cdm_players')
      .select('id, name, nation_id')
      .in('nation_id', [dbMatch.nation_a.id, dbMatch.nation_b.id])

    const allPlayers = (dbPlayers ?? []) as Array<{ id: string; name: string; nation_id: string }>

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

    for (const p of incoming.players) {
      if (!p.name) continue
      const playerId = findPlayer(p.name, allPlayers)
      if (playerId) {
        totalMatched++
        upsertRows.push({
          match_id:       dbMatch.id,
          player_id:      playerId,
          fotmob_rating:  p.rating,
          goals:          p.goals,
          assists:        p.assists,
          penalty_saved:  false,
          minutes_played: p.minutes > 0 ? p.minutes : null,
          source:         'sofascore',
        })
      } else {
        allUnmatched.push(`${p.name} [${p.team}]`)
      }
    }

    if (upsertRows.length > 0) {
      await admin
        .from('cdm_player_ratings')
        .upsert(upsertRows, { onConflict: 'player_id,match_id' })
    }

    matchesProcessed++
  }

  return Response.json(
    { matched: totalMatched, unmatched: allUnmatched, matchesProcessed },
    { headers: CORS }
  )
}
