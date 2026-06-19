'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type BracketMatch = {
  id: string
  match_number: number
  round: string
  slot_description: string
  kickoff_at: string
  score_a: number | null
  score_b: number | null
  winner_nation_id: string | null
}

const ROUNDS = [
  { key: 'seizieme', label: 'Seizièmes', count: 16 },
  { key: 'huitieme', label: 'Huitièmes', count: 8 },
  { key: 'quart',    label: 'Quarts',    count: 4 },
  { key: 'demi',     label: 'Demies',    count: 2 },
  { key: 'finale',   label: 'Finale',    count: 1 },
  { key: 'bronze',   label: 'Bronze',    count: 1 },
]

function parisDayTime(iso: string) {
  const d = new Date(iso)
  const day  = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

export default function BracketPage() {
  const [matches, setMatches] = useState<BracketMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('cdm_bracket')
      .select('id, match_number, round, slot_description, kickoff_at, score_a, score_b, winner_nation_id')
      .order('match_number', { ascending: true })
      .then(({ data }) => {
        setMatches(data ?? [])
        setLoading(false)
      })
  }, [])

  const byRound = Object.fromEntries(
    ROUNDS.map(r => [r.key, matches.filter(m => m.round === r.key)])
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-screen-xl mx-auto flex items-center px-4 h-14">
          <h1 className="text-base font-bold tracking-tight">
            CDM<span className="text-green-500">26</span>
            <span className="ml-2 text-zinc-500 font-normal text-sm">· Bracket</span>
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
          Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto pb-24 pt-4">
          <div className="flex gap-3 px-4 min-w-max">
            {ROUNDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-2 w-44">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center mb-1">
                  {label}
                </p>
                {byRound[key].map(m => {
                  const done = m.score_a !== null && m.score_b !== null
                  return (
                    <div
                      key={m.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col gap-1"
                    >
                      <span className="text-[10px] font-mono text-zinc-500">M{m.match_number}</span>
                      <span className="text-xs text-zinc-200 font-medium leading-snug">
                        {m.slot_description}
                      </span>
                      {done ? (
                        <span className="text-xs font-bold text-green-400">
                          {m.score_a} – {m.score_b}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">
                          {parisDayTime(m.kickoff_at)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
