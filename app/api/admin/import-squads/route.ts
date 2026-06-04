import { importSquads } from '@/app/scripts/import-squads'

export async function GET() {
  const result = await importSquads()

  if (result.error) {
    return Response.json({ ok: false, error: result.error }, { status: 500 })
  }

  const unknownNations = Object.entries(result.by_nation)
    .filter(([, v]) => v.unknown)
    .map(([k]) => k)

  return Response.json({
    ok: true,
    summary: {
      total_inserted: result.total_players_inserted,
      total_skipped:  result.total_players_skipped,
      nations_with_data: Object.values(result.by_nation).filter(v => !v.unknown && v.inserted + v.skipped > 0).length,
      nations_empty:     Object.values(result.by_nation).filter(v => !v.unknown && v.inserted + v.skipped === 0).length,
      nations_unknown:   unknownNations.length,
    },
    by_nation: result.by_nation,
    unknown_nations: unknownNations,
  })
}
