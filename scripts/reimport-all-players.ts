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

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Récupère tous les joueurs d'une nation (paginé, pas de limite 1000)
async function getNationPlayers(nationId: string): Promise<{ id: string; name: string }[]> {
  const rows: { id: string; name: string }[] = []
  let from = 0
  while (true) {
    const { data, error } = await admin
      .from('cdm_players')
      .select('id,name')
      .eq('nation_id', nationId)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

type PlayerDef = { name: string; position: string }

async function main() {
  const jsonPath = resolve(__dirname, '../app/scripts/data/worldcup-squads-official-2026.json')
  const squads = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, PlayerDef[]>

  // Dédoublonner par nom dans chaque nation
  for (const nation of Object.keys(squads)) {
    const seen = new Set<string>()
    squads[nation] = squads[nation].filter(p => {
      if (seen.has(p.name)) return false
      seen.add(p.name)
      return true
    })
  }

  // ── IDs protégés (picks + usage) ───────────────────────────────────────────
  const referencedIds = new Set<string>()

  // cdm_picks — paginé
  let from = 0
  while (true) {
    const { data } = await admin
      .from('cdm_picks')
      .select('player_a1_id,player_a2_id,player_b1_id,player_b2_id,bonus_player_id')
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const pick of data) {
      for (const id of [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id, pick.bonus_player_id]) {
        if (id) referencedIds.add(id)
      }
    }
    if (data.length < 1000) break
    from += 1000
  }

  // cdm_player_usage — paginé, ignore si table absente
  from = 0
  while (true) {
    const { data, error } = await admin
      .from('cdm_player_usage')
      .select('player_id')
      .range(from, from + 999)
    if (error) break  // table absente ou autre erreur → on ignore
    if (!data || data.length === 0) break
    for (const row of data) {
      if (row.player_id) referencedIds.add(row.player_id)
    }
    if (data.length < 1000) break
    from += 1000
  }

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`REIMPORT COMPLET — 48 nations | ${referencedIds.size} joueurs protégés`)
  console.log('═'.repeat(64))

  // ── Nations en base ─────────────────────────────────────────────────────────
  const { data: dbNations, error: nErr } = await admin.from('cdm_nations').select('id,name')
  if (nErr) { console.error('Erreur nations:', nErr.message); process.exit(1) }

  const nationByName = new Map((dbNations ?? []).map(n => [n.name, n.id]))
  const nationByNorm = new Map((dbNations ?? []).map(n => [norm(n.name), n.id]))

  let nationsDone   = 0
  let totalDeleted  = 0
  let totalInserted = 0
  let totalKept     = 0
  const notFound: string[] = []
  const errors: string[]   = []

  for (const [jsonName, players] of Object.entries(squads)) {
    const nationId = nationByName.get(jsonName) ?? nationByNorm.get(norm(jsonName))
    if (!nationId) { notFound.push(jsonName); continue }

    const dbName = (dbNations ?? []).find(n => n.id === nationId)?.name ?? jsonName

    // Joueurs actuels pour cette nation (paginé → pas de limite)
    let nationPlayers: { id: string; name: string }[]
    try {
      nationPlayers = await getNationPlayers(nationId)
    } catch (e: any) {
      errors.push(`READ ${dbName}: ${e.message}`)
      continue
    }

    // Sépare protégés vs supprimables
    const keepPlayers = nationPlayers.filter(p => referencedIds.has(p.id))
    const deleteIds   = nationPlayers.filter(p => !referencedIds.has(p.id)).map(p => p.id)
    const keepNames   = new Set(keepPlayers.map(p => p.name))

    // Suppression des joueurs non protégés (par lots de 500)
    for (let i = 0; i < deleteIds.length; i += 500) {
      const { error } = await admin.from('cdm_players').delete().in('id', deleteIds.slice(i, i + 500))
      if (error) { errors.push(`DELETE ${dbName}: ${error.message}`); break }
    }

    // Insertion des joueurs du JSON absents des joueurs protégés
    const toInsert = players.filter(p => !keepNames.has(p.name))
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
        console.log(`  ✗ ${dbName.padEnd(35)} erreur: ${insErr.message}`)
        continue
      }
    }

    const note = keepPlayers.length > 0
      ? ` (${keepPlayers.length} gardés picks, ${toInsert.length} insérés, ${deleteIds.length} supprimés)`
      : ` (${toInsert.length} insérés, ${deleteIds.length} supprimés)`
    console.log(`  ✓ ${dbName.padEnd(35)} ${players.length} joueurs${note}`)

    nationsDone++
    totalDeleted  += deleteIds.length
    totalInserted += toInsert.length
    totalKept     += keepPlayers.length
  }

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`✅ Nations traitées  : ${nationsDone} / ${Object.keys(squads).length}`)
  console.log(`✅ Joueurs insérés   : ${totalInserted}`)
  console.log(`🗑️  Joueurs supprimés : ${totalDeleted}`)
  if (totalKept > 0) console.log(`ℹ️  Joueurs gardés    : ${totalKept} (référencés dans des picks)`)
  if (notFound.length) {
    console.warn(`\n⚠️  Nations non trouvées en base (${notFound.length}) :`)
    notFound.forEach(n => console.warn(`   - ${n}`))
  }
  if (errors.length) {
    console.error(`\n✗ Erreurs (${errors.length}) :`)
    errors.forEach(e => console.error(`   ${e}`))
  }
  console.log('═'.repeat(64))
}

main().catch(err => { console.error(err); process.exit(1) })
