'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'


type PickState = { error: string | null }

export async function savePick(prevState: PickState, formData: FormData): Promise<PickState> {
  // Client user pour les lectures (auth + vérifications)
  const supabase = createClient()
  // Client admin pour les écritures (bypasse RLS)
  const admin = createAdminClient()

  // ── Auth ──
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('[savePick] auth.getUser:', user?.email ?? 'null', '| error:', authError?.message)
  if (!user) return { error: 'Non authentifié' }

  // ── FormData ──
  const matchId      = formData.get('match_id')        as string
  const homePlayer1  = formData.get('player_a1_id')    as string
  const homePlayer2  = formData.get('player_a2_id')    as string
  const awayPlayer1  = formData.get('player_b1_id')    as string
  const awayPlayer2  = formData.get('player_b2_id')    as string
  const starPlayer    = (formData.get('bonus_player_id') as string) || null
  const bonusTypeName = (formData.get('bonus_type')     as string) || null  // ex: 'mur', 'sniper'
  const userBonusId   = (formData.get('user_bonus_id')  as string) || null  // UUID de cdm_user_bonuses
  const bonusDataRaw = (formData.get('bonus_data')      as string) || '{}'
  let bonusData: Record<string, unknown> = {}
  try { bonusData = JSON.parse(bonusDataRaw) } catch { /* JSON malformé ignoré */ }

  console.log('[savePick] formData:', { matchId, homePlayer1, homePlayer2, awayPlayer1, awayPlayer2, starPlayer, bonusTypeName, userBonusId, bonusData })

  if (!matchId || !homePlayer1 || !homePlayer2 || !awayPlayer1 || !awayPlayer2) {
    return { error: 'Sélectionnez 2 joueurs par équipe avant de valider' }
  }

  // ── 1. Vérifier que le match est encore ouvert ──
  const { data: match, error: matchError } = await supabase
    .from('cdm_matches')
    .select('status, kickoff_at, nation_a_id, nation_b_id')
    .eq('id', matchId)
    .single()

  console.log('[savePick] 1. match:', match, '| error:', matchError?.message)

  if (!match) return { error: 'Match introuvable' }
  if (match.status !== 'a_venir' || new Date(match.kickoff_at) <= new Date()) {
    return { error: 'Ce match a déjà commencé, les picks sont fermés.' }
  }

  // ── 2. Profil CDM (cdm_users.id, pas auth.uid) ──
  const { data: cdmUser, error: cdmUserError } = await supabase
    .from('cdm_users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  console.log('[savePick] 2. cdmUser:', cdmUser, '| error:', cdmUserError?.message)
  if (!cdmUser) return { error: 'Profil utilisateur introuvable' }

  // ── 3. Valider que les joueurs appartiennent aux bonnes nations ──
  const mainIds = [homePlayer1, homePlayer2, awayPlayer1, awayPlayer2]

  const { data: players, error: playersError } = await supabase
    .from('cdm_players')
    .select('id, nation_id')
    .in('id', mainIds)

  console.log('[savePick] 3. players:', players, '| error:', playersError?.message)

  const nationById = new Map(players?.map(p => [p.id, p.nation_id]) ?? [])

  if (nationById.get(homePlayer1) !== match.nation_a_id ||
      nationById.get(homePlayer2) !== match.nation_a_id) {
    console.log('[savePick] 3. FAIL: joueurs A invalides — attendu nation_a_id:', match.nation_a_id, 'reçu:', nationById.get(homePlayer1), nationById.get(homePlayer2))
    return { error: "Joueurs invalides pour l'équipe A" }
  }
  if (nationById.get(awayPlayer1) !== match.nation_b_id ||
      nationById.get(awayPlayer2) !== match.nation_b_id) {
    console.log('[savePick] 3. FAIL: joueurs B invalides — attendu nation_b_id:', match.nation_b_id, 'reçu:', nationById.get(awayPlayer1), nationById.get(awayPlayer2))
    return { error: "Joueurs invalides pour l'équipe B" }
  }

  // ── 4. Joueur étoile parmi les 4 sélections ──
  if (starPlayer && !mainIds.includes(starPlayer)) {
    console.log('[savePick] 4. FAIL: starPlayer', starPlayer, 'hors des 4 sélections')
    return { error: 'Le joueur étoile doit être parmi vos 4 sélections' }
  }

  // ── 5. Vérifier l'absence d'utilisation dans un autre match ──
  // Exclut les joueurs confirmés non-joués (actually_played = false)
  const { data: usedRows } = await admin
    .from('cdm_player_usage')
    .select('player_id, actually_played')
    .eq('user_id', cdmUser.id)
    .neq('match_id', matchId)
    .not('actually_played', 'eq', false)

  console.log('[savePick] 5. usedRows:', usedRows)

  const usedSet = new Set(
    usedRows?.filter(r => r.actually_played !== false).map(r => r.player_id) ?? []
  )
  const conflict = mainIds.find(id => usedSet.has(id))
  if (conflict) {
    console.log('[savePick] 5. FAIL: joueur déjà utilisé:', conflict)
    return { error: 'Un ou plusieurs joueurs ont déjà été utilisés dans un match précédent' }
  }

  // ── 6. Upsert cdm_picks (admin — bypasse RLS) ──
  const pickPayload = {
    user_id:         cdmUser.id,
    match_id:        matchId,
    player_a1_id:    homePlayer1,
    player_a2_id:    homePlayer2,
    player_b1_id:    awayPlayer1,
    player_b2_id:    awayPlayer2,
    bonus_player_id: starPlayer,
    bonus_type:      bonusTypeName,
    bonus_data:      Object.keys(bonusData).length > 0 ? bonusData : null,
  }
  console.log('[savePick] 6. upsert cdm_picks payload:', pickPayload)

  const { error: pickError } = await admin
    .from('cdm_picks')
    .upsert(pickPayload, { onConflict: 'user_id,match_id' })

  console.log('[savePick] 6. cdm_picks upsert error:', pickError?.message, pickError?.code, pickError?.details)
  if (pickError) return { error: 'Erreur lors de la sauvegarde des picks' }

  // ── 7. cdm_player_usage — delete + re-insert (admin) ──
  const { error: deleteError } = await admin
    .from('cdm_player_usage')
    .delete()
    .eq('user_id', cdmUser.id)
    .eq('match_id', matchId)

  console.log('[savePick] 7. player_usage delete error:', deleteError?.message)

  const usageRows = mainIds.map((playerId, i) => ({
    user_id:         cdmUser.id,
    player_id:       playerId,
    match_id:        matchId,
    role:            i < 2 ? 'titulaire_a' : 'titulaire_b',
    actually_played: null,
  }))
  console.log('[savePick] 7. player_usage insert rows:', usageRows)

  const { error: usageError } = await admin
    .from('cdm_player_usage')
    .insert(usageRows)

  if (usageError) {
    console.error('[savePick] 7. ⚠ player_usage insert FAILED:', usageError.message, usageError.code, usageError.details)
  } else {
    console.log('[savePick] 7. player_usage insert OK — rows:', usageRows.length)
  }

  // ── 8. Décrémenter remaining_uses si bonus activé (admin) ──
  if (userBonusId) {
    const { data: bonusRow, error: bonusReadError } = await admin
      .from('cdm_user_bonuses')
      .select('remaining_uses')
      .eq('id', userBonusId)
      .single()

    console.log('[savePick] 8. bonus row:', bonusRow, '| read error:', bonusReadError?.message)

    if (bonusRow && bonusRow.remaining_uses > 0) {
      const { error: bonusUpdateError } = await admin
        .from('cdm_user_bonuses')
        .update({ remaining_uses: bonusRow.remaining_uses - 1 })
        .eq('id', userBonusId)

      console.log('[savePick] 8. bonus decrement error:', bonusUpdateError?.message)
    }
  }

  console.log('[savePick] ✓ Succès')
  return { error: null }
}
