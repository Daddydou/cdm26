import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('[bracket/data] START')
  try {
    const supabase = createAdminClient()

    // auth_id envoyé par le client (même pattern que savePick / PickClient)
    const authId = request.nextUrl.searchParams.get('auth_id')
    console.log('[bracket/data] auth_id reçu:', authId)

    // Lookup cdm_user depuis auth_id
    let currentUser: { id: string; username: string } | null = null
    if (authId) {
      const { data, error } = await supabase
        .from('cdm_users')
        .select('id, username')
        .eq('auth_id', authId)
        .maybeSingle()
      console.log('[bracket/data] cdm_user:', data?.id ?? null, data?.username ?? null, '| error:', error?.message ?? null)
      currentUser = data ?? null
    }

    const [matchesRes, nationsRes, usersRes, predsRes] = await Promise.all([
      supabase.from('cdm_bracket').select('*').order('match_number'),
      supabase.from('cdm_nations').select('id, name, code').order('name'),
      supabase.from('cdm_users').select('id, username, photo_url'),
      supabase.from('cdm_bracket_predictions').select('user_id, match_number, predicted_winner_nation_id'),
    ])

    console.log('[bracket/data] queries done — bracket:', matchesRes.data?.length, 'nations:', nationsRes.data?.length, 'users:', usersRes.data?.length, 'preds:', predsRes.data?.length)

    return NextResponse.json(
      {
        currentUser,
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
