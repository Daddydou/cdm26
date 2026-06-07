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

// ── Correspondances noms JSON → noms en base ──────────────────────────────────
const NAME_MAP: Record<string, string> = {}
// Les noms JSON correspondent exactement aux noms en base — pas de mapping nécessaire

// Normalisation pour correspondance floue
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

type PlayerDef = { name: string; position: string }

async function main() {
  const jsonPath = resolve(__dirname, '../app/scripts/data/worldcup-squads-official-2026.json')
  const squads = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, PlayerDef[]>

  // Dédoublonner les joueurs par nation (garde la première occurrence par nom)
  for (const [nation, players] of Object.entries(squads)) {
    const seen = new Set<string>()
    squads[nation] = players.filter(p => {
      if (seen.has(p.name)) return false
      seen.add(p.name)
      return true
    })
  }

  // Récupère toutes les nations en base
  const { data: dbNations, error: nErr } = await admin.from('cdm_nations').select('id, name')
  if (nErr) { console.error('Erreur nations:', nErr.message); process.exit(1) }

  const nationByName = new Map((dbNations ?? []).map(n => [n.name, n.id]))
  const nationByNorm = new Map((dbNations ?? []).map(n => [norm(n.name), n.id]))

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`REIMPORT COMPLET — ${Object.keys(squads).length} nations dans le JSON`)
  console.log(`${'═'.repeat(64)}\n`)

  // Récupère tous les IDs de joueurs référencés dans des picks
  const { data: allPicks } = await admin
    .from('cdm_picks')
    .select('player_a1_id, player_a2_id, player_b1_id, player_b2_id, bonus_player_id')

  const pickedIds = new Set<string>()
  for (const pick of allPicks ?? []) {
    for (const id of [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id, pick.bonus_player_id]) {
      if (id) pickedIds.add(id)
    }
  }
  console.log(`Joueurs référencés dans des picks : ${pickedIds.size}`)

  let nationsDone   = 0
  let totalInserted = 0
  let totalKept     = 0
  const notFound: string[] = []
  const errors: string[]   = []

  for (const [jsonName, players] of Object.entries(squads)) {
    const mapped   = NAME_MAP[jsonName] ?? jsonName
    const nationId = nationByName.get(mapped) ?? nationByNorm.get(norm(mapped))

    if (!nationId) {
      notFound.push(jsonName)
      continue
    }

    const dbName = (dbNations ?? []).find(n => n.id === nationId)?.name ?? mapped

    // Joueurs actuels pour cette nation
    const { data: existing } = await admin
      .from('cdm_players')
      .select('id, name')
      .eq('nation_id', nationId)

    const existingByName = new Map((existing ?? []).map(p => [p.name, p.id]))
    const existingIds    = (existing ?? []).map(p => p.id)

    // IDs non référencés par des picks → supprimables
    const deletableIds = existingIds.filter(id => !pickedIds.has(id))

    if (deletableIds.length > 0) {
      const { error: delErr } = await admin.from('cdm_players').delete().in('id', deletableIds)
      if (delErr) {
        errors.push(`DELETE ${dbName}: ${delErr.message}`)
        continue
      }
    }

    // Joueurs gardés (référencés dans des picks)
    const keptIds   = existingIds.filter(id => pickedIds.has(id))
    const keptNames = new Set((existing ?? []).filter(p => pickedIds.has(p.id)).map(p => p.name))

    // Nouveaux joueurs à insérer (pas déjà en base par nom)
    const toInsert = players.filter(p => !existingByName.has(p.name))

    if (toInsert.length > 0) {
      const rows = toInsert.map(p => ({
        name:      p.name,
        position:  p.position,
        nation_id: nationId,
        photo_url: null,
      }))
      const { error: insErr } = await admin.from('cdm_players').insert(rows)
      if (insErr) {
        errors.push(`INSERT ${dbName}: ${insErr.message}`)
        continue
      }
    }

    const kept = keptIds.length
    const note = kept > 0
      ? ` (${kept} gardés picks, ${toInsert.length} nouveaux)`
      : ` (${toInsert.length} nouveaux, ${deletableIds.length} supprimés)`

    console.log(`  ✓ ${dbName.padEnd(35)} ${players.length} joueurs${note}`)
    nationsDone++
    totalInserted += toInsert.length
    totalKept     += kept
  }

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`✅ Nations traitées  : ${nationsDone} / ${Object.keys(squads).length}`)
  console.log(`✅ Joueurs insérés   : ${totalInserted}`)
  if (totalKept > 0) console.log(`ℹ️  Joueurs gardés    : ${totalKept} (référencés dans des picks)`)
  if (notFound.length) {
    console.warn(`\n⚠️  Nations JSON non trouvées en base (${notFound.length}) :`)
    notFound.forEach(n => console.warn(`   - ${n}`))
  }
  if (errors.length) {
    console.error(`\n✗ Erreurs (${errors.length}) :`)
    errors.forEach(e => console.error(`   ${e}`))
  }
  console.log('═'.repeat(64))
}

main().catch(err => { console.error(err); process.exit(1) })
