import type { createAdminClient } from '@/lib/supabase/admin'

export type PlayerRatingRow = {
  player_id: string
  match_id: string
  fotmob_rating: number | null
  goals: number | null
  assists: number | null
  penalty_saved: boolean | null
}

const PAGE_SIZE = 1000

/**
 * Charge les notes de plusieurs matchs, en paginant.
 *
 * PostgREST plafonne toute réponse à 1000 lignes (max-rows). Une page qui
 * interroge beaucoup de matchs d'un coup dépasse largement ce seuil — la
 * réponse est alors tronquée SANS erreur, et les matchs au-delà de la limite
 * s'affichent simplement sans notes. C'est un plafond de transport : il
 * s'applique quel que soit le client, service role compris.
 *
 * L'ordre explicite (match_id, player_id) est indispensable : sans tri stable,
 * la pagination par .range() peut renvoyer deux fois la même ligne ou en sauter.
 */
export async function fetchRatingsForMatches(
  admin: ReturnType<typeof createAdminClient>,
  matchIds: string[],
  playerIds?: string[],
): Promise<PlayerRatingRow[]> {
  if (matchIds.length === 0) return []
  if (playerIds && playerIds.length === 0) return []

  const rows: PlayerRatingRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin
      .from('cdm_player_ratings')
      .select('player_id, match_id, fotmob_rating, goals, assists, penalty_saved')
      .in('match_id', matchIds)

    if (playerIds) query = query.in('player_id', playerIds)

    const { data, error } = await query
      .order('match_id', { ascending: true })
      .order('player_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[fetchRatingsForMatches]', error.message)
      break
    }

    rows.push(...((data ?? []) as PlayerRatingRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}
