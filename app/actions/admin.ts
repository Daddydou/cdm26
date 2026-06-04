'use server'

import { createAdminClient } from '@/lib/supabase/admin'

type PickSummary = {
  pick_id: string
  user_id: string
  username: string
  points_bruts: number
  points_finaux: number
}

type ComputeResult = {
  error: string | null
  computed: PickSummary[]
}

export async function computeMatchPoints(matchId: string): Promise<ComputeResult> {
  const admin = createAdminClient()

  // ── 1. Match ──
  const { data: match, error: matchError } = await admin
    .from('cdm_matches')
    .select('id, points_multiplier')
    .eq('id', matchId)
    .single()

  if (matchError || !match) return { error: 'Match introuvable', computed: [] }

  const multiplier: number = match.points_multiplier ?? 1

  // ── 2. Picks verrouillés ──
  const { data: picks, error: picksError } = await admin
    .from('cdm_picks')
    .select(`
      id, user_id, bonus_type, bonus_player_id,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      user:cdm_users!user_id ( id, username )
    `)
    .eq('match_id', matchId)
    .eq('is_locked', true)

  if (picksError) return { error: picksError.message, computed: [] }
  if (!picks || picks.length === 0) return { error: null, computed: [] }

  // ── 3. Notes FotMob pour tous les joueurs impliqués ──
  const allPlayerIds = [...new Set(
    picks.flatMap(p => [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id]
      .filter(Boolean) as string[])
  )]

  const { data: ratingsData, error: ratingsError } = await admin
    .from('cdm_player_ratings')
    .select('player_id, fotmob_rating')
    .eq('match_id', matchId)
    .in('player_id', allPlayerIds)

  if (ratingsError) return { error: ratingsError.message, computed: [] }

  const ratingsMap: Record<string, number> = Object.fromEntries(
    (ratingsData ?? []).map(r => [r.player_id, r.fotmob_rating ?? 0])
  )

  // ── 4. Calcul par pick ──
  const computed: PickSummary[] = []
  const affectedUserIds = new Set<string>()

  for (const pick of picks) {
    const ids = [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id]
      .filter(Boolean) as string[]

    const isBouclier = pick.bonus_type === 'bouclier'
    const isCapitaineBis = pick.bonus_type === 'capitaine_bis'
    const isDoubleMise = pick.bonus_type === 'double_mise'
    const bonusPlayerId = pick.bonus_player_id

    let total = 0
    for (const id of ids) {
      let rating = ratingsMap[id] ?? 0
      if (isBouclier && rating < 5) rating = 5
      if (id === bonusPlayerId) rating *= isCapitaineBis ? 2 : 1.5
      total += rating
    }

    if (isDoubleMise) total *= 2

    const points_bruts  = Math.round(total * 100) / 100
    const points_finaux = Math.round(total * multiplier * 100) / 100

    const { error: updateError } = await admin
      .from('cdm_picks')
      .update({ points_bruts, points_finaux })
      .eq('id', pick.id)

    if (updateError) {
      console.error('[computeMatchPoints] update pick error:', pick.id, updateError.message)
      continue
    }

    affectedUserIds.add(pick.user_id)
    computed.push({
      pick_id:       pick.id,
      user_id:       pick.user_id,
      username:      (pick.user as any)?.username ?? pick.user_id,
      points_bruts,
      points_finaux,
    })
  }

  // ── 5. Recalcul total_points pour chaque user concerné ──
  for (const userId of affectedUserIds) {
    const { data: allPicks, error: sumError } = await admin
      .from('cdm_picks')
      .select('points_finaux')
      .eq('user_id', userId)
      .not('points_finaux', 'is', null)

    if (sumError) {
      console.error('[computeMatchPoints] sum error for user', userId, sumError.message)
      continue
    }

    const total_points = (allPicks ?? []).reduce((acc, p) => acc + (p.points_finaux ?? 0), 0)

    await admin
      .from('cdm_users')
      .update({ total_points: Math.round(total_points * 100) / 100 })
      .eq('id', userId)
  }

  console.log('[computeMatchPoints] ✓', computed.length, 'picks calculés pour match', matchId)
  return { error: null, computed }
}
