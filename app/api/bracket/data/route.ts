import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Identify the connected user and verify cdm_users lookup
  try {
    const serverClient = await createClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()
    console.log('[bracket/data] auth_id:', user?.id ?? null, '| auth error:', authError?.message ?? null)

    if (user?.id) {
      const admin = createAdminClient()
      const { data: cdmUser, error: profileError } = await admin
        .from('cdm_users')
        .select('id, username')
        .eq('auth_id', user.id)
        .single()
      console.log('[bracket/data] cdm_user:', cdmUser?.id ?? null, cdmUser?.username ?? null, '| error:', profileError?.message ?? null)
    }
  } catch (e) {
    console.log('[bracket/data] user lookup exception:', e)
  }

  const supabase = createAdminClient()

  const [matchesRes, nationsRes, usersRes, predsRes] = await Promise.all([
    supabase
      .from('cdm_bracket')
      .select('*')
      .order('match_number'),
    supabase
      .from('cdm_nations')
      .select('id, name, code')
      .order('name'),
    supabase
      .from('cdm_users')
      .select('id, username, photo_url'),
    supabase
      .from('cdm_bracket_predictions')
      .select('user_id, match_number, predicted_winner_nation_id'),
  ])

  return NextResponse.json({
    matches:     matchesRes.data     ?? [],
    nations:     nationsRes.data     ?? [],
    users:       usersRes.data       ?? [],
    predictions: predsRes.data       ?? [],
  })
}
