#!/usr/bin/env tsx
/**
 * Script local : fetch notes SofaScore → upsert cdm_player_ratings
 * Usage : npm run fetch-ratings -- --date 2026-06-11
 */

import * as fs   from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── .env.local ───────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  try {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx < 0) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.error('⚠ Impossible de lire .env.local')
  }
}
loadEnv()

// ─── SofaScore headers ────────────────────────────────────────────────────────

const SOFA_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Referer':         'https://www.sofascore.com/',
  'Origin':          'https://www.sofascore.com',
}

const CDM_TOURNAMENT_ID = 16   // FIFA World Cup dans SofaScore

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

async function fetchJSON(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: SOFA_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

function findPlayer(
  sofaName: string,
  players: Array<{ id: string; name: string }>
): string | null {
  const norm = normalizeName(sofaName)

  // 1. Exacte
  const exact = players.find(p => normalizeName(p.name) === norm)
  if (exact) return exact.id

  // 2. Nom de famille uniquement
  const lastName = norm.split(' ').at(-1) ?? ''
  if (lastName.length >= 3) {
    const byLast = players.filter(p => normalizeName(p.name).split(' ').at(-1) === lastName)
    if (byLast.length === 1) return byLast[0].id
  }

  // 3. Partiel
  const partial = players.find(p => {
    const pNorm = normalizeName(p.name)
    return pNorm.includes(norm) || norm.includes(pNorm)
  })
  return partial?.id ?? null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Argument --date
  const args    = process.argv.slice(2)
  const dateIdx = args.indexOf('--date')
  const date    = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('❌ Format invalide. Usage : npm run fetch-ratings -- --date YYYY-MM-DD')
    process.exit(1)
  }

  console.log(`\n📅 Date : ${date}`)
  console.log('─'.repeat(50))

  // Supabase admin
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Variables manquantes dans .env.local')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Matchs SofaScore du jour
  console.log(`\n🌐 SofaScore — scheduled-events/${date}…`)
  let events: Record<string, unknown>[]
  try {
    const data = await fetchJSON(
      `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`
    )
    events = (data.events ?? []) as Record<string, unknown>[]
  } catch (err) {
    console.error(`❌ Fetch échoué : ${err}`)
    process.exit(1)
  }

  // 2. Filtre CdM terminés
  const cdmFinished = events.filter(e => {
    const ut       = (e.tournament as Record<string, unknown>)?.uniqueTournament as Record<string, unknown>
    const isCdm    = Number(ut?.id) === CDM_TOURNAMENT_ID
    const status   = e.status as Record<string, unknown>
    const isDone   = status?.type === 'finished'
    return isCdm && isDone
  })

  console.log(`   ${events.length} matchs football — ${cdmFinished.length} matchs CdM terminés`)

  if (cdmFinished.length === 0) {
    const tournaments = [...new Set(events.map(e => {
      const t  = e.tournament as Record<string, unknown>
      const ut = t?.uniqueTournament as Record<string, unknown>
      return `${ut?.name ?? t?.name ?? '?'} (id=${ut?.id ?? '?'})`
    }))]
    console.log('   Tournois présents :', tournaments.slice(0, 8).join(' | '))
    console.log('\n✅ Rien à faire.')
    return
  }

  // 3. Matchs Supabase terminés (pour le matching)
  const { data: dbMatchesRaw } = await supabase
    .from('cdm_matches')
    .select('id, status, nation_a:cdm_nations!nation_a_id(id, name), nation_b:cdm_nations!nation_b_id(id, name)')
    .eq('status', 'termine')

  const dbMatches = (dbMatchesRaw ?? []) as Array<{
    id: string
    status: string
    nation_a: { id: string; name: string }
    nation_b: { id: string; name: string }
  }>

  let totalMatched   = 0
  let totalUnmatched = 0

  // 4. Traite chaque match CdM
  for (const event of cdmFinished) {
    const eventId   = String(event.id)
    const homeTeam  = (event.homeTeam as Record<string, unknown>)?.name as string ?? '?'
    const awayTeam  = (event.awayTeam as Record<string, unknown>)?.name as string ?? '?'

    console.log(`\n⚽ ${homeTeam} vs ${awayTeam} (sofa id=${eventId})`)

    // 4a. Matching avec la DB
    const normHome = normalizeName(homeTeam)
    const normAway = normalizeName(awayTeam)

    const dbMatch = dbMatches.find(m => {
      const na = normalizeName(m.nation_a?.name ?? '')
      const nb = normalizeName(m.nation_b?.name ?? '')
      return (
        (normHome.includes(na) || na.includes(normHome)) &&
        (normAway.includes(nb) || nb.includes(normAway))
      ) || (
        (normAway.includes(na) || na.includes(normAway)) &&
        (normHome.includes(nb) || nb.includes(normHome))
      )
    })

    if (!dbMatch) {
      console.log(`   ⚠ Match introuvable en base (statut 'termine' requis)`)
      console.log(`   Matchs DB dispo : ${dbMatches.map(m => `${m.nation_a?.name} vs ${m.nation_b?.name}`).join(', ') || 'aucun'}`)
      continue
    }

    console.log(`   ✓ DB : ${dbMatch.nation_a?.name} vs ${dbMatch.nation_b?.name} (${dbMatch.id})`)

    // 4b. Lineups SofaScore
    let sofaPlayers: Array<{
      name: string; team: string; rating: number | null
      goals: number; assists: number; minutes: number | null
    }> = []

    try {
      const lineups = await fetchJSON(
        `https://api.sofascore.com/api/v1/event/${eventId}/lineups`
      )

      for (const side of ['home', 'away'] as const) {
        const sideData = lineups[side] as Record<string, unknown>
        const teamName = (sideData?.team as Record<string, unknown>)?.name as string ?? side
        const sPlayers = (sideData?.players ?? []) as Record<string, unknown>[]

        for (const p of sPlayers) {
          const player = p.player as Record<string, unknown>
          const name   = player?.name as string ?? ''
          if (!name) continue

          const stats = (p.statistics ?? {}) as Record<string, unknown>
          sofaPlayers.push({
            name,
            team:    teamName,
            rating:  typeof stats.rating === 'number' ? stats.rating : null,
            goals:   Number(stats.goals       ?? 0),
            assists: Number(stats.goalAssist   ?? stats.assists ?? 0),
            minutes: stats.minutesPlayed != null ? Number(stats.minutesPlayed) : null,
          })
        }
      }
    } catch (err) {
      console.log(`   ❌ Lineups échoués : ${err}`)
      continue
    }

    const withRating = sofaPlayers.filter(p => p.rating !== null).length
    console.log(`   📊 ${sofaPlayers.length} joueurs — ${withRating} avec note`)

    if (sofaPlayers.length === 0) {
      console.log('   ⚠ Aucun joueur dans les lineups')
      continue
    }

    // 4c. Joueurs DB des deux nations
    const { data: dbPlayers } = await supabase
      .from('cdm_players')
      .select('id, name, nation_id')
      .in('nation_id', [dbMatch.nation_a?.id, dbMatch.nation_b?.id].filter(Boolean))

    const allDbPlayers = (dbPlayers ?? []) as Array<{ id: string; name: string; nation_id: string }>

    // 4d. Matching + upsert
    const matched:    string[] = []
    const unmatched:  string[] = []
    const upsertRows: Array<{
      match_id: string; player_id: string; fotmob_rating: number | null
      goals: number; assists: number; penalty_saved: boolean
      minutes_played: number | null; source: string
    }> = []

    for (const p of sofaPlayers) {
      const playerId = findPlayer(p.name, allDbPlayers)
      if (playerId) {
        matched.push(`${p.name}${p.rating != null ? ` (${p.rating})` : ''}`)
        upsertRows.push({
          match_id:       dbMatch.id,
          player_id:      playerId,
          fotmob_rating:  p.rating,
          goals:          p.goals,
          assists:        p.assists,
          penalty_saved:  false,
          minutes_played: p.minutes,
          source:         'sofascore',
        })
      } else {
        unmatched.push(`${p.name} [${p.team}]`)
      }
    }

    if (upsertRows.length > 0) {
      const { error } = await supabase
        .from('cdm_player_ratings')
        .upsert(upsertRows, { onConflict: 'player_id,match_id' })
      if (error) {
        console.log(`   ❌ Upsert : ${error.message}`)
      } else {
        console.log(`   ✅ ${upsertRows.length} notes upsertées en base`)
      }
    }

    console.log(`   ✓ Matched   (${matched.length}) : ${matched.slice(0, 6).join(', ')}${matched.length > 6 ? '…' : ''}`)
    if (unmatched.length > 0) {
      console.log(`   ✗ Unmatched (${unmatched.length}) : ${unmatched.join(', ')}`)
    }

    totalMatched   += matched.length
    totalUnmatched += unmatched.length
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`✅ Terminé — ${totalMatched} matched / ${totalUnmatched} unmatched`)
}

main().catch(err => {
  console.error('❌ Erreur fatale :', err)
  process.exit(1)
})
