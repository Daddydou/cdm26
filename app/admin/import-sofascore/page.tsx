'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchRow = {
  id: string
  kickoff_at: string
  nameA: string
  nameB: string
  ratingsCount: number
}

type ComputeState = 'idle' | 'loading' | 'done' | 'error'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportSofascorePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]       = useState(today)
  const [copied, setCopied]   = useState(false)
  const [matches, setMatches] = useState<MatchRow[] | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [computeStates, setComputeStates] = useState<Record<string, ComputeState>>({})
  const [computeAllState, setComputeAllState] = useState<ComputeState>('idle')
  const [computeAllResult, setComputeAllResult] = useState<{ total?: number; error?: string } | null>(null)

  // ── Charge les matchs terminés + comptage des notes ────────────────────────

  const loadMatches = useCallback(async () => {
    setLoadingList(true)
    const supabase = createClient()

    const [matchRes, ratingsRes] = await Promise.all([
      supabase
        .from('cdm_matches')
        .select(`
          id, kickoff_at,
          nation_a:cdm_nations!nation_a_id ( name ),
          nation_b:cdm_nations!nation_b_id ( name )
        `)
        .eq('status', 'termine')
        .order('kickoff_at', { ascending: false }),
      supabase
        .from('cdm_player_ratings')
        .select('match_id'),
    ])

    const countByMatch: Record<string, number> = {}
    for (const r of ratingsRes.data ?? []) {
      countByMatch[r.match_id] = (countByMatch[r.match_id] ?? 0) + 1
    }

    const rows: MatchRow[] = (matchRes.data ?? []).map(m => ({
      id:          m.id,
      kickoff_at:  m.kickoff_at,
      nameA:       (m.nation_a as unknown as { name: string })?.name ?? '?',
      nameB:       (m.nation_b as unknown as { name: string })?.name ?? '?',
      ratingsCount: countByMatch[m.id] ?? 0,
    }))

    setMatches(rows)
    setLoadingList(false)
  }, [])

  useEffect(() => { loadMatches() }, [loadMatches])

  // ── Copie la commande ──────────────────────────────────────────────────────

  async function copyCommand() {
    await navigator.clipboard.writeText(`npm run fetch-ratings -- --date ${date}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Calcul des points par match ────────────────────────────────────────────

  async function computeMatch(matchId: string) {
    setComputeStates(prev => ({ ...prev, [matchId]: 'loading' }))
    try {
      const res = await fetch(`/api/admin/compute-points?matchId=${matchId}`)
      setComputeStates(prev => ({ ...prev, [matchId]: res.ok ? 'done' : 'error' }))
    } catch {
      setComputeStates(prev => ({ ...prev, [matchId]: 'error' }))
    }
  }

  // ── Calcul global ─────────────────────────────────────────────────────────

  async function computeAll() {
    setComputeAllState('loading')
    setComputeAllResult(null)
    try {
      const res  = await fetch('/api/admin/compute-all-points')
      const data = await res.json() as { total_picks_computed?: number; error?: string }
      setComputeAllResult({ total: data.total_picks_computed, error: data.error })
      setComputeAllState(res.ok && !data.error ? 'done' : 'error')
    } catch (err) {
      setComputeAllResult({ error: String(err) })
      setComputeAllState('error')
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Import SofaScore</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Gestion des notes joueurs et calcul des points
        </p>
      </div>

      {/* ── Section 1 : commande terminal ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Import SofaScore (terminal local)</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Lance cette commande depuis <code className="text-zinc-400 bg-zinc-800 px-1 rounded">C:\Users\lolor\cdm26</code> après chaque match
          </p>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date du match</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 bg-zinc-800/80 text-zinc-200 text-xs px-3 py-2.5 rounded-lg font-mono truncate border border-zinc-700/50">
            npm run fetch-ratings -- --date {date}
          </code>
          <button
            onClick={copyCommand}
            className="flex-shrink-0 px-3 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
          >
            {copied ? '✓ Copié' : '📋 Copier'}
          </button>
        </div>
      </div>

      {/* ── Section 2 : statut des imports ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Statut des imports</h2>
          <button
            onClick={loadMatches}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ↻ Rafraîchir
          </button>
        </div>

        {loadingList ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-600">Chargement…</div>
        ) : matches?.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-600">
            Aucun match terminé pour l&apos;instant
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {(matches ?? []).map(m => {
              const cs = computeStates[m.id] ?? 'idle'
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                  {/* Match + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100">
                      {m.nameA} <span className="text-zinc-600 font-normal">vs</span> {m.nameB}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {formatInTimeZone(new Date(m.kickoff_at), 'Europe/Paris', 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>

                  {/* Badge notes */}
                  {m.ratingsCount > 0 ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-950/50 text-green-400 border border-green-800/40 flex-shrink-0">
                      ✅ {m.ratingsCount} notes
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/40 text-amber-400 border border-amber-800/40 flex-shrink-0">
                      ⏳ En attente
                    </span>
                  )}

                  {/* Bouton calcul */}
                  <button
                    onClick={() => computeMatch(m.id)}
                    disabled={cs === 'loading'}
                    className="flex-shrink-0 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {cs === 'loading' && <span className="animate-spin inline-block">⟳</span>}
                    {cs === 'done'    && <span className="text-green-400">✓</span>}
                    {cs === 'error'   && <span className="text-red-400">✗</span>}
                    🧮 Calculer les points
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Section 3 : calcul global ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">Calcul global</h2>

        <button
          onClick={computeAll}
          disabled={computeAllState === 'loading'}
          className="px-4 py-2 bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/40 text-amber-300 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {computeAllState === 'loading'
            ? <><span className="animate-spin inline-block">⟳</span> Calcul en cours…</>
            : '🧮 Tout calculer'
          }
        </button>

        {computeAllResult && computeAllState !== 'loading' && (
          <div className={`text-xs rounded-lg px-3 py-2.5 border ${
            computeAllResult.error
              ? 'bg-red-950/20 border-red-800/40 text-red-400'
              : 'bg-green-950/15 border-green-800/30 text-green-400'
          }`}>
            {computeAllResult.error
              ? `✗ ${computeAllResult.error}`
              : `✅ ${computeAllResult.total ?? 0} pick${(computeAllResult.total ?? 0) !== 1 ? 's' : ''} calculé${(computeAllResult.total ?? 0) !== 1 ? 's' : ''}`
            }
          </div>
        )}
      </div>

    </div>
  )
}
