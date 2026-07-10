import { createAdminClient } from '@/lib/supabase/admin'

// Empêche l'évaluation/collecte statique au build — le client Supabase lit les env vars au runtime
export const dynamic = 'force-dynamic'

export async function DELETE() {
  const admin = createAdminClient()

  const { error, count } = await admin
    .from('cdm_players')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, deleted: count })
}
