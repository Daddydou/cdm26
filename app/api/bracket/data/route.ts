import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('[bracket/data] START')
  try {
    const supabase = createAdminClient()

    const [matchesRes, nationsRes, usersRes, predsRes] = await Promise.all([
      supabase.from('cdm_bracket').select('*').order('match_number'),
      supabase.from('cdm_nations').select('id, name, code').order('name'),
      supabase.from('cdm_users').select('id, username, photo_url'),
      supabase.from('cdm_bracket_predictions').select('user_id, match_number, predicted_winner_nation_id'),
    ])

    console.log('[bracket/data] done — bracket:', matchesRes.data?.length, 'nations:', nationsRes.data?.length, 'users:', usersRes.data?.length, 'preds:', predsRes.data?.length)

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
