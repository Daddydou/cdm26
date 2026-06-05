const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'
const HEADERS   = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }

// Mapping noms ESPN (anglais) → noms nations dans notre DB
export const ESPN_TO_DB_NAME: Record<string, string> = {
  'Argentina':              'Argentine',
  'Brazil':                 'Brésil',
  'Spain':                  'Espagne',
  'England':                'Angleterre',
  'Germany':                'Allemagne',
  'Italy':                  'Italie',
  'Netherlands':            'Pays-Bas',
  'Belgium':                'Belgique',
  'Croatia':                'Croatie',
  'Switzerland':            'Suisse',
  'Scotland':               'Écosse',
  'Sweden':                 'Suède',
  'Austria':                'Autriche',
  'Australia':              'Australie',
  'South Korea':            'Corée du Sud',
  'Japan':                  'Japon',
  'Morocco':                'Maroc',
  'Senegal':                'Sénégal',
  'Algeria':                'Algérie',
  'Tunisia':                'Tunisie',
  'Cameroon':               'Cameroun',
  'Egypt':                  'Égypte',
  'Mexico':                 'Mexique',
  'United States':          'États-Unis',
  'Ecuador':                'Équateur',
  'Colombia':               'Colombie',
  'Chile':                  'Chili',
  'Peru':                   'Pérou',
  'South Africa':           'Afrique du Sud',
  'Turkey':                 'Turquie',
  'Türkiye':                'Turquie',
  'Czech Republic':         'République Tchèque',
  'Czechia':                'République Tchèque',
  'Bosnia-Herzegovina':     'Bosnie-Herzégovine',
  'Bosnia & Herzegovina':   'Bosnie-Herzégovine',
  'New Zealand':            'Nouvelle-Zélande',
  'Cape Verde':             'Cap-Vert',
  'DR Congo':               'RD Congo',
  'Congo':                  'RD Congo',
  'Uzbekistan':             'Ouzbékistan',
  'Iraq':                   'Irak',
  'Jordan':                 'Jordanie',
  'Saudi Arabia':           'Arabie Saoudite',
  'Ivory Coast':            "Côte d'Ivoire",
  'Curacao':                'Curaçao',
  'Haiti':                  'Haïti',
  'Norway':                 'Norvège',
}

export type EspnMatch = {
  espn_id:   string
  home_team: string   // nom ESPN
  away_team: string
  status:    string
  completed: boolean
  date:      string   // ISO
}

export type EspnPlayerRating = {
  player_name:    string
  team_name:      string   // nom ESPN
  rating:         number | null
  goals:          number
  assists:        number
  minutes_played: number | null
  penalty_saves:  number
}

// ── Récupère les matchs d'une date (YYYYMMDD) ─────────────────────────────────

export async function getESPNMatches(date: string): Promise<EspnMatch[]> {
  const url = `${ESPN_BASE}/scoreboard?dates=${date}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`)
  const data = await res.json()

  return ((data.events ?? []) as Record<string, unknown>[]).map(e => {
    const comps = (e.competitions as Record<string, unknown>[])?.[0]
    const competitors = (comps?.competitors as Record<string, unknown>[]) ?? []
    const home = competitors.find(c => c.homeAway === 'home')
    const away = competitors.find(c => c.homeAway === 'away')
    const status = e.status as Record<string, unknown>
    return {
      espn_id:   String(e.id),
      home_team: (home?.team as Record<string, unknown>)?.displayName as string ?? '',
      away_team: (away?.team as Record<string, unknown>)?.displayName as string ?? '',
      status:    (status?.type as Record<string, unknown>)?.name as string ?? '',
      completed: Boolean((status?.type as Record<string, unknown>)?.completed),
      date:      e.date as string ?? '',
    }
  })
}

// ── Récupère les notes joueurs d'un match ESPN ────────────────────────────────

export async function getESPNRatings(espn_event_id: string): Promise<EspnPlayerRating[]> {
  const url = `${ESPN_BASE}/summary?event=${espn_event_id}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`ESPN summary ${res.status}`)
  const data = await res.json()

  const results: EspnPlayerRating[] = []
  const rosters = (data.rosters ?? []) as Record<string, unknown>[]

  for (const roster of rosters) {
    const team     = (roster.team as Record<string, unknown>)?.displayName as string ?? ''
    const players  = (roster.roster as Record<string, unknown>[]) ?? []

    for (const p of players) {
      const athlete = p.athlete as Record<string, unknown>
      const name    = athlete?.displayName as string ?? ''
      if (!name) continue

      const stats   = (p.statistics as Array<{ name: string; displayValue: string }>) ?? []
      const getStat = (key: string) => Number(stats.find(s => s.name === key)?.displayValue ?? 0) || 0

      results.push({
        player_name:    name,
        team_name:      team,
        rating:         typeof p.rating === 'number' ? p.rating : null,
        goals:          getStat('goals'),
        assists:        getStat('goalAssist') || getStat('assists'),
        minutes_played: getStat('minutesPlayed') || null,
        penalty_saves:  getStat('penaltyKickSaves'),
      })
    }
  }

  // Fallback: ESPN boxscore.players structure (alternative layout)
  if (results.length === 0) {
    const bsPlayers = (data.boxscore?.players ?? []) as Record<string, unknown>[]
    for (const entry of bsPlayers) {
      const team    = (entry.team as Record<string, unknown>)?.displayName as string ?? ''
      const groups  = (entry.statistics as Record<string, unknown>[]) ?? []
      for (const group of groups) {
        const keys     = (group.keys as string[]) ?? []
        const athletes = (group.athletes as Record<string, unknown>[]) ?? []
        for (const a of athletes) {
          const athlete = a.athlete as Record<string, unknown>
          const name    = athlete?.displayName as string ?? ''
          if (!name) continue
          const statsArr = (a.stats as string[]) ?? []
          const idx      = (k: string) => keys.indexOf(k)
          const num      = (k: string) => Number(statsArr[idx(k)] ?? 0) || 0
          results.push({
            player_name:    name,
            team_name:      team,
            rating:         null,
            goals:          num('goals'),
            assists:        num('goalAssist') || num('assists'),
            minutes_played: num('minutesPlayed') || null,
            penalty_saves:  num('penaltyKickSaves'),
          })
        }
      }
    }
  }

  return results
}

// ── Normalise un nom pour la comparaison ──────────────────────────────────────

export function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}
