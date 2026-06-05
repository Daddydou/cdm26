import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async () => {
  const now  = new Date()
  const from = new Date(now.getTime() + 55 * 60 * 1000).toISOString()  // now + 55 min
  const to   = new Date(now.getTime() + 65 * 60 * 1000).toISOString()  // now + 65 min

  // 1. Matchs dont le coup d'envoi est dans ~1 heure
  const { data: matches, error: matchesError } = await supabase
    .from('cdm_matches')
    .select('id, kickoff_at, nation_a:cdm_nations!nation_a_id(name), nation_b:cdm_nations!nation_b_id(name)')
    .eq('status', 'a_venir')
    .gte('kickoff_at', from)
    .lte('kickoff_at', to)

  if (matchesError) {
    return Response.json({ error: matchesError.message }, { status: 500 })
  }

  if (!matches || matches.length === 0) {
    return Response.json({ notified: 0, matches: [] })
  }

  // 2. Participants qui n'ont pas encore pickés
  const { data: allUsers, error: usersError } = await supabase
    .from('cdm_users')
    .select('id, username')

  if (usersError) {
    return Response.json({ error: usersError.message }, { status: 500 })
  }

  const results: { match_id: string; label: string; notified: number }[] = []

  for (const match of matches) {
    const na = (match.nation_a as { name: string } | null)?.name ?? '?'
    const nb = (match.nation_b as { name: string } | null)?.name ?? '?'

    // Participants qui ont déjà un pick pour ce match
    const { data: existingPicks } = await supabase
      .from('cdm_picks')
      .select('user_id')
      .eq('match_id', match.id)

    const pickedUserIds = new Set((existingPicks ?? []).map(p => p.user_id))

    // Utilisateurs sans pick
    const usersWithoutPick = (allUsers ?? []).filter(u => !pickedUserIds.has(u.id))

    if (usersWithoutPick.length === 0) {
      results.push({ match_id: match.id, label: `${na} vs ${nb}`, notified: 0 })
      continue
    }

    // 3. Log une notification par utilisateur
    const notifications = usersWithoutPick.map(u => ({
      user_id:    u.id,
      match_id:   match.id,
      type:       'reminder',
      payload:    { message: `⚽ ${na} vs ${nb} dans moins d'une heure — fais tes picks !`, kickoff_at: match.kickoff_at },
      created_at: now.toISOString(),
    }))

    const { error: logError } = await supabase
      .from('cdm_notification_log')
      .insert(notifications)

    if (logError) {
      console.error(`[match-reminder] Log error (${match.id}):`, logError.message)
    }

    // Envoyer les push notifications
    await Promise.allSettled(
      usersWithoutPick.map(u =>
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_id: u.id,
            message: `⚽ ${na} vs ${nb} dans moins d'une heure — fais tes picks !`,
          }),
        })
      )
    )

    console.log(`[match-reminder] ${na} vs ${nb} — ${usersWithoutPick.length} rappels envoyés`)
    results.push({ match_id: match.id, label: `${na} vs ${nb}`, notified: usersWithoutPick.length })
  }

  const totalNotified = results.reduce((acc, r) => acc + r.notified, 0)

  return Response.json({
    notified: totalNotified,
    matches:  results,
    window:   { from, to },
  })
})
