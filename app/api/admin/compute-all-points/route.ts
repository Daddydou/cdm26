import { createAdminClient } from '@/lib/supabase/admin'
import { computeMatchPoints } from '@/app/actions/admin'

// Empêche l'évaluation/collecte statique au build — le client Supabase lit les env vars au runtime
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = createAdminClient()

  const { data: matches, error } = await admin
    .from('cdm_matches')
    .select(`
      id,
      nation_a:cdm_nations!nation_a_id ( name ),
      nation_b:cdm_nations!nation_b_id ( name )
    `)
    .eq('status', 'termine')
    .order('kickoff_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!matches || matches.length === 0) {
    return Response.json({ matches_processed: 0, total_picks_computed: 0, results: [] })
  }

  let totalPicks = 0
  const results: Array<{ match_id: string; label: string; picks_computed: number; error: string | null }> = []

  for (const match of matches) {
    const na    = match.nation_a as unknown as { name: string } | null
    const nb    = match.nation_b as unknown as { name: string } | null
    const label = `${na?.name ?? '?'} vs ${nb?.name ?? '?'}`

    const result = await computeMatchPoints(match.id)
    results.push({ match_id: match.id, label, picks_computed: result.computed.length, error: result.error })
    totalPicks += result.computed.length
  }

  return Response.json({
    matches_processed:    matches.length,
    total_picks_computed: totalPicks,
    results,
  })
}
