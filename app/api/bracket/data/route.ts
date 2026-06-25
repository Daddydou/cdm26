import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('[bracket/data] START')
  try {
    const supabase = await createClient()
    const admin    = createAdminClient()

    // auth_id → cdm_users.id (la colonne user_id de cdm_bracket_predictions référence cdm_users.id)
    const { data: { user } } = await supabase.auth.getUser()
    let cdmUserId: string | null = null
    if (user?.id) {
      const { data: cdmUser } = await admin
        .from('cdm_users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()
      cdmUserId = cdmUser?.id ?? null
    }
    console.log('[bracket/data] auth_id:', user?.id ?? null, '→ cdmUserId:', cdmUserId)

    const [matchesRes, nationsRes, usersRes, predsRes] = await Promise.all([
      admin.from('cdm_bracket').select('*').order('match_number'),
      admin.from('cdm_nations').select('id, name, code').order('name'),
      admin.from('cdm_users').select('id, username, photo_url'),
      admin.from('cdm_bracket_predictions').select('user_id, match_number, predicted_winner_nation_id'),
    ])

    const allPreds    = predsRes.data ?? []
    // Filtre avec cdm_users.id (pas auth_id) → prédictions de l'utilisateur connecté
    const myPredictions = cdmUserId
      ? allPreds.filter(p => p.user_id === cdmUserId)
      : []

    console.log(
      '[bracket/data] done — bracket:', matchesRes.data?.length,
      'nations:', nationsRes.data?.length,
      'users:', usersRes.data?.length,
      'allPreds:', allPreds.length,
      '| myPredictions:', myPredictions.length,
      '(cdmUserId:', cdmUserId, ')'
    )

    return NextResponse.json(
      {
        matches:        matchesRes.data ?? [],
        nations:        nationsRes.data ?? [],
        users:          usersRes.data   ?? [],
        predictions:    allPreds,       // tous les users → onglet "Brackets des participants"
        myPredictions,                  // filtré par cdm_users.id → onglet "Mon Bracket"
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err) {
    console.log('[bracket/data] ERREUR:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
