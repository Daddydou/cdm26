import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import squadsData from '../app/scripts/data/worldcup-squads.json'

// Charge .env.local manuellement sans dotenv
const envFile = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!URL || !KEY) {
  console.error('Variables manquantes: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

type PlayerDef = { name: string; position: string; shirt_number: number }

async function main() {
  // 1. Supprimer tous les joueurs
  console.log('Suppression des joueurs existants...')
  const { error: delErr, count } = await admin
    .from('cdm_players')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (delErr) { console.error('Erreur delete:', delErr.message); process.exit(1) }
  console.log(`→ ${count ?? '?'} joueurs supprimés`)

  // 2. Charger les nations depuis la DB
  const { data: nations, error: nErr } = await admin.from('cdm_nations').select('id, name')
  if (nErr) { console.error('Erreur nations:', nErr.message); process.exit(1) }

  const nationIdByName = new Map<string, string>((nations ?? []).map(n => [n.name, n.id]))

  // 3. Insérer joueur par nation
  const squads = squadsData as Record<string, PlayerDef[]>
  let total = 0
  const unknown: string[] = []

  for (const [nationName, players] of Object.entries(squads)) {
    const nationId = nationIdByName.get(nationName)
    if (!nationId) { unknown.push(nationName); continue }
    if (players.length === 0) continue

    const rows = players.map(p => ({ name: p.name, position: p.position, nation_id: nationId, photo_url: null }))
    const { error } = await admin.from('cdm_players').insert(rows)
    if (error) { console.error(`Erreur insert ${nationName}:`, error.message); continue }

    console.log(`  ${nationName}: ${rows.length} joueurs`)
    total += rows.length
  }

  console.log(`\nTerminé: ${total} joueurs insérés`)
  if (unknown.length) console.warn('Nations inconnues en DB:', unknown.join(', '))
}

main()
