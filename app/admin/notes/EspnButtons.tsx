'use client'

import { useState } from 'react'

type FetchResult = {
  matched:      number
  unmatched:    string[]
  espn_match?:  string
  upsert_error?: string | null
  error?:        string
}

type AutoResult = {
  processed:     number
  skipped:       number
  total_matched: number
  message?:      string
  results?: Array<{ label: string; matched: number; error: string | null }>
}

// ── Bouton par match ─────────────────────────────────────────────────────────

export function EspnMatchButton({ matchId }: { matchId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<FetchResult | null>(null)

  async function run() {
    setState('loading')
    setResult(null)
    try {
      const res  = await fetch(`/api/admin/fetch-ratings?match_id=${matchId}`)
      const data = await res.json() as FetchResult
      setResult(data)
      setState(data.error ? 'error' : 'done')
      if ((data.matched ?? 0) > 0) {
        setTimeout(() => window.location.reload(), 800)
      }
    } catch (e) {
      setResult({ matched: 0, unmatched: [], error: String(e) })
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-blue-900/50 hover:bg-blue-800/60 border border-blue-700/40 text-blue-300"
      >
        {state === 'loading'
          ? <><span className="animate-spin">⟳</span> Récupération…</>
          : '📡 Récupérer via ESPN'
        }
      </button>

      {result && state !== 'loading' && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${
          result.error
            ? 'bg-red-950/30 border-red-800/40 text-red-400'
            : 'bg-green-950/20 border-green-800/30 text-green-400'
        }`}>
          {result.error ? (
            <span>✗ {result.error}</span>
          ) : (
            <span>✓ {result.matched} joueur{result.matched !== 1 ? 's' : ''} importé{result.matched !== 1 ? 's' : ''}
              {result.espn_match && <span className="text-zinc-500 ml-1">({result.espn_match})</span>}
            </span>
          )}
          {(result.unmatched?.length ?? 0) > 0 && (
            <p className="text-zinc-500 mt-1">
              Non trouvés : {result.unmatched.join(', ')}
            </p>
          )}
          {result.upsert_error && (
            <p className="text-orange-400 mt-1">Erreur upsert : {result.upsert_error}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Bouton global tout récupérer ─────────────────────────────────────────────

export function EspnAutoButton() {
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<AutoResult | null>(null)

  async function run() {
    setState('loading')
    setResult(null)
    try {
      const res  = await fetch('/api/admin/fetch-ratings-auto')
      const data = await res.json() as AutoResult
      setResult(data)
      setState('done')
      if ((data.total_matched ?? 0) > 0) {
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (e) {
      setResult({ processed: 0, skipped: 0, total_matched: 0, message: String(e) })
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-violet-900/40 hover:bg-violet-800/50 border border-violet-700/40 text-violet-300"
      >
        {state === 'loading'
          ? <><span className="animate-spin inline-block">⟳</span> Récupération en cours…</>
          : '🤖 Tout récupérer automatiquement'
        }
      </button>

      {result && state !== 'loading' && (
        <div className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 space-y-1">
          {result.message ? (
            <p className="text-zinc-400">{result.message}</p>
          ) : (
            <p className="text-green-400">
              ✓ {result.processed} match{result.processed !== 1 ? 's' : ''} traité{result.processed !== 1 ? 's' : ''} —{' '}
              {result.total_matched} joueur{result.total_matched !== 1 ? 's' : ''} importé{result.total_matched !== 1 ? 's' : ''}
              {result.skipped > 0 && <span className="text-zinc-500"> ({result.skipped} déjà notés ignorés)</span>}
            </p>
          )}
          {result.results?.filter(r => r.error).map((r, i) => (
            <p key={i} className="text-red-400">✗ {r.label} : {r.error}</p>
          ))}
          {result.results?.filter(r => !r.error && r.matched > 0).map((r, i) => (
            <p key={i} className="text-zinc-500">{r.label} : {r.matched} joueur{r.matched !== 1 ? 's' : ''}</p>
          ))}
        </div>
      )}
    </div>
  )
}
