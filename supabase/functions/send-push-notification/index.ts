import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  try {
    const { user_id, message } = await req.json()

    webpush.setVapidDetails(
      'mailto:admin@cdm26.app',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const { data: row, error } = await supabase
      .from('cdm_push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)
      .single()

    if (error || !row) {
      return Response.json({ error: 'No subscription found' }, { status: 404 })
    }

    await webpush.sendNotification(
      row.subscription,
      JSON.stringify({ title: 'CDM26 ⚽', body: message }),
    )

    return Response.json({ sent: true })
  } catch (err) {
    console.error('[send-push-notification]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})
