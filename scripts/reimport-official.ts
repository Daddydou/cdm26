import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Charge .env.local ──────────────────────────────────────────────────────────
const envFile = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!URL || !KEY) {
  console.error('Variables manquantes: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

type PlayerDef = { name: string; position: string }

async function main() {
  // 1. Charge le JSON
  const jsonPath = resolve(__dirname, '../app/scripts/data/worldcup-squads-official.json')
  const squads = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, PlayerDef[]>

  // 2. Récupère les nations en base
  const { data: nations, error: nErr } = await admin.from('cdm_nations').select('id, name')
  if (nErr) { console.error('Erreur nations:', nErr.message); process.exit(1) }
  const nationByName = new Map((nations ?? []).map(n => [n.name, n.id]))

  let imported = 0
  let totalPlayers = 0
  const unknown: string[] = []

  for (const [nationName, players] of Object.entries(squads)) {
    const nationId = nationByName.get(nationName)
    if (!nationId) { unknown.push(nationName); continue }

    // Joueurs actuels en base pour cette nation
    const { data: existing } = await admin
      .from('cdm_players')
      .select('id, name')
      .eq('nation_id', nationId)
    const existingById  = new Map((existing ?? []).map(p => [p.id, p.name]))
    const existingByName = new Map((existing ?? []).map(p => [p.name, p.id]))

    // IDs de joueurs référencés par des picks pour cette nation
    const existingIds = [...existingById.keys()]
    const pickedIds = new Set<string>()
    if (existingIds.length > 0) {
      const { data: picks } = await admin
        .from('cdm_picks')
        .select('player_a1_id, player_a2_id, player_b1_id, player_b2_id, bonus_player_id')
        .or(
          ['player_a1_id', 'player_a2_id', 'player_b1_id', 'player_b2_id', 'bonus_player_id']
            .map(col => `${col}.in.(${existingIds.join(',')})`)
            .join(',')
        )
      for (const pick of picks ?? []) {
        for (const id of [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id, pick.bonus_player_id]) {
          if (id && existingById.has(id)) pickedIds.add(id)
        }
      }
    }

    // Suppression des joueurs non référencés par des picks
    const deletableIds = existingIds.filter(id => !pickedIds.has(id))
    if (deletableIds.length > 0) {
      const { error: delErr } = await admin
        .from('cdm_players')
        .delete()
        .in('id', deletableIds)
      if (delErr) {
        console.error(`  ✗ ${nationName}: erreur suppression:`, delErr.message)
        continue
      }
    }

    // Insertion des nouveaux joueurs (ceux qui ne sont pas déjà en base par nom)
    const newPlayers = players.filter(p => !existingByName.has(p.name))
    if (newPlayers.length > 0) {
      const rows = newPlayers.map(p => ({
        name:      p.name,
        position:  p.position,
        nation_id: nationId,
        photo_url: null,
      }))
      const { error: insErr } = await admin.from('cdm_players').insert(rows)
      if (insErr) {
        console.error(`  ✗ ${nationName}: erreur insertion:`, insErr.message)
        continue
      }
    }

    const kept = pickedIds.size
    const note = kept > 0 ? ` (${kept} gardés — picks existants, ${newPlayers.length} nouveaux)` : ''
    console.log(`  ✓ ${nationName.padEnd(25)} ${players.length} joueurs${note}`)
    imported++
    totalPlayers += players.length
  }

  console.log(`\n✅ Nations importées : ${imported} / ${Object.keys(squads).length}`)
  console.log(`✅ Joueurs insérés   : ${totalPlayers}`)
  if (unknown.length) {
    console.warn(`\n⚠️  Nations non trouvées en base :`)
    unknown.forEach(n => console.warn(`   - ${n}`))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
