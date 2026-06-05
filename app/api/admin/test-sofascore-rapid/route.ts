import { getSofaScoreMatches, getSofaScoreRatings } from '@/app/scripts/sofascore-ratings'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? '2026-06-11'

  // 1. Récupère les matchs du jour
  let matches: Awaited<ReturnType<typeof getSofaScoreMatches>>
  try {
    matches = await getSofaScoreMatches(date)
  } catch (err) {
    return Response.json({ error: `getSofaScoreMatches: ${String(err)}` }, { status: 502 })
  }

  if (matches.length === 0) {
    return Response.json({
      error: `Aucun match trouvé pour la date ${date}`,
      tip:   'Essaie ?date=YYYY-MM-DD avec une date qui a des matchs',
    }, { status: 404 })
  }

  // 2. Premier match terminé, sinon premier match tout court
  const finished = matches.find(m => m.status === 'finished')
  const target   = finished ?? matches[0]

  // 3. Notes joueurs
  let players: Awaited<ReturnType<typeof getSofaScoreRatings>>
  try {
    players = await getSofaScoreRatings(target.event_id)
  } catch (err) {
    return Response.json({
      error:    `getSofaScoreRatings: ${String(err)}`,
      match:    target,
      all_matches_count: matches.length,
    }, { status: 502 })
  }

  return Response.json({
    date,
    all_matches_count: matches.length,
    all_matches:       matches.map(m => `[${m.status}] ${m.home_team} vs ${m.away_team} (${m.tournament})`),
    tested_match:      target,
    players_count:     players.length,
    has_ratings:       players.some(p => p.rating !== null),
    players,
  })
}
