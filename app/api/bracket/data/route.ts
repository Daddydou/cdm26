import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('[bracket/data] START')
  try {
    // Lecture manuelle des cookies pour vérifier la présence de la session Supabase
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))
    console.log('[bracket/data] cookies sb- présents:', sbCookies.map(c => c.name))
    console.log('[bracket/data] tous les cookies:', allCookies.map(c => c.name))

    // Identification via session Supabase
    const serverClient = await createClient()
    const { data: authData, error: authError } = await serverClient.auth.getUser()
    console.log('[bracket/data] auth result:', JSON.stringify({ user: authData?.user?.id ?? null, error: authError?.message ?? null }))

    if (authData?.user?.id) {
      const { data: cdmUser, error: profileError } = await createAdminClient()
        .from('cdm_users')
        .select('id, username')
        .eq('auth_id', authData.user.id)
        .maybeSingle()
      console.log('[bracket/data] cdm_user:', cdmUser?.id ?? null, cdmUser?.username ?? null, '| error:', profileError?.message ?? null)
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

    console.log('[bracket/data] queries done — bracket:', matchesRes.data?.length, 'nations:', nationsRes.data?.length, 'users:', usersRes.data?.length, 'preds:', predsRes.data?.length)

    return NextResponse.json(
      {
        matches:     matchesRes.data ?? [],
        nations:     nationsRes.data ?? [],
        users:       usersRes.data   ?? [],
        predictions: predsRes.data   ?? [],
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err) {
    console.log('[bracket/data] ERREUR:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
