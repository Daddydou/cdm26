import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PickClient from './PickClient'

const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

export default async function PickPage({ params }: { params: { match_id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  console.log('[pick/page] match_id:', params.match_id, '| user:', user?.email ?? 'non connecté')

  // 1. Match + nations via FK join
  const { data: match, error: matchError } = await supabase
    .from('cdm_matches')
    .select(`
      id, kickoff_at, status,
      home_nation:nation_a_id ( id, name ),
      away_nation:nation_b_id ( id, name )
    `)
    .eq('id', params.match_id)
    .single()

  console.log('[pick/page] 1. match:', JSON.stringify(match), '| error:', matchError?.message, matchError?.code)

  if (!match) notFound()

  const homeNation = match.home_nation as { id: string; name: string }
  const awayNation = match.away_nation as { id: string; name: string }

  console.log('[pick/page] homeNation:', homeNation, '| awayNation:', awayNation)

  // 2. Profil CDM
  const { data: cdmUser, error: cdmUserError } = user
    ? await supabase.from('cdm_users').select('id').eq('auth_id', user.id).single()
    : { data: null, error: null }

  console.log('[pick/page] 2. cdmUser:', cdmUser, '| error:', cdmUserError?.message)

  // 3. Requêtes parallèles
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
      : Promise.resolve({ data: null, error: null }),

    cdmUser
      ? supabase
          .from('cdm_player_usage')
          .select('player_id')
          .eq('user_id', cdmUser.id)
          .neq('match_id', params.match_id)
          .or('actually_played.is.null,actually_played.eq.true')
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from('cdm_bonuses')
      .select('id, name, description, icon')
      .order('name'),
  ])

  console.log('[pick/page] 3a. players count:', playersRes.data?.length, '| error:', playersRes.error?.message)
  console.log('[pick/page] 3b. existingPick:', JSON.stringify(pickRes.data), '| error:', (pickRes as any).error?.message)
  console.log('[pick/page] 3c. usedPlayers count:', usedRes.data?.length, '| error:', (usedRes as any).error?.message)
  console.log('[pick/page] 3d. bonuses count:', bonusRes.data?.length, '| error:', bonusRes.error?.message)
  console.log('[pick/page] 3d. bonuses data:', JSON.stringify(bonusRes.data))

  const allPlayers = (playersRes.data ?? []).sort(
    (a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
  )

  const playersA = allPlayers.filter(p => p.nation_id === homeNation.id)
  const playersB = allPlayers.filter(p => p.nation_id === awayNation.id)

  console.log('[pick/page] playersA:', playersA.length, '| playersB:', playersB.length)

  const usedPlayerIds: string[] = (usedRes.data ?? []).map((r: { player_id: string }) => r.player_id)

  const isReadOnly =
    match.status !== 'a_venir' || new Date(match.kickoff_at) <= new Date()

  console.log('[pick/page] isReadOnly:', isReadOnly, '| status:', match.status, '| kickoff_at:', match.kickoff_at)

  return (
    <PickClient
      match={{ ...match, home_nation: homeNation, away_nation: awayNation }}
      playersA={playersA}
      playersB={playersB}
      existingPick={pickRes.data ?? null}
      usedPlayerIds={usedPlayerIds}
      userBonuses={(bonusRes.data ?? []) as any}
      isReadOnly={isReadOnly}
    />
  )
}
