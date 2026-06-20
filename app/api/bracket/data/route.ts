import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
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
