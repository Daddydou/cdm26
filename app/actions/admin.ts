'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── computeMatchPoints ───────────────────────────────────────────────────────

export async function computeMatchPoints(matchId: string): Promise<ComputeResult> {
  const admin = createAdminClient()

  const { data: match, error: matchError } = await admin
    .from('cdm_matches')
    .select('id, points_multiplier')
    .eq('id', matchId)
    .single()

  if (matchError || !match) return { error: 'Match introuvable', computed: [] }

  const multiplier: number = match.points_multiplier ?? 1

  const { data: picks, error: picksError } = await admin
    .from('cdm_picks')
    .select(`
      id, user_id, bonus_type, bonus_player_id,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      user:cdm_users!user_id ( id, username )
    `)
    .eq('match_id', matchId)

  if (picksError) return { error: picksError.message, computed: [] }
  if (!picks || picks.length === 0) return { error: null, computed: [] }

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

  const computed: PickSummary[] = []
  const affectedUserIds = new Set<string>()

  for (const pick of picks) {
    const ids = [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id]
      .filter(Boolean) as string[]

    const isBouclier    = pick.bonus_type === 'bouclier'
    const isCapitaineBis = pick.bonus_type === 'capitaine_bis'
    const isDoubleMise  = pick.bonus_type === 'double_mise'
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

// ─── triggerComputePoints ─────────────────────────────────────────────────────

export async function triggerComputePoints(formData: FormData) {
  const matchId = formData.get('match_id') as string
  const result = await computeMatchPoints(matchId)
  if (result.error) {
    redirect(`/admin/matchs?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`/admin/matchs?msg=${result.computed.length}+picks+calculés`)
}

// ─── createMatch ──────────────────────────────────────────────────────────────

export async function createMatch(formData: FormData) {
  const admin = createAdminClient()
  const raw = formData.get('kickoff_at') as string
  const kickoff_at = new Date(raw).toISOString()
  const multiplier = parseFloat(formData.get('points_multiplier') as string)

  const { error } = await admin.from('cdm_matches').insert({
    nation_a_id:      formData.get('nation_a_id') as string,
    nation_b_id:      formData.get('nation_b_id') as string,
    kickoff_at,
    phase:            (formData.get('phase') as string) || null,
    status:           'a_venir',
    points_multiplier: isNaN(multiplier) ? 1 : multiplier,
  })

  if (error) redirect(`/admin/matchs/nouveau?error=${encodeURIComponent(error.message)}`)
  redirect('/admin/matchs?msg=Match+créé')
}

// ─── updateMatch ──────────────────────────────────────────────────────────────

export async function updateMatch(formData: FormData) {
  const admin = createAdminClient()
  const matchId   = formData.get('match_id') as string
  const raw       = formData.get('kickoff_at') as string
  const kickoff_at = new Date(raw).toISOString()
  const multiplier = parseFloat(formData.get('points_multiplier') as string)
  const rawA = formData.get('score_a') as string
  const rawB = formData.get('score_b') as string

  const { error } = await admin.from('cdm_matches').update({
    nation_a_id:      formData.get('nation_a_id') as string,
    nation_b_id:      formData.get('nation_b_id') as string,
    kickoff_at,
    phase:            (formData.get('phase') as string) || null,
    status:           formData.get('status') as string,
    score_a:          rawA !== '' ? parseInt(rawA) : null,
    score_b:          rawB !== '' ? parseInt(rawB) : null,
    points_multiplier: isNaN(multiplier) ? 1 : multiplier,
  }).eq('id', matchId)

  if (error) redirect(`/admin/matchs/${matchId}/edit?error=${encodeURIComponent(error.message)}`)
  redirect('/admin/matchs?msg=Match+modifié')
}

// ─── saveRatings ──────────────────────────────────────────────────────────────

export async function saveRatings(formData: FormData) {
  const admin = createAdminClient()
  const matchId   = formData.get('match_id') as string
  const playerIds = (formData.get('player_ids') as string).split(',').filter(Boolean)

  const rows = playerIds.map(id => ({
    player_id:     id,
    match_id:      matchId,
    fotmob_rating: parseFloat(formData.get(`rating_${id}`) as string) || null,
    goals:         parseInt(formData.get(`goals_${id}`) as string)   || 0,
    assists:       parseInt(formData.get(`assists_${id}`) as string)  || 0,
    penalty_saved: formData.get(`penalty_saved_${id}`) === 'on',
  }))

  const { error } = await admin
    .from('cdm_player_ratings')
    .upsert(rows, { onConflict: 'player_id,match_id' })

  if (error) redirect(`/admin/notes?matchId=${matchId}&error=${encodeURIComponent(error.message)}`)
  redirect(`/admin/notes?matchId=${matchId}&saved=1`)
}

// ─── addPlayer ────────────────────────────────────────────────────────────────

export async function addPlayer(formData: FormData) {
  const admin = createAdminClient()
  const { error } = await admin.from('cdm_players').insert({
    name:      formData.get('name') as string,
    nation_id: formData.get('nation_id') as string,
    position:  formData.get('position') as string,
    photo_url: null,
  })

  if (error) redirect(`/admin/joueurs?error=${encodeURIComponent(error.message)}`)
  redirect('/admin/joueurs?msg=Joueur+ajouté')
}
