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

/**
 * Calcule les points de tous les picks d'un match.
 *
 * Toute la logique de scoring vit dans la fonction SQL compute_pick_points :
 * elle est la source de vérité unique pour les 10 règles de bonus. Ce code ne
 * fait que l'appeler pick par pick et remonter un résumé pour l'UI admin.
 *
 * Écritures assurées côté base, à ne pas dupliquer ici :
 *  - compute_pick_points écrit elle-même points_bruts et points_finaux ;
 *  - le trigger trg_sync_total_points (AFTER INSERT/UPDATE/DELETE ON cdm_picks)
 *    resynchronise cdm_users.total_points à chaque écriture.
 */
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
    .select('id, user_id, user:cdm_users!user_id ( id, username )')
    .eq('match_id', matchId)

  if (picksError) return { error: picksError.message, computed: [] }
  if (!picks || picks.length === 0) return { error: null, computed: [] }

  const computed: PickSummary[] = []

  for (const pick of picks) {
    const { data: pointsFinaux, error: rpcError } = await admin
      .rpc('compute_pick_points', { p_pick_id: pick.id })

    if (rpcError) {
      console.error('[computeMatchPoints] rpc error:', pick.id, rpcError.message)
      continue
    }

    const points_finaux = Number(pointsFinaux ?? 0)

    computed.push({
      pick_id:  pick.id,
      user_id:  pick.user_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      username: (pick.user as any)?.username ?? pick.user_id,
      // même dérivation que la SQL : points_bruts = points_finaux / multiplier
      points_bruts: multiplier !== 0 ? points_finaux / multiplier : 0,
      points_finaux,
    })
  }

  console.log('[computeMatchPoints] ✓', computed.length, 'picks calculés pour match', matchId)
  return { error: null, computed }
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