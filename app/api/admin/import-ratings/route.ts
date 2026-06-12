import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName } from '@/app/scripts/sofascore-ratings'
import { fetch as undiciFetch } from 'undici'
import { computeMatchPoints } from '@/app/actions/admin'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

const SOFA_HEADERS = {
  'User-Agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':             'application/json',
  'Accept-Language':    'fr-FR,fr;q=0.9',
  'Referer':            'https://www.sofascore.com/',
  'Origin':             'https://www.sofascore.com',
  'sec-ch-ua':          '"Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile':   '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest':     'empty',
  'sec-fetch-mode':     'cors',
  'sec-fetch-site':     'same-site',
}

const CDM_TOURNAMENT_ID = 16

const TEAM_MAP: Record<string, string> = {
  'Czech Republic': 'Rép. Tchèque', 'Tchéquie': 'Rép. Tchèque', 'République Tchèque': 'Rép. Tchèque',
  'Ivory Coast': "Côte d'Ivoire", 'Bosnie-Herzégovine': 'Bosnie-Herzégovine',
  'DR Congo': 'RD Congo', 'South Korea': 'Corée du Sud',
  'United States': 'Etats-Unis', USA: 'Etats-Unis',
  'Saudi Arabia': 'Arabie Saoudite', 'New Zealand': 'Nouvelle-Zélande',
}

function mapTeam(name: string): string {
  return TEAM_MAP[name] ?? name
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sofaFetch(url: string) {
  const res  = await undiciFetch(url, { headers: SOFA_HEADERS })
  const json = res.ok ? await res.json() as Record<string, unknown> : {}
  return { ok: res.ok, status: res.status, json }
}

// normalizeName + tirets → espaces ("Kim Seung-Gyu" → "kim seung gyu")
function normalize(name: string): string {
  return normalizeName(name).replace(/-/g, ' ')
}

function findPlayer(
  name: string,
  players: Array<{ id: string; name: string }>
): string | null {
  const norm = normalize(name)
  const exact = players.find(p => normalize(p.name) === norm)
  if (exact) return exact.id
  const last = norm.split(' ').at(-1) ?? ''
  if (last.length >= 3) {
    const byLast = players.filter(p => normalize(p.name).split(' ').at(-1) === last)
    if (byLast.length === 1) return byLast[0].id
  }
  // Level 3 : initiale prénom ("Gutierrez B." → "Brian Gutiérrez")
  const normParts = norm.split(/\s+/)
  let initial: string | null = null
  let lnPart:  string | null = null
  for (const part of normParts) {
    const s = part.replace('.', '')
    if (s.length === 1) initial = s
    else if (!lnPart)   lnPart  = s
  }
  if (initial && lnPart) {
    const byInitial = players.filter(p => {
      const pn    = normalize(p.name)
      const parts = pn.split(/\s+/)
      return pn.includes(lnPart!) && parts.some(w => w.startsWith(initial!))
    })
    if (byInitial.length >= 1) return byInitial[0].id
  }

  return players.find(p => {
    const pn = normalize(p.name)
    return pn.includes(norm) || norm.includes(pn)
  })?.id ?? null
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerInput = {
  name: string; team: string; rating: number | null
  goals: number; assists: number; minutes: number | null
}
type MatchInput = { sofaId: number; home: string; away: string; players: PlayerInput[] }
type DbMatch    = { id: string; nation_a: { id: string; name: string }; nation_b: { id: string; name: string } }

// ─── POST /api/admin/import-ratings ──────────────────────────────────────────

export async function POST(request: Request) {
  let date: string
  let bodyMatches: MatchInput[] | null = null

  try {
    const raw  = await request.text()
    const body = JSON.parse(raw)
    const expectedKey = process.env.ADMIN_SECRET ?? 'CDM2026admin'
    if (body.adminKey !== expectedKey) {
      return Response.json({ error: 'Clé admin invalide' }, { status: 401, headers: CORS })
    }
    date = body.date
    if (Array.isArray(body.matches) && body.matches.length > 0) {
      bodyMatches = body.matches as MatchInput[]
    }
  } catch {
    return Response.json({ error: 'Body JSON invalide' }, { status: 400, headers: CORS })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'date invalide — format YYYY-MM-DD requis' }, { status: 400, headers: CORS })
  }

  const admin = createAdminClient()

  const { data: dbMatchesRaw } = await admin
    .from('cdm_matches')
    .select('id, nation_a:cdm_nations!nation_a_id(id, name), nation_b:cdm_nations!nation_b_id(id, name)')
    .eq('status', 'termine')

  const dbMatches = (dbMatchesRaw ?? []) as unknown as DbMatch[]

  let totalMatched     = 0
  const allUnmatched:   string[] = []
  let matchesProcessed = 0

  function findDbMatch(home: string, away: string): DbMatch | undefined {
    const nh = normalize(mapTeam(home))
    const na = normalize(mapTeam(away))
    return dbMatches.find(m => {
      const mna = normalize(m.nation_a?.name ?? '')
      const mnb = normalize(m.nation_b?.name ?? '')
      // Essaie home=nation_a/away=nation_b ET l'ordre inversé
      return (
        (nh.includes(mna) || mna.includes(nh)) && (na.includes(mnb) || mnb.includes(na))
      ) || (
        (na.includes(mna) || mna.includes(na)) && (nh.includes(mnb) || mnb.includes(nh))
      )
    })
  }

  async function upsertPlayers(dbMatch: DbMatch, players: PlayerInput[], source: string) {
    const { data: dbPlayers } = await admin
      .from('cdm_players')
      .select('id, name, nation_id')
      .in('nation_id', [dbMatch.nation_a?.id, dbMatch.nation_b?.id].filter(Boolean))

    const dbPl = (dbPlayers ?? []) as Array<{ id: string; name: string; nation_id: string }>

    const upsertRows: Array<{
      match_id: string; player_id: string; fotmob_rating: number | null
      goals: number; assists: number; penalty_saved: boolean
      minutes_played: number | null; source: string
    }> = []

    for (const p of players) {
      const playerId = findPlayer(p.name, dbPl)
      if (playerId) {
        totalMatched++
        upsertRows.push({
          match_id:       dbMatch.id,
          player_id:      playerId,
          fotmob_rating:  p.rating,
          goals:          p.goals,
          assists:        p.assists,
          penalty_saved:  false,
          minutes_played: p.minutes,
          source,
        })
      } else {
        allUnmatched.push(`${p.name} [${p.team}]`)
      }
    }

    let upserted = false
    if (upsertRows.length > 0) {
      const seen = new Set<string>()
      const deduped = upsertRows.filter(r => {
        if (seen.has(r.player_id)) return false
        seen.add(r.player_id)
        return true
      })
      const { error: upsertErr } = await admin
        .from('cdm_player_ratings')
        .upsert(deduped, { onConflict: 'player_id,match_id' })
      if (!upsertErr) upserted = true
    }
    matchesProcessed++
    return upserted
  }

  // ── Chemin 1 : données du bookmarklet ────────────────────────────────────────
  if (bodyMatches) {
    let calculated = false
    for (const m of bodyMatches) {
      const dbMatch = findDbMatch(m.home, m.away)
      if (!dbMatch) {
        allUnmatched.push(`Match non trouvé : ${m.home} vs ${m.away}`)
        continue
      }
      const upserted = await upsertPlayers(dbMatch, m.players, 'flashscore')
      if (upserted) {
        const calc = await computeMatchPoints(dbMatch.id)
        if (!calc.error) calculated = true
        console.log('[import-ratings] calcul scores match', dbMatch.id, '→', calc.computed.length, 'picks, erreur:', calc.error)
      }
    }
    return Response.json({ matched: totalMatched, unmatched: allUnmatched, matches_processed: matchesProcessed, calculated }, { headers: CORS })
  }

  // ── Chemin 2 : fallback SofaScore ────────────────────────────────────────────
  const eventsRes = await sofaFetch(
    `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`
  )

  if (!eventsRes.ok) {
    if (eventsRes.status === 403 || eventsRes.status === 429) {
      return Response.json({
        error_type:        'sofascore_blocked',
        matched:           0,
        unmatched:         [],
        matches_processed: 0,
        message:           'SofaScore bloque les requêtes depuis les serveurs Vercel (Cloudflare TLS fingerprinting).',
      }, { headers: CORS })
    }
    return Response.json({ error: `SofaScore HTTP ${eventsRes.status}` }, { status: 502, headers: CORS })
  }

  const events = (eventsRes.json.events ?? []) as Record<string, unknown>[]

  const cdmFinished = events.filter(e => {
    const ut     = (e.tournament as Record<string, unknown>)?.uniqueTournament as Record<string, unknown>
    const status = e.status as Record<string, unknown>
    return Number(ut?.id) === CDM_TOURNAMENT_ID && status?.type === 'finished'
  })

  if (cdmFinished.length === 0) {
    const tournois = [...new Set(events.map(e => {
      const t  = e.tournament as Record<string, unknown>
      const ut = t?.uniqueTournament as Record<string, unknown>
      return `${ut?.name ?? t?.name ?? '?'} (id=${ut?.id ?? '?'})`
    }))].slice(0, 6)
    return Response.json({
      matched:           0,
      unmatched:         [],
      matches_processed: 0,
      message:           `Aucun match CdM terminé le ${date} (${events.length} matchs football). Tournois : ${tournois.join(', ')}`,
    }, { headers: CORS })
  }

  for (const event of cdmFinished) {
    const eventId  = String(event.id)
    const homeTeam = (event.homeTeam as Record<string, unknown>)?.name as string ?? '?'
    const awayTeam = (event.awayTeam as Record<string, unknown>)?.name as string ?? '?'

    const dbMatch = findDbMatch(homeTeam, awayTeam)
    if (!dbMatch) continue

    const lineupsRes = await sofaFetch(
      `https://api.sofascore.com/api/v1/event/${eventId}/lineups`
    )
    if (!lineupsRes.ok) continue

    const sofaPlayers: PlayerInput[] = []

    for (const side of ['home', 'away'] as const) {
      const sideData = lineupsRes.json[side] as Record<string, unknown>
      const teamName = (sideData?.team as Record<string, unknown>)?.name as string ?? side
      const sPlayers = (sideData?.players ?? []) as Record<string, unknown>[]

      for (const p of sPlayers) {
        const player = p.player as Record<string, unknown>
        const pName  = player?.name as string ?? ''
        if (!pName) continue
        const stats  = (p.statistics ?? {}) as Record<string, unknown>
        sofaPlayers.push({
          name:    pName,
          team:    teamName,
          rating:  typeof stats.rating === 'number' ? stats.rating : null,
          goals:   Number(stats.goals       ?? 0),
          assists: Number(stats.goalAssist   ?? stats.assists ?? 0),
          minutes: stats.minutesPlayed != null ? Number(stats.minutesPlayed) : null,
        })
      }
    }

    if (sofaPlayers.length === 0) continue
    const upserted = await upsertPlayers(dbMatch, sofaPlayers, 'sofascore')
    if (upserted) {
      const calc = await computeMatchPoints(dbMatch.id)
      console.log('[import-ratings] calcul scores match', dbMatch.id, '→', calc.computed.length, 'picks, erreur:', calc.error)
    }
  }

  const calculated = matchesProcessed > 0
  return Response.json({ matched: totalMatched, unmatched: allUnmatched, matches_processed: matchesProcessed, calculated }, { headers: CORS })
}
