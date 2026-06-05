const RAPIDAPI_HOST = 'sofascore.p.rapidapi.com'
const BASE_URL      = 'https://sofascore.p.rapidapi.com'

function getHeaders() {
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key':  process.env.RAPIDAPI_KEY ?? '',
    'Accept':          'application/json',
  }
}

async function fetchJSON(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' })
  if (!res.ok) throw new Error(`SofaScore ${res.status}: ${url}`)
  return res.json()
}

// ─── Normalisation ────────────────────────────────────────────────────────────

export function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// ─── Mapping noms SofaScore → noms DB ─────────────────────────────────────────

export const SOFA_TO_DB_NAME: Record<string, string> = {
  'Argentina':            'Argentine',
  'Brazil':               'Brésil',
  'Spain':                'Espagne',
  'England':              'Angleterre',
  'Germany':              'Allemagne',
  'Italy':                'Italie',
  'Netherlands':          'Pays-Bas',
  'Belgium':              'Belgique',
  'Croatia':              'Croatie',
  'Switzerland':          'Suisse',
  'Scotland':             'Écosse',
  'Sweden':               'Suède',
  'Austria':              'Autriche',
  'Australia':            'Australie',
  'South Korea':          'Corée du Sud',
  'Japan':                'Japon',
  'Morocco':              'Maroc',
  'Senegal':              'Sénégal',
  'Algeria':              'Algérie',
  'Tunisia':              'Tunisie',
  'Cameroon':             'Cameroun',
  'Egypt':                'Égypte',
  'Mexico':               'Mexique',
  'United States':        'États-Unis',
  'USA':                  'États-Unis',
  'Ecuador':              'Équateur',
  'Colombia':             'Colombie',
  'Chile':                'Chili',
  'Peru':                 'Pérou',
  'Turkey':               'Turquie',
  'Türkiye':              'Turquie',
  'Czech Republic':       'République Tchèque',
  'Czechia':              'République Tchèque',
  'Saudi Arabia':         'Arabie Saoudite',
  "Ivory Coast":          "Côte d'Ivoire",
  'Canada':               'Canada',
  'Portugal':             'Portugal',
  'France':               'France',
  'Uruguay':              'Uruguay',
  'Paraguay':             'Paraguay',
  'Venezuela':            'Venezuela',
  'Panama':               'Panama',
  'Costa Rica':           'Costa Rica',
  'Honduras':             'Honduras',
  'Jamaica':              'Jamaïque',
  'Nigeria':              'Nigeria',
  'Ghana':                'Ghana',
  'South Africa':         'Afrique du Sud',
  'Uzbekistan':           'Ouzbékistan',
  'Iran':                 'Iran',
  'Serbia':               'Serbie',
  'Poland':               'Pologne',
  'Denmark':              'Danemark',
  'Ukraine':              'Ukraine',
  'Romania':              'Roumanie',
  'Hungary':              'Hongrie',
  'Slovakia':             'Slovaquie',
  'Greece':               'Grèce',
  'Slovenia':             'Slovénie',
  'Wales':                'Pays de Galles',
  'New Zealand':          'Nouvelle-Zélande',
  'DR Congo':             'RD Congo',
  'Congo':                'RD Congo',
  'Qatar':                'Qatar',
  'Norway':               'Norvège',
  'Bolivia':              'Bolivie',
  'Trinidad and Tobago':  'Trinité-et-Tobago',
  'El Salvador':          'Salvador',
  'Cuba':                 'Cuba',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SofaMatch = {
  event_id:   string
  home_team:  string
  away_team:  string
  status:     string   // 'finished' | 'inprogress' | 'notstarted' | 'canceled'
  tournament: string
}

export type SofaPlayerRating = {
  player_name:    string
  team_name:      string
  rating:         number | null
  goals:          number
  assists:        number
  minutes_played: number | null
  yellow_card:    boolean
  penalty_saves:  number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getSofaScoreMatches(date: string): Promise<SofaMatch[]> {
  const data   = await fetchJSON(
    `${BASE_URL}/matches/get-by-date?date=${date}&sport=football`
  )
  const events = (data.events ?? []) as Record<string, unknown>[]

  return events.map(e => {
    const homeTeam   = e.homeTeam as Record<string, unknown>
    const awayTeam   = e.awayTeam as Record<string, unknown>
    const status     = e.status   as Record<string, unknown>
    const tournament = (e.tournament as Record<string, unknown>)?.name as string ?? ''
    return {
      event_id:   String(e.id),
      home_team:  homeTeam?.name  as string ?? '',
      away_team:  awayTeam?.name  as string ?? '',
      status:     status?.type    as string ?? '',
      tournament,
    }
  })
}

export async function getSofaScoreRatings(eventId: string): Promise<SofaPlayerRating[]> {
  const data    = await fetchJSON(
    `${BASE_URL}/matches/get-player-statistics?eventId=${eventId}`
  )
  const results: SofaPlayerRating[] = []

  // SofaScore retourne soit { home, away } soit { homeTeam, awayTeam }
  const pairKeys: [string, string][] = [['home', 'away'], ['homeTeam', 'awayTeam']]
  let parsed = false

  for (const [hKey, aKey] of pairKeys) {
    if (!data[hKey] && !data[aKey]) continue
    parsed = true

    for (const key of [hKey, aKey]) {
      const side     = data[key] as Record<string, unknown>
      if (!side) continue

      const teamName = (side.team as Record<string, unknown>)?.name as string
                    ?? side.name as string
                    ?? key

      const players  = (side.players ?? []) as Record<string, unknown>[]

      for (const p of players) {
        const player = p.player as Record<string, unknown>
        const name   = player?.name as string
                    ?? player?.shortName as string
                    ?? ''
        if (!name) continue

        const stats  = (p.statistics ?? {}) as Record<string, unknown>

        results.push({
          player_name:    name,
          team_name:      teamName,
          rating:         typeof stats.rating === 'number' ? stats.rating : null,
          goals:          Number(stats.goals        ?? 0),
          assists:        Number(stats.goalAssist   ?? stats.assists ?? 0),
          minutes_played: stats.minutesPlayed != null ? Number(stats.minutesPlayed) : null,
          yellow_card:    Number(stats.yellowCards  ?? 0) > 0,
          penalty_saves:  Number(stats.savedShotsFromInsideTheBox ?? stats.penaltyKickSave ?? 0),
        })
      }
    }
    break  // on s'arrête dès qu'une structure est trouvée
  }

  if (!parsed) {
    // Log de debug en cas de structure inconnue
    console.warn('[sofascore] Structure inconnue — clés:', Object.keys(data))
  }

  return results
}
