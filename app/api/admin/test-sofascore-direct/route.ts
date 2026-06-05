const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Referer':         'https://www.sofascore.com/',
  'Origin':          'https://www.sofascore.com',
}

async function probe(label: string, url: string) {
  try {
    const res  = await fetch(url, { headers: HEADERS, cache: 'no-store' })
    const text = await res.text()

    let top_keys: string[] = []
    try {
      const json = JSON.parse(text)
      if (typeof json === 'object' && json !== null) top_keys = Object.keys(json)
    } catch { /* not JSON */ }

    return {
      label,
      url,
      status:   res.status,
      ok:       res.ok,
      top_keys,
      preview:  text.slice(0, 300),
    }
  } catch (err) {
    return {
      label,
      url,
      status:   0,
      ok:       false,
      top_keys: [],
      preview:  '',
      error:    String(err),
    }
  }
}

export async function GET() {
  const tests = await Promise.all([
    probe(
      'matchs_cdm_2026_11juin',
      'https://api.sofascore.com/api/v1/sport/football/scheduled-events/2026-06-11',
    ),
    probe(
      'saisons_cdm_tournament16',
      'https://api.sofascore.com/api/v1/unique-tournament/16/seasons',
    ),
    probe(
      'events_round1_season61634',
      'https://api.sofascore.com/api/v1/unique-tournament/16/season/61634/events/round/1',
    ),
    // Bonus : aujourd'hui pour vérifier que l'API répond bien en général
    probe(
      'matchs_aujourdhui',
      `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${new Date().toISOString().slice(0, 10)}`,
    ),
  ])

  const working = tests.filter(t => t.ok)
  const failed  = tests.filter(t => !t.ok)

  return Response.json({
    summary: { total: tests.length, working: working.length, failed: failed.length },
    results: tests.map(t => ({
      label:    t.label,
      url:      t.url,
      status:   t.status,
      ok:       t.ok,
      top_keys: t.top_keys,
      preview:  t.preview,
      ...('error' in t ? { error: t.error } : {}),
    })),
  })
}
