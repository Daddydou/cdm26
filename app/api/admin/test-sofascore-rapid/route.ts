const RAPIDAPI_HEADERS = {
  'x-rapidapi-host': 'sofascore.p.rapidapi.com',
  'x-rapidapi-key':  process.env.RAPIDAPI_KEY ?? '',
  'Accept':          'application/json',
}

async function probe(url: string): Promise<{
  url:        string
  status:     number
  ok:         boolean
  preview:    string
  top_keys:   string[]
  error?:     string
}> {
  try {
    const res  = await fetch(url, { headers: RAPIDAPI_HEADERS, cache: 'no-store' })
    const text = await res.text()

    let top_keys: string[] = []
    try {
      const json = JSON.parse(text)
      top_keys = typeof json === 'object' && json !== null ? Object.keys(json) : []
    } catch { /* not JSON */ }

    return {
      url,
      status:  res.status,
      ok:      res.ok,
      preview: text.slice(0, 200),
      top_keys,
    }
  } catch (err) {
    return {
      url,
      status:  0,
      ok:      false,
      preview: '',
      top_keys: [],
      error:   String(err),
    }
  }
}

export async function GET() {
  const endpoints = [
    // Playground / liste des routes
    'https://sofascore.p.rapidapi.com/',

    // Matchs par date — variantes possibles
    'https://sofascore.p.rapidapi.com/matches/get-by-date?date=2026-06-11&sport=football',
    'https://sofascore.p.rapidapi.com/events/get-by-date?date=2026-06-11&sport=football',
    'https://sofascore.p.rapidapi.com/matches/list?date=2026-06-11',

    // Tournoi CdM 2026 (tournamentId=16 = FIFA World Cup dans SofaScore)
    'https://sofascore.p.rapidapi.com/tournaments/get-matches?tournamentId=16&season=2026',

    // Variantes avec seasonId — le CdM 2026 pourrait avoir un ID spécifique
    'https://sofascore.p.rapidapi.com/unique-tournaments/get-seasons?uniqueTournamentId=16',
    'https://sofascore.p.rapidapi.com/tournaments/search?query=world+cup+2026',
  ]

  // On sonde tous les endpoints en parallèle
  const results = await Promise.all(endpoints.map(probe))

  const working = results.filter(r => r.ok)
  const failed  = results.filter(r => !r.ok)

  return Response.json({
    summary: {
      total:   results.length,
      working: working.length,
      failed:  failed.length,
    },
    working_endpoints: working.map(r => ({
      url:      r.url,
      status:   r.status,
      top_keys: r.top_keys,
      preview:  r.preview,
    })),
    failed_endpoints: failed.map(r => ({
      url:    r.url,
      status: r.status,
      error:  r.error,
      preview: r.preview,
    })),
  })
}
