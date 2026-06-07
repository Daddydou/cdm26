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

const POSTE_MAP: Record<string, string> = {
  'Gardien':   'GK',
  'Défenseur': 'DEF',
  'Milieu':    'MID',
  'Attaquant': 'FWD',
}

// Noms CSV → noms en base (uniquement les cas qui diffèrent)
const EQUIPE_MAP: Record<string, string> = {
  'Tchéquie': 'République Tchèque',
}

interface CsvRow {
  groupe:  string
  equipe:  string
  poste:   string
  joueur:  string
  club:    string
  retenu:  string
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const [header, ...dataLines] = lines
  const keys = header.split(',') as (keyof CsvRow)[]
  return dataLines.map(line => {
    const values = line.split(',')
    return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? ''])) as CsvRow
  })
}

async function main() {
  const csvPath = resolve(__dirname, 'data/effectifs_cdm2026_retenus.csv')
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'))

  // Grouper par équipe CSV
  const byEquipe = new Map<string, CsvRow[]>()
  for (const row of rows) {
    if (!byEquipe.has(row.equipe)) byEquipe.set(row.equipe, [])
    byEquipe.get(row.equipe)!.push(row)
  }

  // Récupère toutes les nations en base
  const { data: nations, error: nErr } = await admin.from('cdm_nations').select('id, name')
  if (nErr) { console.error('Erreur nations:', nErr.message); process.exit(1) }
  const nationByName = new Map((nations ?? []).map(n => [n.name, n.id]))

  let nationsTraitees = 0
  let joueursInseres = 0
  const nonTrouvees: string[] = []

  for (const [csvEquipe, joueurs] of byEquipe) {
    const dbName = EQUIPE_MAP[csvEquipe] ?? csvEquipe
    const nationId = nationByName.get(dbName)

    if (!nationId) {
      nonTrouvees.push(csvEquipe)
      continue
    }

    // Suppression de tous les joueurs existants
    const { error: delErr } = await admin
      .from('cdm_players')
      .delete()
      .eq('nation_id', nationId)
    if (delErr) {
      console.error(`  ✗ ${csvEquipe}: erreur suppression:`, delErr.message)
      continue
    }

    // Insertion des 26 joueurs
    const rows = joueurs.map(j => ({
      name:      j.joueur,
      position:  POSTE_MAP[j.poste] ?? j.poste,
      nation_id: nationId,
      photo_url: null,
    }))
    const { error: insErr } = await admin.from('cdm_players').insert(rows)
    if (insErr) {
      console.error(`  ✗ ${csvEquipe}: erreur insertion:`, insErr.message)
      continue
    }

    console.log(`  ✓ ${dbName.padEnd(28)} ${joueurs.length} joueurs`)
    nationsTraitees++
    joueursInseres += joueurs.length
  }

  console.log(`\n✅ Nations traitées  : ${nationsTraitees} / ${byEquipe.size}`)
  console.log(`✅ Joueurs insérés   : ${joueursInseres}`)
  if (nonTrouvees.length) {
    console.warn(`\n⚠️  Nations non trouvées en base :`)
    nonTrouvees.forEach(n => console.warn(`   - ${n}`))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
