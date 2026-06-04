'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type PickState = { error: string | null }

export async function savePick(prevState: PickState, formData: FormData): Promise<PickState> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const matchId     = formData.get('match_id')        as string
  const homePlayer1 = formData.get('player_a1_id')    as string
  const homePlayer2 = formData.get('player_a2_id')    as string
  const awayPlayer1 = formData.get('player_b1_id')    as string
  const awayPlayer2 = formData.get('player_b2_id')    as string
  const homeSub     = (formData.get('sub_a_id')        as string) || null
  const awaySub     = (formData.get('sub_b_id')        as string) || null
  const starPlayer  = (formData.get('bonus_player_id') as string) || null
  const bonusId     = (formData.get('bonus_type')      as string) || null
  const bonusDataRaw = (formData.get('bonus_data')     as string) || '{}'
  let bonusData: Record<string, unknown> = {}
  try { bonusData = JSON.parse(bonusDataRaw) } catch { /* ignore malformed JSON */ }

  if (!homePlayer1 || !homePlayer2 || !awayPlayer1 || !awayPlayer2) {
    return { error: 'Sélectionnez 2 joueurs par équipe avant de valider' }
  }

  // 1. Vérifier que le match est encore ouvert
  const { data: match } = await supabase
    .from('cdm_matches')
    .select('status, kickoff_at, nation_a_id, nation_b_id')
    .eq('id', matchId)
    .single()

  if (!match) return { error: 'Match introuvable' }
  if (match.status !== 'a_venir') return { error: 'Les picks sont fermés pour ce match' }
  if (new Date(match.kickoff_at) <= new Date()) return { error: 'Ce match a déjà commencé' }

  // 2. Profil CDM de l'utilisateur
  const { data: cdmUser } = await supabase
    .from('cdm_users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!cdmUser) return { error: 'Profil utilisateur introuvable' }

  // 3. Valider que les joueurs appartiennent aux bonnes nations
  const mainIds = [homePlayer1, homePlayer2, awayPlayer1, awayPlayer2]

  const { data: players } = await supabase
    .from('cdm_players')
    .select('id, nation_id')
    .in('id', mainIds)

  const nationById = new Map(players?.map(p => [p.id, p.nation_id]) ?? [])

  if (nationById.get(homePlayer1) !== match.nation_a_id ||
      nationById.get(homePlayer2) !== match.nation_a_id) {
    return { error: "Joueurs invalides pour l'équipe domicile" }
  }
  if (nationById.get(awayPlayer1) !== match.nation_b_id ||
      nationById.get(awayPlayer2) !== match.nation_b_id) {
    return { error: "Joueurs invalides pour l'équipe extérieur" }
  }

  // 4. Joueur étoile parmi les 4 sélections principales
  if (starPlayer && !mainIds.includes(starPlayer)) {
    return { error: 'Le joueur étoile doit être parmi vos 4 sélections principales' }
  }

  // 5. Vérifier l'absence d'utilisation dans un match précédent
  const { data: usedRows } = await supabase
    .from('cdm_player_usage')
    .select('player_id')
    .eq('user_id', cdmUser.id)
    .neq('match_id', matchId)
    .or('actually_played.is.null,actually_played.eq.true')

  const usedIds = new Set(usedRows?.map(r => r.player_id) ?? [])
  if (mainIds.some(id => usedIds.has(id))) {
    return { error: 'Un ou plusieurs joueurs ont déjà été utilisés dans un match précédent' }
  }

  // 6. Upsert cdm_picks
  const { error: pickError } = await supabase
    .from('cdm_picks')
    .upsert({
      user_id:          cdmUser.id,
      match_id:         matchId,
      home_player1_id:  homePlayer1,
      home_player2_id:  homePlayer2,
      away_player1_id:  awayPlayer1,
      away_player2_id:  awayPlayer2,
      home_sub_id:      homeSub,
      away_sub_id:      awaySub,
      star_player_id:   starPlayer,
      active_bonus_id:  bonusId,
      bonus_data:       Object.keys(bonusData).length > 0 ? bonusData : null,
    }, { onConflict: 'user_id,match_id' })

  if (pickError) return { error: 'Erreur lors de la sauvegarde des picks' }

  // 7. Mettre à jour cdm_player_usage (delete + re-insert pour ce match)
  await supabase
    .from('cdm_player_usage')
    .delete()
    .eq('user_id', cdmUser.id)
    .eq('match_id', matchId)

  await supabase
    .from('cdm_player_usage')
    .insert(mainIds.map(playerId => ({
      user_id:        cdmUser.id,
      player_id:      playerId,
      match_id:       matchId,
      actually_played: null,
    })))

  // 8. Enregistrer l'utilisation du bonus si activé
  if (bonusId) {
    await supabase
      .from('cdm_user_bonuses')
      .upsert({
        user_id:   cdmUser.id,
        bonus_id:  bonusId,
        match_id:  matchId,
      }, { onConflict: 'user_id,bonus_id,match_id' })
  }

  redirect('/')
}
