import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const admin = createAdminClient()
  const base  = new URL(request.url).origin

  // Matchs terminés sans aucune note existante
  const { data: matches, error: matchesErr } = await admin
    .from('cdm_matches')
    .select(`
      id, kickoff_at,
      nation_a:cdm_nations!nation_a_id ( name ),
      nation_b:cdm_nations!nation_b_id ( name )
    `)
    .eq('status', 'termine')
    .order('kickoff_at', { ascending: true })

  if (matchesErr) {
    return Response.json({ error: matchesErr.message }, { status: 500 })
  }

  if (!matches || matches.length === 0) {
    return Response.json({ processed: 0, total_matched: 0, message: 'Aucun match terminé trouvé' })
  }

  // Filtre : exclut les matchs qui ont déjà des notes
  const { data: existingRatings } = await admin
    .from('cdm_player_ratings')
    .select('match_id')

  const matchIdsWithRatings = new Set((existingRatings ?? []).map(r => r.match_id))
  const toProcess = matches.filter(m => !matchIdsWithRatings.has(m.id))

  if (toProcess.length === 0) {
    return Response.json({
      processed:     0,
      total_matched: 0,
      skipped:       matches.length,
      message:       'Tous les matchs terminés ont déjà des notes',
    })
  }

  const results: Array<{
    match_id:   string
    label:      string
    matched:    number
    unmatched:  string[]
    error:      string | null
  }> = []

  let totalMatched = 0

  // Traitement séquentiel pour éviter le rate-limiting ESPN
  for (const match of toProcess) {
    const na    = match.nation_a as unknown as { name: string }
    const nb    = match.nation_b as unknown as { name: string }
    const label = `${na?.name} vs ${nb?.name}`

    try {
      const url = `${base}/api/admin/fetch-ratings?match_id=${match.id}`
      const res  = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        results.push({ match_id: match.id, label, matched: 0, unmatched: [], error: data.error ?? `HTTP ${res.status}` })
      } else {
        results.push({
          match_id:  match.id,
          label,
          matched:   data.matched ?? 0,
          unmatched: data.unmatched ?? [],
          error:     data.upsert_error ?? null,
        })
        totalMatched += data.matched ?? 0
      }
    } catch (err) {
      results.push({ match_id: match.id, label, matched: 0, unmatched: [], error: String(err) })
    }

    // Petite pause pour ne pas spammer ESPN
    await new Promise(r => setTimeout(r, 300))
  }

  return Response.json({
    processed:     toProcess.length,
    skipped:       matches.length - toProcess.length,
    total_matched: totalMatched,
    results,
  })
}
