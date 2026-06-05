'use client'

import { useState } from 'react'

// ─── Import SofaScore ─────────────────────────────────────────────────────────

type ImportResult = {
  matched:           number
  unmatched:         string[]
  matches_processed: number
  error_type?:       string
  message?:          string
  error?:            string
}

export function SofaImportPanel() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]     = useState(today)
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function run() {
    setState('loading')
    setResult(null)
    try {
      const res  = await fetch('/api/admin/import-ratings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date }),
      })
      const data = await res.json() as ImportResult
      setResult(data)
      setState(data.error_type || data.error ? 'error' : 'done')
    } catch (e) {
      setResult({ matched: 0, unmatched: [], matches_processed: 0, error: String(e) })
      setState('error')
    }
  }

  const command  = `npm run fetch-ratings -- --date ${date}`
  const isBlocked = result?.error_type === 'sofascore_blocked'

  async function copyCommand() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Import automatique SofaScore</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Importe les notes joueurs pour tous les matchs CdM terminés d&apos;une date donnée
        </p>
      </div>

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
          onClick={run}
          disabled={state === 'loading'}
          className="px-4 py-2 bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-700/40 text-emerald-300 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {state === 'loading'
            ? <><span className="animate-spin inline-block">⟳</span> Récupération des notes en cours…</>
            : '🌐 Importer depuis SofaScore'
          }
        </button>
      </div>

      {result && state !== 'loading' && (
        <div className={`rounded-lg px-4 py-3 text-sm border space-y-2 ${
          isBlocked
            ? 'bg-orange-950/20 border-orange-800/40'
            : state === 'error'
            ? 'bg-red-950/20 border-red-800/40'
            : 'bg-green-950/15 border-green-800/30'
        }`}>
          {isBlocked ? (
            <>
              <p className="text-orange-300 font-medium">⚠️ SofaScore bloqué depuis Vercel (Cloudflare)</p>
              <p className="text-zinc-400 text-xs">{result.message}</p>
              <p className="text-zinc-500 text-xs">Lance cette commande depuis ton terminal local :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 bg-zinc-800/80 text-zinc-200 text-xs px-3 py-2 rounded-lg font-mono truncate">
                  {command}
                </code>
                <button
                  onClick={copyCommand}
                  className="flex-shrink-0 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  {copied ? '✓ Copié' : '📋 Copier'}
                </button>
              </div>
            </>
          ) : state === 'error' ? (
            <p className="text-red-400">✗ {result.error ?? result.message}</p>
          ) : (
            <>
              <p className="text-green-400 font-medium">
                ✅ {result.matched} note{result.matched !== 1 ? 's' : ''} importée{result.matched !== 1 ? 's' : ''}
                {result.matches_processed > 0 && (
                  <span className="text-zinc-500 font-normal ml-1.5">
                    ({result.matches_processed} match{result.matches_processed > 1 ? 's' : ''})
                  </span>
                )}
              </p>
              {result.message && <p className="text-zinc-500 text-xs">{result.message}</p>}
              {result.unmatched.length > 0 && (
                <p className="text-zinc-500 text-xs">
                  Joueurs non matchés ({result.unmatched.length}) : {result.unmatched.join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tout calculer ────────────────────────────────────────────────────────────

type ComputeAllResult = {
  matches_processed:    number
  total_picks_computed: number
  results: Array<{ label: string; picks_computed: number; error: string | null }>
  error?: string
}

export function ComputeAllButton() {
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ComputeAllResult | null>(null)

  async function run() {
    setState('loading')
    setResult(null)
    try {
      const res  = await fetch('/api/admin/compute-all-points')
      const data = await res.json() as ComputeAllResult
      setResult(data)
      setState(data.error ? 'error' : 'done')
      if ((data.total_picks_computed ?? 0) > 0) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (e) {
      setResult({ matches_processed: 0, total_picks_computed: 0, results: [], error: String(e) })
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="flex items-center gap-1.5 px-4 py-2 bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/40 text-amber-300 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {state === 'loading'
          ? <><span className="animate-spin inline-block">⟳</span> Calcul en cours…</>
          : '🧮 Tout calculer'
        }
      </button>

      {result && state !== 'loading' && (
        <div className={`text-xs rounded-lg px-3 py-2.5 border space-y-1 ${
          state === 'error'
            ? 'bg-red-950/20 border-red-800/40 text-red-400'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
          {state === 'error' ? (
            <p>✗ {result.error}</p>
          ) : (
            <>
              <p className="text-green-400">
                ✓ {result.total_picks_computed} pick{result.total_picks_computed !== 1 ? 's' : ''} calculé{result.total_picks_computed !== 1 ? 's' : ''}
                <span className="text-zinc-500 ml-1">({result.matches_processed} match{result.matches_processed !== 1 ? 's' : ''})</span>
              </p>
              {result.results.filter(r => r.error).map((r, i) => (
                <p key={i} className="text-red-400">✗ {r.label} : {r.error}</p>
              ))}
              {result.results.filter(r => !r.error && r.picks_computed > 0).map((r, i) => (
                <p key={i} className="text-zinc-500">{r.label} : {r.picks_computed} pick{r.picks_computed !== 1 ? 's' : ''}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
