const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}

async function probe(label: string, url: string) {
  try {
    const res  = await fetch(url, { headers: HEADERS, cache: 'no-store' })
    const text = await res.text()

    let top_keys: string[] = []
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
      if (typeof parsed === 'object' && parsed !== null) top_keys = Object.keys(parsed as object)
    } catch { /* not JSON */ }

    return {
      label,
      url,
      status:   res.status,
      ok:       res.ok,
      top_keys,
      preview:  text.slice(0, 400),
      parsed,
    }
  } catch (err) {
    return {
      label,
      url,
      status:   0,
      ok:       false,
      top_keys: [],
      preview:  '',
      parsed:   null,
      error:    String(err),
    }
  }
}

export async function GET() {
  const DATE = '2026-06-06'
  const HOME_KEYWORDS = ['operario', 'operário']
  const AWAY_KEYWORDS = ['juventude']

  // Étape 1 : récupère tous les matchs du 06/06/2026
  const scheduleResult = await probe(
    `scheduled_events_${DATE}`,
    `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${DATE}`,
  )

  // Étape 2 : cherche l'event ID du match Operário-PR vs Juventude
  let eventId: number | null = null
  let matchFound: Record<string, unknown> | null = null

  if (scheduleResult.ok && scheduleResult.parsed) {
    const data = scheduleResult.parsed as { events?: Array<Record<string, unknown>> }
    const events: Array<Record<string, unknown>> = data?.events ?? []

    for (const ev of events) {
      const home = String((ev.homeTeam as Record<string, unknown>)?.name ?? '').toLowerCase()
      const away = String((ev.awayTeam as Record<string, unknown>)?.name ?? '').toLowerCase()
      const matchesHome = HOME_KEYWORDS.some(k => home.includes(k))
      const matchesAway = AWAY_KEYWORDS.some(k => away.includes(k))
      if (matchesHome && matchesAway) {
        eventId = ev.id as number
        matchFound = {
          id:       ev.id,
          home:     (ev.homeTeam as Record<string, unknown>)?.name,
          away:     (ev.awayTeam as Record<string, unknown>)?.name,
          status:   (ev.status as Record<string, unknown>)?.type,
          tournament: (ev.tournament as Record<string, unknown>)?.name,
        }
        break
      }
    }
  }

  // Étape 3 : si event trouvé, récupère les lineups (avec notes SofaScore)
  const results: Record<string, unknown>[] = []

  results.push({
    label:     scheduleResult.label,
    url:       scheduleResult.url,
    status:    scheduleResult.status,
    ok:        scheduleResult.ok,
    top_keys:  scheduleResult.top_keys,
    preview:   scheduleResult.preview,
    ...('error' in scheduleResult ? { error: scheduleResult.error } : {}),
  })

  if (eventId) {
    const lineupsResult = await probe(
      `lineups_event_${eventId}`,
      `https://api.sofascore.com/api/v1/event/${eventId}/lineups`,
    )

    // Extrait un aperçu des notes si disponibles
    let ratingsPreview: unknown = null
    if (lineupsResult.ok && lineupsResult.parsed) {
      const ld = lineupsResult.parsed as {
        home?: { players?: Array<{ player?: { name?: string }; statistics?: { rating?: number } }> }
        away?: { players?: Array<{ player?: { name?: string }; statistics?: { rating?: number } }> }
      }
      const homePlayers = ld?.home?.players?.slice(0, 3).map(p => ({
        name:   p?.player?.name,
        rating: p?.statistics?.rating,
      })) ?? []
      const awayPlayers = ld?.away?.players?.slice(0, 3).map(p => ({
        name:   p?.player?.name,
        rating: p?.statistics?.rating,
      })) ?? []
      ratingsPreview = { home_sample: homePlayers, away_sample: awayPlayers }
    }

    results.push({
      label:          lineupsResult.label,
      url:            lineupsResult.url,
      status:         lineupsResult.status,
      ok:             lineupsResult.ok,
      top_keys:       lineupsResult.top_keys,
      preview:        lineupsResult.preview,
      ratings_preview: ratingsPreview,
      ...('error' in lineupsResult ? { error: lineupsResult.error } : {}),
    })
  }

  return Response.json({
    date: DATE,
    match_searched: 'Operário-PR vs Juventude',
    match_found: matchFound,
    event_id: eventId,
    summary: {
      total:   results.length,
      working: results.filter(r => r.ok).length,
      failed:  results.filter(r => !r.ok).length,
    },
    results,
  })
}
