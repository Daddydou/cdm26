import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import Image from 'next/image'
import PointsChart from './PointsChart'
import type { ChartUser, ChartPoint } from './PointsChart'

// ─── Types ────────────────────────────────────────────────────────────────────

type Match = {
  id: string
  kickoff_at: string
  nation_a: { code: string; name: string } | null
  nation_b: { code: string; name: string } | null
}

type CdmUser = {
  id: string
  username: string
  photo_url: string | null
  total_points: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

const COLORS = [
  '#2aad66', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6',
]

const MEDALS = ['🥇', '🥈', '🥉']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StatistiquesPage() {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()

  // Matchs terminés par ordre chronologique
  const { data: matchesRaw } = await supabase
    .from('cdm_matches')
    .select('id, kickoff_at, nation_a:cdm_nations!nation_a_id(code, name), nation_b:cdm_nations!nation_b_id(code, name)')
    .eq('status', 'termine')
    .order('kickoff_at', { ascending: true })

  const matches = (matchesRaw ?? []) as unknown as Match[]
  const matchIds = matches.map(m => m.id)

  // Users + picks en parallèle
  const [usersRes, picksRes] = await Promise.all([
    supabase
      .from('cdm_users')
      .select('id, username, photo_url, total_points')
      .order('total_points', { ascending: false, nullsFirst: false }),

    matchIds.length > 0
      ? supabaseAdmin
          .from('cdm_picks')
          .select('user_id, match_id, points_finaux')
          .in('match_id', matchIds)
      : Promise.resolve({ data: [] }),
  ])

  const users: CdmUser[] = (usersRes.data ?? []) as unknown as CdmUser[]
  const picks = (picksRes.data ?? []) as Array<{ user_id: string; match_id: string; points_finaux: number | null }>

  // Index picks : matchId → userId → points
  const pickIndex: Record<string, Record<string, number>> = {}
  for (const pick of picks) {
    if (!pickIndex[pick.match_id]) pickIndex[pick.match_id] = {}
    pickIndex[pick.match_id][pick.user_id] = pick.points_finaux ?? 0
  }

  // Séries cumulatives par utilisateur
  const cumulative: Record<string, number> = {}
  for (const u of users) cumulative[u.id] = 0

  const chartData: ChartPoint[] = matches.map((match, i) => {
    const codeA = match.nation_a?.code ?? ''
    const codeB = match.nation_b?.code ?? ''
    const nameA = match.nation_a?.name ?? '?'
    const nameB = match.nation_b?.name ?? '?'

    const point: ChartPoint = {
      match:   i + 1,
      label:   `M${i + 1}`,
      nations: `${iso(codeA)} ${nameA} – ${iso(codeB)} ${nameB}`,
    }

    for (const u of users) {
      const pts = pickIndex[match.id]?.[u.id]
      if (pts !== undefined) cumulative[u.id] += pts
      point[u.id] = cumulative[u.id]
    }

    return point
  })

  const chartUsers: ChartUser[] = users.map(u => ({ id: u.id, username: u.username }))

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <h1 className="text-base font-bold tracking-tight">
            CDM<span className="text-green-500">26</span>
            <span className="ml-2 text-zinc-500 font-normal text-sm">· Statistiques</span>
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-7 pb-10">

        {/* ── Graphique points cumulés ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Évolution des points
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <PointsChart users={chartUsers} data={chartData} />
          </div>
          {matches.length > 0 && (
            <p className="text-[10px] text-zinc-600 mt-2 px-1">
              {matches.length} match{matches.length > 1 ? 's' : ''} terminé{matches.length > 1 ? 's' : ''} · points cumulés par participant
            </p>
          )}
        </section>

        {/* ── Classement par match (tableau récapitulatif) ── */}
        {matches.length > 0 && users.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Points par match
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* En-tête */}
              <div className="flex gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-950/40">
                <div className="w-20 shrink-0 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Match</div>
                {users.map((u, i) => (
                  <div
                    key={u.id}
                    className="flex-1 text-[10px] font-semibold text-center truncate"
                    style={{ color: COLORS[i % COLORS.length] }}
                    title={u.username}
                  >
                    {u.username.split(' ')[0]}
                  </div>
                ))}
              </div>

              {/* Lignes par match */}
              {matches.map((match, i) => {
                const codeA = match.nation_a?.code ?? ''
                const codeB = match.nation_b?.code ?? ''
                return (
                  <div
                    key={match.id}
                    className={`flex gap-2 px-3 py-2.5 ${i < matches.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
                  >
                    <Link href={`/match/${match.id}`} className="w-20 shrink-0 hover:opacity-80 transition-opacity">
                      <span className="text-[10px] text-zinc-500 font-mono">M{i + 1}</span>
                      <span className="ml-1 text-[11px]">{iso(codeA)}{iso(codeB)}</span>
                    </Link>
                    {users.map((u, ui) => {
                      const pts = pickIndex[match.id]?.[u.id]
                      return (
                        <div key={u.id} className="flex-1 text-center">
                          {pts !== undefined
                            ? <span
                                className="text-[11px] font-bold tabular-nums"
                                style={{ color: pts > 0 ? COLORS[ui % COLORS.length] : '#52525b' }}
                              >
                                {pts}
                              </span>
                            : <span className="text-[10px] text-zinc-700">—</span>
                          }
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* Total */}
              <div className="flex gap-2 px-3 py-2.5 bg-zinc-950/40 border-t border-zinc-800">
                <div className="w-20 shrink-0 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</div>
                {users.map((u, i) => (
                  <div key={u.id} className="flex-1 text-center">
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: COLORS[i % COLORS.length] }}>
                      {u.total_points ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Podium ── */}
        {users.length >= 3 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Podium actuel
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[users[1], users[0], users[2]].map((u, visualPos) => {
                const actualRank = visualPos === 0 ? 1 : visualPos === 1 ? 0 : 2
                if (!u) return <div key={visualPos} />
                const colorIdx = users.indexOf(u)
                return (
                  <Link
                    key={u.id}
                    href={`/profil/${u.id}`}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-colors hover:bg-zinc-800/40 ${
                      actualRank === 0 ? 'bg-yellow-950/20 border-yellow-800/30' : 'bg-zinc-900 border-zinc-800'
                    } ${visualPos === 1 ? 'pb-5' : ''}`}
                  >
                    <span className="text-2xl leading-none">{MEDALS[actualRank]}</span>
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 overflow-hidden flex items-center justify-center text-sm font-bold text-zinc-500 flex-shrink-0"
                      style={{ borderColor: COLORS[colorIdx % COLORS.length] + '80' }}>
                      {u.photo_url
                        ? <Image src={u.photo_url} alt={u.username} width={40} height={40} className="object-cover w-full h-full" />
                        : u.username[0]?.toUpperCase()
                      }
                    </div>
                    <p className="text-[11px] font-semibold text-zinc-100 text-center truncate w-full">{u.username}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: COLORS[colorIdx % COLORS.length] }}>
                      {u.total_points ?? 0} pts
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
