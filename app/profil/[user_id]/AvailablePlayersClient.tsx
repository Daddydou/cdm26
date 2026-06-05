'use client'

import { useState, useMemo } from 'react'

type Player = {
  id: string
  name: string
  position: string
  nation_id: string
  nation: { name: string; code: string } | null
}

const POS: Record<string, string> = { GK: 'G', DEF: 'D', MID: 'M', FWD: 'A' }
const POS_COLOR: Record<string, string> = {
  GK:  'text-yellow-500',
  DEF: 'text-blue-400',
  MID: 'text-emerald-400',
  FWD: 'text-red-400',
}

function isoFlag(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

export default function AvailablePlayersClient({ players }: { players: Player[] }) {
  const [search, setSearch]             = useState('')
  const [nationFilter, setNationFilter] = useState('')
  const [open, setOpen]                 = useState(true)

  // Comptes par nation (pour le dropdown)
  const nationCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of players) {
      const n = p.nation?.name ?? 'Autre'
      map[n] = (map[n] ?? 0) + 1
    }
    return map
  }, [players])

  const nations = useMemo(
    () => Object.keys(nationCounts).sort((a, b) => a.localeCompare(b, 'fr')),
    [nationCounts]
  )

  // Joueurs filtrés
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return players.filter(p => {
      if (nationFilter && p.nation?.name !== nationFilter) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [players, search, nationFilter])

  // Groupement par nation, trié alphabétiquement
  const byNation = useMemo(() => {
    const map: Record<string, Player[]> = {}
    for (const p of filtered) {
      const n = p.nation?.name ?? 'Autre'
      if (!map[n]) map[n] = []
      map[n].push(p)
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([name, ps]) => ({
        name,
        code: ps[0]?.nation?.code ?? '',
        players: [...ps].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      }))
  }, [filtered])

  return (
    <section>
      {/* En-tête collapsible */}
      <div
        className="flex items-center justify-between cursor-pointer select-none mb-3"
        onClick={() => setOpen(v => !v)}
      >
        <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">
          Joueurs disponibles ({players.length})
        </h2>
        <span className={`text-zinc-600 text-[10px] transition-transform inline-block ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>

      {open && (
        <>
          {/* Filtres */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un joueur…"
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-xs placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <div className="relative flex-shrink-0">
              <select
                value={nationFilter}
                onChange={e => setNationFilter(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg pl-2.5 pr-6 py-2 text-xs focus:outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="">Toutes</option>
                {nations.map(n => (
                  <option key={n} value={n}>{n} ({nationCounts[n]})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <span className="text-zinc-500 text-[10px]">▾</span>
              </div>
            </div>
          </div>

          {/* Résultats */}
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Aucun joueur trouvé</p>
          ) : (
            <div className="space-y-4">
              {byNation.map(({ name, code, players: nPlayers }) => (
                <div key={name}>
                  <p className="text-[11px] font-semibold text-zinc-500 mb-1.5 flex items-center gap-1.5">
                    <span>{code ? isoFlag(code) : '🏳️'}</span>
                    {name}
                    <span className="text-zinc-700 font-normal">({nPlayers.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {nPlayers.map(p => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 text-zinc-400"
                      >
                        <span className={`text-[10px] font-bold ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>
                          {POS[p.position] ?? p.position}
                        </span>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
