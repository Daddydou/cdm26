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
      id, user_id, bonus_type, bonus_player_id, bonus_data,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      user:cdm_users!user_id ( id, username )
    `)
    .eq('match_id', matchId)

  if (picksError) return { error: picksError.message, computed: [] }
  if (!picks || picks.length === 0) return { error: null, computed: [] }

  // Collecte tous les IDs joueurs + le 3e homme si troisieme_homme
  const allPlayerIds = [...new Set(
    picks.flatMap(p => {
      const ids: string[] = [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id]
        .filter(Boolean) as string[]
      if (p.bonus_type === 'troisieme_homme') {
        const bd = p.bonus_data as { player_id?: string } | null
        if (bd?.player_id) ids.push(bd.player_id)
      }
      return ids
    })
  )]

  const { data: ratingsData, error: ratingsError } = await admin
    .from('cdm_player_ratings')
    .select('player_id, fotmob_rating, goals, assists, penalty_saved')
    .eq('match_id', matchId)
    .in('player_id', allPlayerIds)

  if (ratingsError) return { error: ratingsError.message, computed: [] }

  type RatingFull = { fotmob_rating: number; goals: number; assists: number; penalty_saved: boolean }
  const ratingsMap: Record<string, RatingFull> = Object.fromEntries(
    (ratingsData ?? []).map(r => [r.player_id, {
      fotmob_rating: r.fotmob_rating ?? 0,
      goals:         (r.goals as number)         ?? 0,
      assists:       (r.assists as number)        ?? 0,
      penalty_saved: (r.penalty_saved as boolean) ?? false,
    }])
  )

  // ── Passe 1 : calcul points_bruts (sans all_in) ───────────────────────────
  type Calc = { pick: typeof picks[0]; points_bruts: number; isAllIn: boolean; mise: number }
  const calcs: Calc[] = []

  for (const pick of picks) {
    const bd              = pick.bonus_data as Record<string, unknown> | null
    const bonusPlayerId   = pick.bonus_player_id
    const isBouclier      = pick.bonus_type === 'bouclier'
    const isCapitaineBis  = pick.bonus_type === 'capitaine_bis'
    const isDoubleMise    = pick.bonus_type === 'double_mise'
    const isSniper        = pick.bonus_type === 'sniper'
    const isPasseur       = pick.bonus_type === 'passeur_genie'
    const isMur           = pick.bonus_type === 'mur'
    const isAllIn         = pick.bonus_type === 'all_in'

    let ids: string[] = [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id]
      .filter(Boolean) as string[]

    if (pick.bonus_type === 'troisieme_homme' && bd?.player_id) {
      ids = [...ids, bd.player_id as string]
    }

    let total      = 0
    let hasGoal    = false
    let hasAssist  = false
    let hasPenSave = false

    for (const id of ids) {
      const r = ratingsMap[id]
      let rating = r?.fotmob_rating ?? 0

      if (isBouclier && rating < 5) rating = 5
      if (id === bonusPlayerId)      rating *= isCapitaineBis ? 2 : 1.5

      total += rating

      if ((r?.goals ?? 0) > 0)   hasGoal    = true
      if ((r?.assists ?? 0) > 0) hasAssist  = true
      if (r?.penalty_saved)      hasPenSave = true
    }

    if (isSniper && hasGoal)    total += 3
    if (isPasseur && hasAssist) total += 3
    if (isMur && hasPenSave)    total += 5
    if (isDoubleMise)           total *= 2

    calcs.push({
      pick,
      points_bruts: Math.round(total * 100) / 100,
      isAllIn,
      mise: isAllIn ? Math.min(10, Math.max(1, Number(bd?.amount ?? 5))) : 0,
    })
  }

  // ── Passe 2 : All-In (comparaison avec moyenne des autres) ────────────────
  const nonAllInAvg = (() => {
    const base = calcs.filter(c => !c.isAllIn)
    if (base.length === 0) return 0
    return base.reduce((sum, c) => sum + c.points_bruts, 0) / base.length
  })()

  const computed: PickSummary[] = []
  const affectedUserIds = new Set<string>()

  for (const calc of calcs) {
    let { points_bruts } = calc

    if (calc.isAllIn) {
      points_bruts = calc.points_bruts > nonAllInAvg
        ? Math.round((calc.points_bruts + calc.mise) * 100) / 100
        : Math.round(Math.max(0, calc.points_bruts - calc.mise) * 100) / 100
    }

    const points_finaux = Math.round(points_bruts * multiplier * 100) / 100

    const { error: updateError } = await admin
      .from('cdm_picks')
      .update({ points_bruts, points_finaux })
      .eq('id', calc.pick.id)

    if (updateError) {
      console.error('[computeMatchPoints] update pick error:', calc.pick.id, updateError.message)
      continue
    }

    affectedUserIds.add(calc.pick.user_id)
    computed.push({
      pick_id:  calc.pick.id,
      user_id:  calc.pick.user_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      username: (calc.pick.user as any)?.username ?? calc.pick.user_id,
      points_bruts,
      points_finaux,
    })
  }

  // Recalcule total_points depuis zéro (idempotent : appeler N fois donne le même résultat)
  for (const userId of affectedUserIds) {
    const { data: allPicks } = await admin
      .from('cdm_picks')
      .select('points_finaux')
      .eq('user_id', userId)
      .not('points_finaux', 'is', null)

    const newTotal = allPicks?.reduce((sum, p) => sum + (p.points_finaux ?? 0), 0) ?? 0

    await admin
      .from('cdm_users')
      .update({ total_points: Math.round(newTotal * 100) / 100 })
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
