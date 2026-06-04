import { createAdminClient } from '@/lib/supabase/admin'
import squadsData from './data/worldcup-squads.json'

type PlayerDef = { name: string; position: string; shirt_number: number }

export type SquadsImportResult = {
  error?: string
  total_players_inserted: number
  total_players_skipped: number
  by_nation: Record<string, { inserted: number; skipped: number; unknown: boolean }>
}

export async function importSquads(): Promise<SquadsImportResult> {
  const admin = createAdminClient()
  const by_nation: SquadsImportResult['by_nation'] = {}
  let total_players_inserted = 0
  let total_players_skipped = 0

  // ── 1. Récupère toutes les nations depuis la DB ──────────────────────────────

  const { data: nations, error: nationsError } = await admin
    .from('cdm_nations')
    .select('id, name')

  if (nationsError) {
    return { error: `Chargement nations: ${nationsError.message}`, total_players_inserted: 0, total_players_skipped: 0, by_nation }
  }

  const nationIdByName = new Map<string, string>(
    (nations ?? []).map(n => [n.name, n.id])
  )

  // ── 2. Récupère tous les joueurs existants (nation_id + name) ───────────────

  const { data: existingPlayers, error: playersError } = await admin
    .from('cdm_players')
    .select('name, nation_id')

  if (playersError) {
    return { error: `Chargement joueurs: ${playersError.message}`, total_players_inserted: 0, total_players_skipped: 0, by_nation }
  }

  const existingPlayerKeys = new Set<string>(
    (existingPlayers ?? []).map(p => `${p.nation_id}_${p.name}`)
  )

  // ── 3. Insère joueur par nation ─────────────────────────────────────────────

  const squads = squadsData as Record<string, PlayerDef[]>

  for (const [nationName, players] of Object.entries(squads)) {
    const nationId = nationIdByName.get(nationName)

    if (!nationId) {
      by_nation[nationName] = { inserted: 0, skipped: 0, unknown: true }
      continue
    }

    if (players.length === 0) {
      by_nation[nationName] = { inserted: 0, skipped: 0, unknown: false }
      continue
    }

    const toInsert = players
      .filter(p => !existingPlayerKeys.has(`${nationId}_${p.name}`))
      .map(p => ({
        name:      p.name,
        position:  p.position,
        nation_id: nationId,
        photo_url: null,
      }))

    const skipped = players.length - toInsert.length

    if (toInsert.length > 0) {
      const { error } = await admin.from('cdm_players').insert(toInsert)
      if (error) {
        return {
          error: `Insert joueurs ${nationName}: ${error.message}`,
          total_players_inserted, total_players_skipped, by_nation,
        }
      }
      // Met à jour le set pour les inserts suivants (idempotence)
      for (const p of toInsert) {
        existingPlayerKeys.add(`${nationId}_${p.name}`)
      }
    }

    by_nation[nationName] = { inserted: toInsert.length, skipped, unknown: false }
    total_players_inserted += toInsert.length
    total_players_skipped  += skipped
  }

  return { total_players_inserted, total_players_skipped, by_nation }
}
