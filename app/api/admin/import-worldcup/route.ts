import { importWorldCup } from '@/app/scripts/import-worldcup'

export async function GET() {
  const result = await importWorldCup()

  if (result.error) {
    return Response.json({ ok: false, ...result }, { status: 500 })
  }

  return Response.json({
    ok: true,
    summary: {
      nations_new:      result.nations_new,
      nations_existing: result.nations_existing,
      matches_inserted: result.matches_inserted,
      matches_skipped:  result.matches_skipped,
      total_matches:    result.total_matches,
    },
    details: result.details,
  })
}
