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

// ── Correspondances CSV (Wikipedia FR) → noms en base ─────────────────────────
const CSV_TO_DB: Record<string, string> = {
  // Accents manquants
  'Egypte':                        'Égypte',
  'Etats-Unis':                    'États-Unis',
  'Emirats arabes unis':           'Émirats arabes unis',
  'Émirats arabes unis':           'Émirats arabes unis',
  'Equateur':                      'Équateur',
  'Écosse':                        'Écosse',
  // Capitalisation
  'Arabie saoudite':               'Arabie Saoudite',
  'Corée du sud':                  'Corée du Sud',
  'Pays de galles':                'Pays de Galles',
  // Variantes courtes/longues
  'Turquie':                       'Türkiye',
  'Centrafrique':                  'République centrafricaine',
  'République centrafricaine':     'République centrafricaine',
  'Afrique du Sud':                'Afrique du Sud',
  'Nouvelle-Zélande':              'Nouvelle-Zélande',
  'Nouvelle Zélande':              'Nouvelle-Zélande',
  'Costa Rica':                    'Costa Rica',
  'Pays-Bas':                      'Pays-Bas',
  'Corée du Nord':                 'Corée du Nord',
  'Corée du Sud':                  'Corée du Sud',
  "Côte d'Ivoire":                 "Côte d'Ivoire",
  'Arabie Saoudite':               'Arabie Saoudite',
  'États-Unis':                    'États-Unis',
}

// ── Marqueurs de position ──────────────────────────────────────────────────────
const POSITION_MAP: Record<string, string> = {
  'Gardiens de but':    'GK',
  'Gardien de but':     'GK',
  'Défenseurs':         'DEF',
  'Défenseur':          'DEF',
  'Milieux de terrain': 'MID',
  'Milieu de terrain':  'MID',
  'Milieux':            'MID',
  'Attaquants':         'FWD',
  'Attaquant':          'FWD',
}

// ── Patterns de lignes à ignorer ───────────────────────────────────────────────
const IGNORE_PREFIXES = [
  'Article détaillé',
  'La sélection',
  'Numéro',
  'N°',
  'Sélectionneur',
  'Entraîneur',
  'NB :',
  'Groupe ',
  'Effectifs',
  '#',
  'Pos.',
  'Poste',
  'Note :',
  'Sources',
  'Joueur',
]

function shouldIgnore(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  return IGNORE_PREFIXES.some(p => t.startsWith(p))
}

// ── Parser CSV (gère les guillemets) ──────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  fields.push(current.trim())
  return fields
}

// ── Nettoyage d'un nom de joueur ───────────────────────────────────────────────
function cleanName(raw: string): string {
  return raw
    .replace(/\s*\(.*?\)\s*/g, '')   // parenthèses : "(capitaine)", "(blessé)"...
    .replace(/\s*\[.*?\]\s*/g, '')   // crochets Wikipedia
    .replace(/\s*\*+\s*$/g, '')      // astérisques en fin
    .replace(/^\d+\s+/, '')          // numéro en début si mal découpé
    .trim()
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Player     = { name: string; position: string; shirt_number: number | null }
type NationData = { csvName: string; players: Player[] }

// ── Parseur principal ──────────────────────────────────────────────────────────
function parseCompositions(content: string): NationData[] {
  const entries: NationData[] = []
  let currentNation: string | null = null
  let currentPosition = 'FWD'
  let currentPlayers: Player[] = []

  function flush() {
    if (currentNation && currentPlayers.length > 0) {
      entries.push({ csvName: currentNation, players: [...currentPlayers] })
    }
  }

  for (const rawLine of content.split('\n')) {
    const row = parseCSVLine(rawLine)
    const col0 = row[0]?.trim() ?? ''
    const col1 = row[1]?.trim() ?? ''

    // Ligne vide
    if (!col0 && !col1) continue

    // Ignorer si col0 correspond à un pattern
    if (shouldIgnore(col0) && !col1) continue
    if (shouldIgnore(col0) && col0) {
      // Sauf si col0 est vide et col1 est un nom de joueur — géré plus bas
      if (col0) continue
    }

    // Ignorer si col1 contient un pattern (sélectionneur avec valeur en col1)
    if (!col0 && shouldIgnore(col1)) continue

    const restEmpty = row.slice(1).every(c => !c.trim())

    // ── Marqueur de position (col0 = label, reste vide) ──
    if (POSITION_MAP[col0] !== undefined && restEmpty) {
      currentPosition = POSITION_MAP[col0]
      continue
    }

    // ── En-tête de nation (col0 non vide, reste vide, pas un marqueur de position) ──
    if (col0 && restEmpty && POSITION_MAP[col0] === undefined && !shouldIgnore(col0)) {
      flush()
      currentNation = col0
      currentPosition = 'FWD'
      currentPlayers = []
      continue
    }

    // ── Joueur avec numéro de maillot (col0 = entier, col1 = nom) ──
    if (/^\d+$/.test(col0) && col1) {
      const name = cleanName(col1)
      if (name && !shouldIgnore(name)) {
        currentPlayers.push({ name, position: currentPosition, shirt_number: parseInt(col0) })
      }
      continue
    }

    // ── Joueur sans numéro (col0 vide, col1 = nom) ──
    if (!col0 && col1) {
      const name = cleanName(col1)
      if (name && !shouldIgnore(name)) {
        currentPlayers.push({ name, position: currentPosition, shirt_number: null })
      }
      continue
    }
  }
  flush()

  return entries
}

// ── Normalise un nom pour comparaison floue ────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry')

  // Lecture du CSV
  const csvPath = resolve(__dirname, 'data/Composition.csv')
  let content: string
  try {
    content = readFileSync(csvPath, 'utf8')
  } catch {
    console.error(`\n✗ Fichier CSV introuvable : ${csvPath}`)
    console.error('  Copie-le avec : cp /mnt/user-data/uploads/Composition.csv scripts/data/Composition.csv')
    process.exit(1)
  }

  // Parse
  const parsed = parseCompositions(content)

  // Récupère les nations en base
  const { data: dbNations, error: nErr } = await admin.from('cdm_nations').select('id, name')
  if (nErr) { console.error('Erreur nations:', nErr.message); process.exit(1) }

  const nationById = new Map((dbNations ?? []).map(n => [n.name, n.id]))
  const nationByNorm = new Map((dbNations ?? []).map(n => [normalize(n.name), n.id]))

  // ── Affichage du résumé de parsing ────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PARSING CSV — ${parsed.length} nations trouvées`)
  console.log('─'.repeat(60))
  for (const { csvName, players } of parsed) {
    const gk  = players.filter(p => p.position === 'GK').length
    const def = players.filter(p => p.position === 'DEF').length
    const mid = players.filter(p => p.position === 'MID').length
    const fwd = players.filter(p => p.position === 'FWD').length
    console.log(`  ${csvName.padEnd(30)} ${String(players.length).padStart(2)} joueurs  [GK:${gk} DEF:${def} MID:${mid} FWD:${fwd}]`)
  }

  // ── Calcul correspondances ─────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log('CORRESPONDANCES CSV → BASE')
  console.log('─'.repeat(60))

  const notFound: string[] = []
  const toImport: Array<{ csvName: string; dbName: string; nationId: string; players: Player[] }> = []

  for (const { csvName, players } of parsed) {
    const mapped = CSV_TO_DB[csvName] ?? csvName
    const nationId = nationById.get(mapped) ?? nationByNorm.get(normalize(mapped))
    const dbName   = (dbNations ?? []).find(n => n.id === nationId)?.name ?? ''

    if (!nationId) {
      notFound.push(csvName)
      console.log(`  ✗ ${csvName.padEnd(32)} → NON TROUVÉ EN BASE`)
    } else {
      const mark = mapped !== csvName ? ` (via mapping: ${mapped})` : ''
      console.log(`  ✓ ${csvName.padEnd(32)} → ${dbName}${mark}`)
      toImport.push({ csvName, dbName, nationId, players: players.slice(0, 26) })
    }
  }

  // ── Nations DB sans CSV ────────────────────────────────────────────────────
  const dbNamesWithCSV = new Set(toImport.map(x => x.dbName))
  const dbWithoutCSV   = (dbNations ?? []).filter(n => !dbNamesWithCSV.has(n.name))
  if (dbWithoutCSV.length) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`NATIONS EN BASE SANS CSV (${dbWithoutCSV.length})`)
    console.log('─'.repeat(60))
    for (const n of dbWithoutCSV) console.log(`  - ${n.name}`)
  }

  if (dryRun) {
    console.log('\n[--dry] Simulation terminée — aucune modification en base.')
    return
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`)
  console.log('IMPORT EN BASE')
  console.log('─'.repeat(60))

  let importedNations = 0
  let totalPlayers    = 0
  const errors: string[] = []

  for (const { csvName, dbName, nationId, players } of toImport) {
    // Suppression des joueurs existants pour cette nation
    const { error: delErr } = await admin
      .from('cdm_players')
      .delete()
      .eq('nation_id', nationId)

    if (delErr) {
      errors.push(`DELETE ${csvName}: ${delErr.message}`)
      console.log(`  ✗ ${dbName}: erreur suppression`)
      continue
    }

    // Insertion des nouveaux joueurs
    const rows = players.map(p => ({
      name:         p.name,
      position:     p.position,
      nation_id:    nationId,
      shirt_number: p.shirt_number,
      photo_url:    null,
    }))

    const { error: insErr } = await admin.from('cdm_players').insert(rows)
    if (insErr) {
      errors.push(`INSERT ${csvName}: ${insErr.message}`)
      console.log(`  ✗ ${dbName}: erreur insertion`)
      continue
    }

    console.log(`  ✓ ${dbName.padEnd(30)} ${rows.length} joueurs`)
    importedNations++
    totalPlayers += rows.length
  }

  // ── Résumé final ───────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅ Nations importées : ${importedNations} / ${toImport.length}`)
  console.log(`✅ Joueurs insérés   : ${totalPlayers}`)
  if (notFound.length) {
    console.warn(`⚠️  Nations CSV non trouvées en base (${notFound.length}) :`)
    notFound.forEach(n => console.warn(`   - ${n}`))
  }
  if (errors.length) {
    console.error(`\n✗ Erreurs (${errors.length}) :`)
    errors.forEach(e => console.error(`   ${e}`))
  }
  console.log('═'.repeat(60))
}

main().catch(err => { console.error(err); process.exit(1) })
