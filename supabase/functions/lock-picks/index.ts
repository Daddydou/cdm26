import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async () => {
  const now = new Date().toISOString()

  // 1. Matchs à_venir dont le coup d'envoi est passé
  const { data: matches, error: matchesError } = await supabase
    .from('cdm_matches')
    .select('id, kickoff_at, nation_a:cdm_nations!nation_a_id(name), nation_b:cdm_nations!nation_b_id(name)')
    .eq('status', 'a_venir')
    .lte('kickoff_at', now)

  if (matchesError) {
    return Response.json({ error: matchesError.message }, { status: 500 })
  }

  if (!matches || matches.length === 0) {
    return Response.json({ locked: 0, matches: [] })
  }

  const results: { match_id: string; label: string; picks_locked: number }[] = []

  for (const match of matches) {
    const na = (match.nation_a as { name: string } | null)?.name ?? '?'
    const nb = (match.nation_b as { name: string } | null)?.name ?? '?'

    // 2a. Match → en_cours
    const { error: matchUpdateError } = await supabase
      .from('cdm_matches')
      .update({ status: 'en_cours' })
      .eq('id', match.id)

    if (matchUpdateError) {
      console.error(`[lock-picks] Match update error (${match.id}):`, matchUpdateError.message)
      continue
    }

    // 2b. Picks → is_locked = true
    const { data: lockedPicks, error: picksError } = await supabase
      .from('cdm_picks')
      .update({ is_locked: true })
      .eq('match_id', match.id)
      .eq('is_locked', false)
      .select('id')

    if (picksError) {
      console.error(`[lock-picks] Picks lock error (${match.id}):`, picksError.message)
    }

    const picks_locked = lockedPicks?.length ?? 0
    console.log(`[lock-picks] Locked: ${na} vs ${nb} — ${picks_locked} picks`)

    results.push({ match_id: match.id, label: `${na} vs ${nb}`, picks_locked })
  }

  return Response.json({
    locked:  results.length,
    matches: results,
    at:      now,
  })
})
