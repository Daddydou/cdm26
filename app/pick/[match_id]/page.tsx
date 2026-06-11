import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PickClient from './PickClient'

export default async function PickPage({ params }: { params: { match_id: string } }) {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()
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

  const homeNation = match.home_nation as unknown as { id: string; name: string }
  const awayNation = match.away_nation as unknown as { id: string; name: string }

  console.log('[pick/page] homeNation:', homeNation, '| awayNation:', awayNation)

  // 2. Profil CDM
  const { data: cdmUser, error: cdmUserError } = user
    ? await supabase.from('cdm_users').select('id').eq('auth_id', user.id).single()
    : { data: null, error: null }

  console.log('[pick/page] 2. cdmUser:', cdmUser, '| error:', cdmUserError?.message)

  console.log('[pick/page] homeNation.id:', homeNation?.id, '| awayNation.id:', awayNation?.id)

  // 3. Requêtes parallèles
  const [playersARes, playersBRes, pickRes, usedRes, bonusRes, x15Res] = await Promise.all([
    supabase
      .from('cdm_players')
      .select('id, name, position, shirt_number, photo_url')
      .eq('nation_id', homeNation.id)
      .order('name', { ascending: true }),

    supabase
      .from('cdm_players')
      .select('id, name, position, shirt_number, photo_url')
      .eq('nation_id', awayNation.id)
      .order('name', { ascending: true }),

    cdmUser
      ? supabase
          .from('cdm_picks')
          .select('player_a1_id, player_a2_id, player_b1_id, player_b2_id, bonus_player_id, bonus_type, bonus_data')
          .eq('match_id', params.match_id)
          .eq('user_id', cdmUser.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Bug 3 : exclut les joueurs confirmés non-joués (actually_played = false)
    cdmUser
      ? supabaseAdmin
          .from('cdm_player_usage')
          .select('player_id, actually_played')
          .eq('user_id', cdmUser.id)
          .neq('match_id', params.match_id)
      : Promise.resolve({ data: [], error: null }),

    cdmUser
      ? supabase
          .from('cdm_user_bonuses')
          .select('id, bonus_type, remaining_uses')
          .eq('user_id', cdmUser.id)
          .gt('remaining_uses', 0)
      : Promise.resolve({ data: [], error: null }),

    // Nombre de picks passés où l'user a désigné un joueur ×2
    cdmUser
      ? supabase
          .from('cdm_picks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', cdmUser.id)
          .not('bonus_player_id', 'is', null)
      : Promise.resolve({ count: 0, data: null, error: null }),
  ])

  const playersA = playersARes.data ?? []
  const playersB = playersBRes.data ?? []

  console.log('[pick/page] 3a. playersA:', playersA.length, '| playersB:', playersB.length, '| errA:', playersARes.error?.message, '| errB:', playersBRes.error?.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('[pick/page] 3b. existingPick:', JSON.stringify(pickRes.data), '| error:', (pickRes as any).error?.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('[pick/page] 3c. usedPlayers count:', usedRes.data?.length, '| error:', (usedRes as any).error?.message)
  console.log('[pick/page] usedPlayers raw:', usedRes.data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('[pick/page] 3d. bonuses count:', bonusRes.data?.length, '| error:', (bonusRes as any).error?.message, (bonusRes as any).error?.code)
  console.log('[pick/page] 3d. cdmUser.id used for bonus query:', cdmUser?.id ?? 'null')

  const usedPlayerIds: string[] = (usedRes.data ?? [])
    .filter((r: { actually_played: boolean | null }) => r.actually_played !== false)
    .map((r: { player_id: string }) => r.player_id)

  console.log('[pick/page] usedPlayerIds count:', usedPlayerIds.length, '| ids:', usedPlayerIds)
  console.log('[pick/page] usedPlayerIds:', [...usedPlayerIds])

  // ── Bug 2 : Espion — picks des autres si bonus actif et match pas encore locké ──
  const existingPick = pickRes.data ?? null
  const isEspion = existingPick?.bonus_type === 'espion'

  let espionPicks: Array<{
    id: string
    bonus_type: string | null
    bonus_player_id: string | null
    player_a1: { name: string; position: string } | null
    player_a2: { name: string; position: string } | null
    player_b1: { name: string; position: string } | null
    player_b2: { name: string; position: string } | null
    user: { username: string; photo_url: string | null } | null
  }> | null = null

  if (isEspion && match.status === 'a_venir' && cdmUser) {
    const { data } = await supabaseAdmin
      .from('cdm_picks')
      .select(`
        id, bonus_type, bonus_player_id,
        player_a1:cdm_players!player_a1_id(name, position),
        player_a2:cdm_players!player_a2_id(name, position),
        player_b1:cdm_players!player_b1_id(name, position),
        player_b2:cdm_players!player_b2_id(name, position),
        user:cdm_users!user_id(username, photo_url)
      `)
      .eq('match_id', params.match_id)
      .neq('user_id', cdmUser.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    espionPicks = (data as any) ?? null
    console.log('[pick/page] espion: other picks found:', data?.length ?? 0)
  }

  const isReadOnly =
    match.status !== 'a_venir' || new Date(match.kickoff_at) <= new Date()

  console.log('[pick/page] isReadOnly:', isReadOnly, '| status:', match.status, '| kickoff_at:', match.kickoff_at)
  console.log('[pick/page] playersA count:', playersA?.length, 'premier joueur:', playersA?.[0]?.name)
  console.log('[pick/page] playersB count:', playersB?.length)

  return (
    <PickClient
      match={{ ...match, home_nation: homeNation, away_nation: awayNation }}
      playersA={playersA}
      playersB={playersB}
      existingPick={existingPick}
      usedPlayerIds={usedPlayerIds}
      userBonuses={bonusRes.data ?? []}
      isReadOnly={isReadOnly}
      x15Used={x15Res.count ?? 0}
      espionPicks={espionPicks}
    />
  )
}
