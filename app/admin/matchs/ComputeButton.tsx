'use client'

import { useState } from 'react'

type PickResult = { pick_id: string; username: string; points_finaux: number }

export default function ComputeButton({ matchId }: { matchId: string }) {
  const [state, setState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<PickResult[]>([])
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function run() {
    setState('loading')
    setResults([])
    setErrMsg(null)
    try {
      const res  = await fetch(`/api/admin/compute-points?matchId=${matchId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrMsg(data.error ?? `HTTP ${res.status}`)
        setState('error')
      } else {
        setResults(data.computed ?? [])
        setState('done')
      }
    } catch (e) {
      setErrMsg(String(e))
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="px-3 py-1.5 bg-amber-900/40 hover:bg-amber-900/60 text-amber-400 text-xs font-semibold rounded-lg border border-amber-800/50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {state === 'loading' ? <><span className="animate-spin inline-block">⟳</span> Calcul…</> : '🧮 Calculer'}
      </button>

      {state === 'done' && results.length > 0 && (
        <div className="text-[11px] text-zinc-400 bg-zinc-800/50 rounded-lg px-2.5 py-2 space-y-0.5">
          {results.map(r => (
            <div key={r.pick_id} className="flex justify-between gap-3">
              <span className="truncate text-zinc-300">{r.username}</span>
              <span className="text-green-400 font-semibold tabular-nums flex-shrink-0">{r.points_finaux} pts</span>
            </div>
          ))}
        </div>
      )}
      {state === 'done' && results.length === 0 && (
        <p className="text-[11px] text-zinc-500">Aucun pick calculé</p>
      )}
      {state === 'error' && (
        <p className="text-[11px] text-red-400">{errMsg}</p>
      )}
    </div>
  )
}
