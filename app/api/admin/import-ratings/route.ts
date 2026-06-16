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
  'États-Unis': 'États-Unis', 'Etats-Unis': 'États-Unis',
  'United States': 'États-Unis', USA: 'États-Unis',
  'Saudi Arabia': 'Arabie Saoudite', 'New Zealand': 'Nouvelle-Zélande',
}

function mapTeam(name: string): string {
  return TEAM_MAP[name] ?? name
}

// team → { display name → canonical DB name }
const PLAYER_ALIASES: Record<string, Record<string, string>> = {
  'Brésil': { 'Gabriel': 'Gabriel Magalhães' },
}

function resolveAlias(name: string, team: string): string {
  const canonical = mapTeam(team)
  return PLAYER_ALIASES[canonical]?.[name] ?? name
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sofaFetch(url: string) {
  const res  = await undiciFetch(url, { headers: SOFA_HEADERS })
  const json = res.ok ? await res.json() as Record<string, unknown> : {}
  return { ok: res.ok, status: res.status, json }
}

// normalizeName + tirets → espaces ("Kim Seung-Gyu" → "kim seung gyu")
// Utilisé uniquement par findPlayer — ne pas modifier.
function normalize(name: string): string {
  return normalizeName(name).replace(/-/g, ' ')
}

// Normalisation pour noms d'équipes : ̀-ͯ explicites (évite le bug
// d'encodage des caractères literaux dans normalizeName), non-alphanum → espace.
function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

  // Precharge toutes les nations pour résolution home/away → nation_id en JS
  const { data: nationsRaw } = await admin.from('cdm_nations').select('id, name')
  const allNations = (nationsRaw ?? []) as Array<{ id: string; name: string }>

  let totalMatched     = 0
  const allUnmatched:  string[] = []
  let matchesProcessed = 0

  type DbMatchFull = DbMatch & { kickoff_at: string | null }

  // Résout home + away → nation_ids, cherche le(s) match(s) dans les deux sens,
  // gère les doublons en choisissant le match avec le plus de picks.
  async function resolveMatch(home: string, away: string): Promise<DbMatch | null> {
    const normHome = normalizeTeam(mapTeam(home))
    const normAway = normalizeTeam(mapTeam(away))

    const natHome = allNations.find(n => normalizeTeam(n.name) === normHome)
    const natAway = allNations.find(n => normalizeTeam(n.name) === normAway)

    if (!natHome) {
      const msg = `Nation introuvable : "${home}" (normalisé : "${normHome}")`
      allUnmatched.push(msg)
      console.warn('[import-ratings]', msg)
      return null
    }
    if (!natAway) {
      const msg = `Nation introuvable : "${away}" (normalisé : "${normAway}")`
      allUnmatched.push(msg)
      console.warn('[import-ratings]', msg)
      return null
    }

    const SEL = 'id, kickoff_at, nation_a:cdm_nations!nation_a_id(id, name), nation_b:cdm_nations!nation_b_id(id, name)'
    const [r1, r2] = await Promise.all([
      admin.from('cdm_matches').select(SEL).eq('nation_a_id', natHome.id).eq('nation_b_id', natAway.id),
      admin.from('cdm_matches').select(SEL).eq('nation_a_id', natAway.id).eq('nation_b_id', natHome.id),
    ])
    const candidates = [...(r1.data ?? []), ...(r2.data ?? [])] as unknown as DbMatchFull[]

    if (candidates.length === 0) {
      const msg = `Match non trouvé : "${home}" vs "${away}"`
      allUnmatched.push(msg)
      console.warn(`[import-ratings] ${msg} — nations ${natHome.id} vs ${natAway.id}`)
      return null
    }
    if (candidates.length === 1) return candidates[0]

    // Doublons : choisit le match avec le plus de picks ; en cas d'égalité, le
    // plus proche de la date envoyée.
    const withCounts = await Promise.all(
      candidates.map(async c => {
        const { count } = await admin
          .from('cdm_picks')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', c.id)
        return { match: c, picks: count ?? 0 }
      })
    )
    withCounts.sort((a, b) => {
      if (b.picks !== a.picks) return b.picks - a.picks
      const distA = Math.abs(new Date(a.match.kickoff_at ?? date).getTime() - new Date(date).getTime())
      const distB = Math.abs(new Date(b.match.kickoff_at ?? date).getTime() - new Date(date).getTime())
      return distA - distB
    })
    const [chosen, ...rest] = withCounts
    console.warn(
      `[import-ratings] ${candidates.length} candidats "${normHome}" vs "${normAway}" — ` +
      `choisi ${chosen.match.id} (${chosen.picks} picks), ` +
      `ignorés : ${rest.map(x => `${x.match.id} (${x.picks} picks)`).join(', ')}`
    )
    return chosen.match
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
      const resolvedName = resolveAlias(p.name, p.team)
      const playerId = findPlayer(resolvedName, dbPl)
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
      if (!upsertErr) {
        upserted = true
        // Si les deux nations ont au moins un joueur noté → match terminé
        const nationAIds = dbPl.filter(p => p.nation_id === dbMatch.nation_a?.id).map(p => p.id)
        const nationBIds = dbPl.filter(p => p.nation_id === dbMatch.nation_b?.id).map(p => p.id)
        if (nationAIds.length > 0 && nationBIds.length > 0) {
          const [{ count: cA }, { count: cB }] = await Promise.all([
            admin.from('cdm_player_ratings').select('player_id', { count: 'exact', head: true })
              .eq('match_id', dbMatch.id).in('player_id', nationAIds),
            admin.from('cdm_player_ratings').select('player_id', { count: 'exact', head: true })
              .eq('match_id', dbMatch.id).in('player_id', nationBIds),
          ])
          if ((cA ?? 0) > 0 && (cB ?? 0) > 0) {
            await admin.from('cdm_matches').update({ status: 'termine' })
              .eq('id', dbMatch.id).neq('status', 'termine')
            console.log('[import-ratings] Match terminé automatiquement:', dbMatch.id)
          }
        }
      }
    }
    matchesProcessed++
    return upserted
  }

  // ── Chemin 1 : données du bookmarklet ────────────────────────────────────────
  if (bodyMatches) {
    let calculated = false
    for (const m of bodyMatches) {
      let dbMatch: DbMatch | undefined

      // Résolution par sofaId si fourni (nécessite colonne sofa_id dans cdm_matches)
      if (m.sofaId > 0) {
        const { data } = await admin
          .from('cdm_matches')
          .select('id, nation_a:cdm_nations!nation_a_id(id, name), nation_b:cdm_nations!nation_b_id(id, name)')
          .eq('sofa_id', m.sofaId)
          .maybeSingle()
        if (data) dbMatch = data as unknown as DbMatch
      }

      // Fallback : résolution par home + away → nation_ids
      if (!dbMatch) dbMatch = await resolveMatch(m.home, m.away) ?? undefined

      if (!dbMatch) continue
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

    const dbMatch = await resolveMatch(homeTeam, awayTeam)
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
