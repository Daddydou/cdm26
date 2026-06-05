const HEADERS  = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
const LEAGUES  = ['uefa.champions', 'eng.1'] as const
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

function parseRatings(summary: Record<string, unknown>) {
  type Player = { name: string; team: string; rating: number | null; goals: number; assists: number; minutes_played: number | null }
  const players: Player[] = []

  // Structure 1 : summary.rosters[]
  const rosters = (summary.rosters ?? []) as Record<string, unknown>[]
  for (const roster of rosters) {
    const team        = (roster.team as Record<string, unknown>)?.displayName as string ?? ''
    const rosterPlayers = (roster.roster as Record<string, unknown>[]) ?? []
    for (const p of rosterPlayers) {
      const athlete = p.athlete as Record<string, unknown>
      const name    = athlete?.displayName as string ?? ''
      if (!name) continue
      const stats    = (p.statistics as Array<{ name: string; displayValue: string }>) ?? []
      const getStat  = (key: string) => Number(stats.find(s => s.name === key)?.displayValue ?? 0) || 0
      players.push({
        name,
        team,
        rating:         typeof p.rating === 'number' ? p.rating : null,
        goals:          getStat('goals'),
        assists:        getStat('goalAssist') || getStat('assists'),
        minutes_played: getStat('minutesPlayed') || null,
      })
    }
  }

  // Structure 2 (fallback) : summary.boxscore.players[]
  if (players.length === 0) {
    const bsPlayers = (summary.boxscore as Record<string, unknown>)?.players as Record<string, unknown>[] ?? []
    for (const entry of bsPlayers) {
      const team   = (entry.team as Record<string, unknown>)?.displayName as string ?? ''
      const groups = (entry.statistics as Record<string, unknown>[]) ?? []
      for (const group of groups) {
        const keys     = (group.keys as string[]) ?? []
        const athletes = (group.athletes as Record<string, unknown>[]) ?? []
        for (const a of athletes) {
          const athlete = a.athlete as Record<string, unknown>
          const name    = athlete?.displayName as string ?? ''
          if (!name) continue
          const statsArr = (a.stats as string[]) ?? []
          const num      = (k: string) => Number(statsArr[keys.indexOf(k)] ?? 0) || 0
          players.push({
            name,
            team,
            rating:         null,
            goals:          num('goals'),
            assists:        num('goalAssist') || num('assists'),
            minutes_played: num('minutesPlayed') || null,
          })
        }
      }
    }
  }

  return players
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const errors: string[] = []

  for (const league of LEAGUES) {
    // 1. Scoreboard de la ligue
    let scoreboard: Record<string, unknown>
    try {
      scoreboard = await fetchJSON(`${ESPN_API}/${league}/scoreboard`)
    } catch (err) {
      errors.push(`${league} scoreboard: ${String(err)}`)
      continue
    }

    const events = (scoreboard.events ?? []) as Record<string, unknown>[]

    // 2. Premier match terminé (completed = true)
    const event = events.find(e => {
      const type = (e.status as Record<string, unknown>)?.type as Record<string, unknown>
      return Boolean(type?.completed)
    })

    if (!event) {
      errors.push(`${league}: aucun match terminé dans le scoreboard (${events.length} matchs)`)
      continue
    }

    // 3. Identité du match
    const espnId      = String(event.id)
    const comps       = (event.competitions as Record<string, unknown>[])?.[0]
    const competitors = (comps?.competitors as Record<string, unknown>[]) ?? []
    const home        = competitors.find(c => c.homeAway === 'home')
    const away        = competitors.find(c => c.homeAway === 'away')
    const homeName    = (home?.team as Record<string, unknown>)?.displayName as string ?? '?'
    const awayName    = (away?.team as Record<string, unknown>)?.displayName as string ?? '?'
    const matchName   = `${homeName} vs ${awayName}`

    // 4. Summary avec les notes joueurs
    let summary: Record<string, unknown>
    try {
      summary = await fetchJSON(`${ESPN_API}/${league}/summary?event=${espnId}`)
    } catch (err) {
      return Response.json({
        error:      `Summary fetch échoué: ${String(err)}`,
        league,
        espn_id:    espnId,
        match_name: matchName,
      }, { status: 502 })
    }

    // 5. Parse des joueurs
    const players      = parseRatings(summary)
    const hasRatings   = players.some(p => p.rating !== null)
    const topKeys      = Object.keys(summary).sort()

    return Response.json({
      league,
      match_name:     matchName,
      espn_id:        espnId,
      players_count:  players.length,
      has_ratings:    hasRatings,
      summary_keys:   topKeys,   // aide au debug de la structure ESPN
      players,
    })
  }

  // Aucun match trouvé sur aucune ligue
  return Response.json({
    error:   'Aucun match terminé trouvé sur Champions League ou Premier League',
    details: errors,
  }, { status: 404 })
}
