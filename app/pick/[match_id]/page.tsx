import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PickClient from './PickClient'

const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

export default async function PickPage({ params }: { params: { match_id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Match + nations via FK join
  const { data: match } = await supabase
    .from('cdm_matches')
    .select(`
      id, match_date, status,
      home_nation:home_nation_id ( id, name ),
      away_nation:away_nation_id ( id, name )
    `)
    .eq('id', params.match_id)
    .single()

  if (!match) notFound()

  const homeNation = match.home_nation as { id: string; name: string }
  const awayNation = match.away_nation as { id: string; name: string }

  // Profil CDM
  const { data: cdmUser } = user
    ? await supabase.from('cdm_users').select('id').eq('auth_id', user.id).single()
    : { data: null }

  const [playersRes, pickRes, usedRes, bonusRes] = await Promise.all([
    supabase
      .from('cdm_players')
      .select('id, name, position, photo_url, nation_id')
      .in('nation_id', [homeNation.id, awayNation.id]),

    cdmUser
      ? supabase
          .from('cdm_picks')
          .select('home_player1_id, home_player2_id, away_player1_id, away_player2_id, home_sub_id, away_sub_id, star_player_id, active_bonus_id')
          .eq('match_id', params.match_id)
          .eq('user_id', cdmUser.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    cdmUser
      ? supabase
          .from('cdm_player_usage')
          .select('player_id')
          .eq('user_id', cdmUser.id)
          .neq('match_id', params.match_id)
          .or('actually_played.is.null,actually_played.eq.true')
      : Promise.resolve({ data: [] }),

    cdmUser
      ? supabase
          .from('cdm_user_bonuses')
          .select('id, remaining_uses, bonus:cdm_bonuses ( id, name, description, icon )')
          .eq('user_id', cdmUser.id)
          .gt('remaining_uses', 0)
      : Promise.resolve({ data: [] }),
  ])

  const allPlayers = (playersRes.data ?? []).sort(
    (a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
  )

  const homePlayers = allPlayers.filter(p => p.nation_id === homeNation.id)
  const awayPlayers = allPlayers.filter(p => p.nation_id === awayNation.id)

  const usedPlayerIds: string[] = (usedRes.data ?? []).map((r: { player_id: string }) => r.player_id)

  const isReadOnly =
    match.status !== 'a_venir' || new Date(match.match_date) <= new Date()

  return (
    <PickClient
      match={{ ...match, home_nation: homeNation, away_nation: awayNation }}
      homePlayers={homePlayers}
      awayPlayers={awayPlayers}
      existingPick={pickRes.data ?? null}
      usedPlayerIds={usedPlayerIds}
      userBonuses={(bonusRes.data ?? []) as any}
      isReadOnly={isReadOnly}
    />
  )
}
