/**
 * Récupération des notes joueurs CdM 2026 via l'API publique ESPN.
 *
 * SOFASCORE — BLOQUÉ : toutes les requêtes server-side renvoient 403 Forbidden.
 * Sofascore utilise Cloudflare avec TLS fingerprinting pour bloquer Node.js fetch.
 * Contournements possibles mais hors scope : Puppeteer, proxy résidentiel.
 *
 * ESPN — FONCTIONNE : API publique non-officielle, pas d'auth requise.
 * Endpoint : https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world
 *   scoreboard?dates=YYYYMMDD  → liste des matchs
 *   summary?event={id}         → détails + rosters + stats joueurs
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }

type EspnPlayer = {
  athlete: { id: string; displayName: string; shortName?: string }
  position?: { abbreviation: string }
  starter?: boolean
  statistics?: Array<{ name: string; displayValue: string }>
  rating?: number
}

type EspnRoster = {
  homeAway: 'home' | 'away'
  team: { id: string; displayName: string; abbreviation: string }
  roster?: EspnPlayer[]
}

async function espnGet(path: string) {
  const url = `${ESPN_BASE}${path}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`ESPN ${res.status} on ${path}`)
  return res.json()
}

async function findFinishedMatch(): Promise<{ id: string; name: string } | null> {
  // Cherche dans les 7 prochains jours de matchs
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '')
    const data = await espnGet(`/scoreboard?dates=${dateStr}`)
    const events: Array<{ id: string; name: string; status: { type: { completed: boolean; name: string } } }> = data.events ?? []
    const finished = events.filter(e => e.status?.type?.completed)
    if (finished.length > 0) return finished[0]
  }
  return null
}

function extractPlayers(roster: EspnRoster | undefined) {
  if (!roster?.roster) return []
  return roster.roster.map(p => ({
    espnId: p.athlete?.id,
    name: p.athlete?.displayName,
    position: p.position?.abbreviation ?? null,
    starter: p.starter ?? null,
    rating: p.rating ?? null,
    stats: Object.fromEntries(
      (p.statistics ?? []).map(s => [s.name, s.displayValue])
    ),
  }))
}

export async function testSofascore() {
  // ── Calendrier WC 2026 (prochains matchs) ────────────────────────────────────
  let scheduleData: Record<string, unknown>
  try {
    scheduleData = await espnGet('/scoreboard')
  } catch (err) {
    return { step: 'fetch_schedule', error: String(err) }
  }

  const upcomingEvents = (scheduleData.events as Array<{
    id: string; name: string; status: { type: { name: string; completed: boolean } }
    competitions: Array<{ competitors: Array<{ homeAway: string; team: { displayName: string; abbreviation: string }; score?: string }> }>
  }>) ?? []

  const schedule = upcomingEvents.map(e => ({
    id: e.id,
    name: e.name,
    status: e.status?.type?.name,
    home: e.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName,
    away: e.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName,
  }))

  // ── Cherche un match terminé pour tester les ratings ─────────────────────────
  let finishedMatch: { id: string; name: string } | null = null
  try {
    finishedMatch = await findFinishedMatch()
  } catch { /* pas encore de matchs terminés */ }

  if (!finishedMatch) {
    return {
      provider: 'ESPN',
      note: 'CdM 2026 pas encore commencée — aucun match terminé disponible. Les ratings apparaîtront dans summary.rosters[].roster[].rating après chaque match.',
      nextMatches: schedule.slice(0, 6),
      espnEndpoints: {
        schedule: `${ESPN_BASE}/scoreboard?dates=YYYYMMDD`,
        matchDetail: `${ESPN_BASE}/summary?event={eventId}`,
        expectedRatingPath: 'summary.rosters[].roster[].rating',
      },
    }
  }

  // ── Détails du match terminé ──────────────────────────────────────────────────
  let summary: Record<string, unknown>
  try {
    summary = await espnGet(`/summary?event=${finishedMatch.id}`)
  } catch (err) {
    return { step: 'fetch_summary', match: finishedMatch, error: String(err) }
  }

  const rosters = summary.rosters as EspnRoster[] | undefined
  const header = summary.header as Record<string, unknown> | undefined
  const headerComp = (header?.competitions as Array<Record<string, unknown>>)?.[0]

  return {
    provider: 'ESPN',
    match: {
      id: finishedMatch.id,
      name: finishedMatch.name,
      status: (headerComp?.status as Record<string, unknown>)?.type,
      score: (headerComp?.competitors as Array<Record<string, unknown>>)
        ?.map(c => `${(c.team as Record<string, unknown>)?.abbreviation}:${c.score}`)
        .join(' - '),
    },
    homePlayers: extractPlayers(rosters?.[0]),
    awayPlayers: extractPlayers(rosters?.[1]),
    summaryKeys: Object.keys(summary),
  }
}
