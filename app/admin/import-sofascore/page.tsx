'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CDM_TOURNAMENT_ID = 16

function normalize(n: string): string {
  return n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
}

const SOFA_TO_DB: Record<string, string> = {
  'Argentina': 'Argentine', 'Brazil': 'Brésil', 'Spain': 'Espagne',
  'England': 'Angleterre', 'Germany': 'Allemagne', 'Italy': 'Italie',
  'Netherlands': 'Pays-Bas', 'Belgium': 'Belgique', 'Croatia': 'Croatie',
  'Switzerland': 'Suisse', 'Scotland': 'Écosse', 'Sweden': 'Suède',
  'Austria': 'Autriche', 'Australia': 'Australie', 'South Korea': 'Corée du Sud',
  'Japan': 'Japon', 'Morocco': 'Maroc', 'Senegal': 'Sénégal',
  'Algeria': 'Algérie', 'Tunisia': 'Tunisie', 'Cameroon': 'Cameroun',
  'Egypt': 'Égypte', 'Mexico': 'Mexique', 'United States': 'États-Unis',
  'USA': 'États-Unis', 'Ecuador': 'Équateur', 'Colombia': 'Colombie',
  'Chile': 'Chili', 'Peru': 'Pérou', 'Turkey': 'Turquie', 'Türkiye': 'Turquie',
  'Czech Republic': 'République Tchèque', 'Czechia': 'République Tchèque',
  'Saudi Arabia': 'Arabie Saoudite', 'Ivory Coast': "Côte d'Ivoire",
  'Portugal': 'Portugal', 'France': 'France', 'Uruguay': 'Uruguay',
  'Paraguay': 'Paraguay', 'Venezuela': 'Venezuela', 'Panama': 'Panama',
  'Costa Rica': 'Costa Rica', 'Honduras': 'Honduras', 'Jamaica': 'Jamaïque',
  'Nigeria': 'Nigeria', 'Ghana': 'Ghana', 'South Africa': 'Afrique du Sud',
  'Uzbekistan': 'Ouzbékistan', 'Iran': 'Iran', 'Serbia': 'Serbie',
  'Poland': 'Pologne', 'Denmark': 'Danemark', 'Ukraine': 'Ukraine',
  'Romania': 'Roumanie', 'Hungary': 'Hongrie', 'Slovakia': 'Slovaquie',
  'Greece': 'Grèce', 'Slovenia': 'Slovénie', 'Wales': 'Pays de Galles',
  'New Zealand': 'Nouvelle-Zélande', 'DR Congo': 'RD Congo', 'Congo': 'RD Congo',
  'Qatar': 'Qatar', 'Norway': 'Norvège', 'Bolivia': 'Bolivie',
  'Trinidad and Tobago': 'Trinité-et-Tobago', 'El Salvador': 'Salvador',
  'Canada': 'Canada',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SofaEvent = {
  eventId: number
  home: string
  away: string
  status: string
}

type DbMatch = {
  id: string
  nationAId: string
  nationBId: string
  nameA: string
  nameB: string
}

type MatchPair = {
  sofa: SofaEvent
  db: DbMatch | null
}

type ImportState =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'saving' }
  | { phase: 'done'; matched: number; unmatched: string[] }
  | { phase: 'error'; message: string }

type PlayerRating = {
  playerName: string
  teamName: string
  rating: number | null
  goals: number
  assists: number
  minutesPlayed: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbToSofaNames(dbName: string): string[] {
  const sofaKeys = Object.entries(SOFA_TO_DB)
    .filter(([, v]) => v === dbName)
    .map(([k]) => k)
  return [dbName, ...sofaKeys].map(normalize)
}

function matchTeams(sofaHome: string, sofaAway: string, db: DbMatch): boolean {
  const varA = dbToSofaNames(db.nameA)
  const varB = dbToSofaNames(db.nameB)
  const nh = normalize(sofaHome)
  const na = normalize(sofaAway)
  const hit = (variants: string[], name: string) =>
    variants.some(v => v.includes(name) || name.includes(v))
  return (
    (hit(varA, nh) && hit(varB, na)) ||
    (hit(varB, nh) && hit(varA, na))
  )
}

function statusLabel(s: string): { text: string; cls: string } {
  if (s === 'finished')   return { text: 'Terminé',       cls: 'bg-green-950/50 text-green-400 border-green-800/40' }
  if (s === 'inprogress') return { text: 'En cours',      cls: 'bg-amber-950/50 text-amber-400 border-amber-800/40' }
  if (s === 'notstarted') return { text: 'Pas commencé',  cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' }
  return { text: s,                                         cls: 'bg-zinc-800 text-zinc-500 border-zinc-700' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportSofascorePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]     = useState(today)
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [pairs, setPairs]   = useState<MatchPair[] | null>(null)
  const [imports, setImports] = useState<Record<number, ImportState>>({})

  function setImport(eventId: number, state: ImportState) {
    setImports(prev => ({ ...prev, [eventId]: state }))
  }

  // ── Étape 1 : récupère les matchs ──────────────────────────────────────────

  async function fetchMatches() {
    setLoading(true)
    setPairs(null)
    setGlobalError(null)
    setImports({})

    try {
      const [sofaRes, supabase] = await Promise.all([
        fetch(`/api/admin/sofascore-proxy?path=sport/football/scheduled-events/${date}`),
        Promise.resolve(createClient()),
      ])

      const { data: dbRaw } = await supabase
        .from('cdm_matches')
        .select(`
          id, nation_a_id, nation_b_id,
          nation_a:cdm_nations!nation_a_id ( name ),
          nation_b:cdm_nations!nation_b_id ( name )
        `)

      const dbMatches: DbMatch[] = (dbRaw ?? []).map(m => ({
        id:       m.id,
        nationAId: m.nation_a_id,
        nationBId: m.nation_b_id,
        nameA: (m.nation_a as unknown as { name: string })?.name ?? '',
        nameB: (m.nation_b as unknown as { name: string })?.name ?? '',
      }))

      if (!sofaRes.ok) {
        throw new Error(`SofaScore HTTP ${sofaRes.status} — ${await sofaRes.text()}`)
      }

      const sofaData = await sofaRes.json() as { events?: Record<string, unknown>[] }
      const events = sofaData.events ?? []

      const cdmEvents = events.filter(e => {
        const ut = ((e.tournament as Record<string, unknown>)?.uniqueTournament as Record<string, unknown>)
        return Number(ut?.id) === CDM_TOURNAMENT_ID
      })

      const result: MatchPair[] = cdmEvents.map(e => {
        const home   = (e.homeTeam as Record<string, unknown>)?.name as string ?? ''
        const away   = (e.awayTeam as Record<string, unknown>)?.name as string ?? ''
        const status = (e.status   as Record<string, unknown>)?.type as string ?? ''
        const sofa: SofaEvent = { eventId: e.id as number, home, away, status }
        const db = dbMatches.find(m => matchTeams(home, away, m)) ?? null
        return { sofa, db }
      })

      setPairs(result)
    } catch (err) {
      setGlobalError(String(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Étape 2 : importe les notes d'un match ─────────────────────────────────

  async function importMatch(sofa: SofaEvent, matchId: string) {
    setImport(sofa.eventId, { phase: 'fetching' })

    try {
      const res = await fetch(`/api/admin/sofascore-proxy?path=event/${sofa.eventId}/lineups`)
      if (!res.ok) throw new Error(`Lineups HTTP ${res.status}`)
      const data = await res.json() as Record<string, unknown>

      const ratings: PlayerRating[] = []
      for (const side of ['home', 'away'] as const) {
        const sideData = data[side] as Record<string, unknown> | undefined
        if (!sideData) continue
        const teamName = (sideData.team as Record<string, unknown>)?.name as string ?? side
        const players  = (sideData.players ?? []) as Record<string, unknown>[]

        for (const p of players) {
          const player = p.player as Record<string, unknown>
          const name   = player?.name as string ?? ''
          if (!name) continue
          const stats  = (p.statistics ?? {}) as Record<string, unknown>
          ratings.push({
            playerName:   name,
            teamName,
            rating:       typeof stats.rating === 'number' ? stats.rating : null,
            goals:        Number(stats.goals      ?? 0),
            assists:      Number(stats.goalAssist ?? (stats.assists ?? 0)),
            minutesPlayed: stats.minutesPlayed != null ? Number(stats.minutesPlayed) : null,
          })
        }
      }

      setImport(sofa.eventId, { phase: 'saving' })

      const saveRes = await fetch('/api/admin/save-ratings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId, ratings }),
      })
      const saved = await saveRes.json() as { matched?: number; unmatched?: string[]; error?: string }
      if (!saveRes.ok) throw new Error(saved.error ?? `Save HTTP ${saveRes.status}`)

      setImport(sofa.eventId, {
        phase:     'done',
        matched:   saved.matched ?? 0,
        unmatched: saved.unmatched ?? [],
      })
    } catch (err) {
      setImport(sofa.eventId, { phase: 'error', message: String(err) })
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Import SofaScore (navigateur)</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Les appels SofaScore sont faits depuis le navigateur — Cloudflare ne bloque pas
        </p>
      </div>

      {/* Contrôles */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
          <button
            onClick={fetchMatches}
            disabled={loading}
            className="px-4 py-2 bg-blue-900/50 hover:bg-blue-800/60 border border-blue-700/40 text-blue-300 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading
              ? <><span className="animate-spin inline-block">⟳</span> Récupération…</>
              : '🌐 Récupérer les matchs CdM'
            }
          </button>
        </div>
      </div>

      {/* Erreur globale */}
      {globalError && (
        <div className="bg-red-950/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
          <p className="font-medium mb-1">Erreur SofaScore</p>
          <p className="text-xs font-mono">{globalError}</p>
          {globalError.includes('CORS') || globalError.includes('Failed to fetch') ? (
            <p className="text-xs text-zinc-500 mt-2">
              Si l&apos;erreur est CORS, teste depuis un onglet ouvert sur sofascore.com ou utilise l&apos;import en ligne de commande.
            </p>
          ) : null}
        </div>
      )}

      {/* Résultats */}
      {pairs !== null && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            {pairs.length === 0
              ? `Aucun match CdM (uniqueTournament.id=${CDM_TOURNAMENT_ID}) trouvé pour le ${date}`
              : `${pairs.length} match${pairs.length > 1 ? 's' : ''} CdM trouvé${pairs.length > 1 ? 's' : ''} pour le ${date}`
            }
          </p>

          {pairs.map(({ sofa, db }) => {
            const imp  = imports[sofa.eventId] ?? { phase: 'idle' }
            const badge = statusLabel(sofa.status)

            return (
              <div
                key={sofa.eventId}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3"
              >
                {/* Ligne match */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {sofa.home} <span className="text-zinc-600 font-normal">vs</span> {sofa.away}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">event id: {sofa.eventId}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>

                {/* Match DB */}
                {db ? (
                  <p className="text-xs text-green-500">
                    ✓ DB : {db.nameA} vs {db.nameB}
                  </p>
                ) : (
                  <p className="text-xs text-orange-400">
                    ⚠ Match non trouvé en base — vérifier les noms d&apos;équipe
                  </p>
                )}

                {/* Bouton import + résultat */}
                {db && (
                  <div className="space-y-2">
                    <button
                      onClick={() => importMatch(sofa, db.id)}
                      disabled={imp.phase === 'fetching' || imp.phase === 'saving'}
                      className="px-3 py-1.5 bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-700/40 text-emerald-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {imp.phase === 'fetching' && <><span className="animate-spin inline-block">⟳</span> Récupération lineups…</>}
                      {imp.phase === 'saving'   && <><span className="animate-spin inline-block">⟳</span> Sauvegarde…</>}
                      {(imp.phase === 'idle' || imp.phase === 'done' || imp.phase === 'error') && '📥 Importer les notes'}
                    </button>

                    {imp.phase === 'done' && (
                      <div className="bg-green-950/15 border border-green-800/30 rounded-lg px-3 py-2 text-xs space-y-1">
                        <p className="text-green-400 font-medium">
                          ✅ {imp.matched} note{imp.matched !== 1 ? 's' : ''} importée{imp.matched !== 1 ? 's' : ''}
                        </p>
                        {imp.unmatched.length > 0 && (
                          <p className="text-zinc-500">
                            Non matchés ({imp.unmatched.length}) : {imp.unmatched.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {imp.phase === 'error' && (
                      <p className="text-xs text-red-400">✗ {imp.message}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
