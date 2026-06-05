import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: { match_id: string } }
) {
  const supabaseAdmin = createAdminClient()

  const { data: picks, error } = await supabaseAdmin
    .from('cdm_picks')
    .select(`
      id, points_finaux, bonus_type, bonus_player_id,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      user:cdm_users!user_id ( id, auth_id, username, photo_url ),
      player_a1:cdm_players!player_a1_id ( name, position ),
      player_a2:cdm_players!player_a2_id ( name, position ),
      player_b1:cdm_players!player_b1_id ( name, position ),
      player_b2:cdm_players!player_b2_id ( name, position )
    `)
    .eq('match_id', params.match_id)
    .order('points_finaux', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const playerIds = [...new Set(
    (picks ?? []).flatMap(p =>
      [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id].filter(Boolean) as string[]
    )
  )]

  const { data: ratings } = playerIds.length > 0
    ? await supabaseAdmin
        .from('cdm_player_ratings')
        .select('player_id, fotmob_rating, goals, assists, penalty_saved')
        .eq('match_id', params.match_id)
        .in('player_id', playerIds)
    : { data: [] }

  return Response.json({ picks: picks ?? [], ratings: ratings ?? [] })
}
