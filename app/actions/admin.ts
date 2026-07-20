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

  // Collecte tous les IDs joueurs + bonus_player_id pour troisieme_homme
  const allPlayerIds = [...new Set(
    picks.flatMap(p => {
      const ids: string[] = [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id]
        .filter(Boolean) as string[]
      if (p.bonus_type === 'troisieme_homme') {
        if (p.bonus_player_id) ids.push(p.bonus_player_id)
        // fallback legacy : certains picks stockaient le 3e joueur dans bonus_data.player_id
        const bd = p.bonus_data as { player_id?: string } | null
        if (bd?.player_id && bd.player_id !== p.bonus_player_id) ids.push(bd.player_id)
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

  // ── Passe 1 : points_bruts (4 joueurs pickés) + points_finaux_base (bonus appliqué) ──
  type Calc = {
    pick:               typeof picks[0]
    points_bruts:       number   // somme des 4 joueurs, sans bonus de type
    points_finaux_base: number   // après bonus, avant multiplier et all_in
    isAllIn:            boolean
    mise:               number
  }
  const calcs: Calc[] = []

  for (const pick of picks) {
    const bd           = pick.bonus_data as Record<string, unknown> | null
    const isBouclier   = pick.bonus_type === 'bouclier'
    const isDoubleMise = pick.bonus_type === 'double_mise'
    const isSniper     = pick.bonus_type === 'sniper'
    const isPasseur    = pick.bonus_type === 'passeur_genie'
    const isMur        = pick.bonus_type === 'mur'
    const isAllIn      = pick.bonus_type === 'all_in'
    const isTroisiemeH = pick.bonus_type === 'troisieme_homme'
    // Joueur ×2 : stocké via bonus_player_id seul, bonus_type restant null (ou portant
    // un autre bonus classique). Le 3e homme réutilise bonus_player_id pour un 5e joueur
    // ajouté — on l'exclut. Même condition que la fonction SQL compute_pick_points et que
    // l'affichage des badges (MatchPickRow / MatchClient / profil).
    const isJoueurX2   = pick.bonus_player_id != null && pick.bonus_type !== 'troisieme_homme'

    const ids = [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id]
      .filter(Boolean) as string[]

    // points_bruts : somme des ratings des 4 joueurs pickés uniquement
    let points_bruts = 0
    let totalGoals   = 0
    let totalAssists = 0
    let hasPenSave   = false

    for (const id of ids) {
      const r = ratingsMap[id]
      let rating = r?.fotmob_rating ?? 0

      if (isBouclier && rating < 5)                       rating = 5   // plancher à 5
      if (isJoueurX2 && id === pick.bonus_player_id)      rating *= 2  // ×2 joueur désigné

      points_bruts += rating
      totalGoals   += r?.goals   ?? 0
      totalAssists += r?.assists ?? 0
      if (r?.penalty_saved) hasPenSave = true
    }

    // points_finaux_base : applique le bonus_type sur points_bruts
    let pf = points_bruts

    if (isTroisiemeH) {
      // 3e joueur : bonus_player_id est la source canonique ; bonus_data.player_id = fallback
      const r3Id = pick.bonus_player_id
                || (pick.bonus_data as { player_id?: string } | null)?.player_id
      if (r3Id) pf += ratingsMap[r3Id]?.fotmob_rating ?? 0
    }
    if (isSniper)            pf += totalGoals   * 3   // +3 par but
    if (isPasseur)           pf += totalAssists * 3   // +3 par passe décisive
    if (isMur && hasPenSave) pf += 8                  // +8 si penalty arrêté
    if (isDoubleMise)        pf *= 2                   // ×2

    calcs.push({
      pick,
      points_bruts:       Math.round(points_bruts * 100) / 100,
      points_finaux_base: Math.round(pf * 100) / 100,
      isAllIn,
      mise: isAllIn ? Math.min(10, Math.max(1, Number(bd?.amount ?? 5))) : 0,
    })
  }

  // ── Passe 2 : All-In (comparaison avec moyenne des non-all-in) ────────────
  const nonAllInAvg = (() => {
    const base = calcs.filter(c => !c.isAllIn)
    if (base.length === 0) return 0
    return base.reduce((sum, c) => sum + c.points_bruts, 0) / base.length
  })()

  const computed: PickSummary[] = []
  const affectedUserIds = new Set<string>()

  for (const calc of calcs) {
    let points_bruts  = calc.points_bruts
    let points_finaux = calc.points_finaux_base

    if (calc.isAllIn) {
      const adjusted = calc.points_bruts > nonAllInAvg
        ? Math.round((calc.points_bruts + calc.mise) * 100) / 100
        : Math.round(Math.max(0, calc.points_bruts - calc.mise) * 100) / 100
      points_bruts  = adjusted
      points_finaux = adjusted
    }

    points_finaux = Math.round(points_finaux * multiplier * 100) / 100

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
