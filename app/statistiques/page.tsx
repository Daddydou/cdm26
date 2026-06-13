import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PointsChart from './PointsChart'
import RadarChart from './RadarChart'
import type { ChartUser, ChartPoint } from './PointsChart'
import type { RadarUser, RadarPoint } from './RadarChart'

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

type ExtPick = {
  user_id: string
  match_id: string
  points_finaux: number | null
  points_bruts: number | null
  bonus_type: string | null
  bonus_player_id: string | null
  player_a1_id: string | null
  player_a2_id: string | null
  player_b1_id: string | null
  player_b2_id: string | null
  player_a1: { id: string; position: string } | null
  player_a2: { id: string; position: string } | null
  player_b1: { id: string; position: string } | null
  player_b2: { id: string; position: string } | null
}

type RatingRow = {
  player_id: string
  match_id: string
  fotmob_rating: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  '#2aad66', '#3b82f6', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6',
]

const BONUS_META: Record<string, { name: string; icon: string; color: string }> = {
  double_mise:     { name: 'Double Mise',      icon: '⚡', color: '#f59e0b' },
  troisieme_homme: { name: 'Troisième Homme',  icon: '👤', color: '#3b82f6' },
  bouclier:        { name: 'Bouclier',         icon: '🛡️', color: '#6b7280' },
  sniper:          { name: 'Sniper',           icon: '🎯', color: '#ef4444' },
  passeur_genie:   { name: 'Passeur de Génie', icon: '🎪', color: '#a855f7' },
  mur:             { name: 'Mur',              icon: '🧱', color: '#14b8a6' },
  espion:          { name: 'Espion',           icon: '🕵️', color: '#71717a' },
  all_in:          { name: 'All-In',           icon: '🎲', color: '#f97316' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StatistiquesPage() {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()

  const [matchesRes, usersRes] = await Promise.all([
    supabase
      .from('cdm_matches')
      .select('id, kickoff_at, nation_a:cdm_nations!nation_a_id(code, name), nation_b:cdm_nations!nation_b_id(code, name)')
      .eq('status', 'termine')
      .order('kickoff_at', { ascending: true }),

    supabase
      .from('cdm_users')
      .select('id, username, photo_url, total_points')
      .order('total_points', { ascending: false, nullsFirst: false }),
  ])

  const matches = (matchesRes.data ?? []) as unknown as Match[]
  const users: CdmUser[] = (usersRes.data ?? []) as unknown as CdmUser[]
  const matchIds = matches.map(m => m.id)

  const [picksRes, ratingsRes] = await Promise.all([
    matchIds.length > 0
      ? supabaseAdmin
          .from('cdm_picks')
          .select(`
            user_id, match_id, points_finaux, points_bruts, bonus_type, bonus_player_id,
            player_a1_id, player_a2_id, player_b1_id, player_b2_id,
            player_a1:cdm_players!player_a1_id(id, position),
            player_a2:cdm_players!player_a2_id(id, position),
            player_b1:cdm_players!player_b1_id(id, position),
            player_b2:cdm_players!player_b2_id(id, position)
          `)
          .in('match_id', matchIds)
      : Promise.resolve({ data: [] }),

    matchIds.length > 0
      ? supabaseAdmin
          .from('cdm_player_ratings')
          .select('player_id, match_id, fotmob_rating')
          .in('match_id', matchIds)
      : Promise.resolve({ data: [] }),
  ])

  const extPicks = (picksRes.data ?? []) as unknown as ExtPick[]
  const ratings  = (ratingsRes.data ?? []) as unknown as RatingRow[]

  // Ratings map : `matchId:playerId` → fotmob_rating
  const ratingsMap: Record<string, number> = {}
  for (const r of ratings) {
    if (r.fotmob_rating != null) ratingsMap[`${r.match_id}:${r.player_id}`] = r.fotmob_rating
  }

  // ── Index picks : matchId → userId → points (pour chart cumulatif) ──────────
  const pickIndex: Record<string, Record<string, number>> = {}
  for (const p of extPicks) {
    if (!pickIndex[p.match_id]) pickIndex[p.match_id] = {}
    pickIndex[p.match_id][p.user_id] = p.points_finaux ?? 0
  }

  // ── Chart cumulatif ──────────────────────────────────────────────────────────
  const cumulative: Record<string, number> = {}
  for (const u of users) cumulative[u.id] = 0

  const chartData: ChartPoint[] = matches.map((match, i) => {
    const codeA = match.nation_a?.code ?? ''
    const codeB = match.nation_b?.code ?? ''
    const point: ChartPoint = {
      match:   i + 1,
      label:   `M${i + 1}`,
      nations: `${iso(codeA)} ${match.nation_a?.name ?? '?'} – ${iso(codeB)} ${match.nation_b?.name ?? '?'}`,
    }
    for (const u of users) {
      const pts = pickIndex[match.id]?.[u.id]
      if (pts !== undefined) cumulative[u.id] += pts
      point[u.id] = cumulative[u.id]
    }
    return point
  })

  const chartUsers: ChartUser[] = users.map(u => ({ id: u.id, username: u.username }))

  // ── Radar : note moyenne par poste (rating > 0 uniquement) ──────────────────
  const radarAccum: Record<string, Record<'GK' | 'DEF' | 'MID' | 'FWD', number[]>> = {}
  const bonusPtsByUser: Record<string, number> = {}
  for (const u of users) {
    radarAccum[u.id] = { GK: [], DEF: [], MID: [], FWD: [] }
    bonusPtsByUser[u.id] = 0
  }

  for (const pick of extPicks) {
    const acc = radarAccum[pick.user_id]
    if (!acc) continue

    const slots = [
      { id: pick.player_a1_id, pos: pick.player_a1?.position },
      { id: pick.player_a2_id, pos: pick.player_a2?.position },
      { id: pick.player_b1_id, pos: pick.player_b1?.position },
      { id: pick.player_b2_id, pos: pick.player_b2?.position },
    ]

    for (const { id, pos } of slots) {
      if (!id || !pos) continue
      const rating = ratingsMap[`${pick.match_id}:${id}`]
      if (rating == null || rating === 0) continue
      const key = pos as 'GK' | 'DEF' | 'MID' | 'FWD'
      if (acc[key]) acc[key].push(rating)
    }

    if (pick.bonus_type && pick.points_finaux != null && pick.points_bruts != null) {
      bonusPtsByUser[pick.user_id] = (bonusPtsByUser[pick.user_id] ?? 0) + (pick.points_finaux - pick.points_bruts)
    }
  }

  const radarData: RadarPoint[] = [
    { axis: 'GK',    key: 'GK'    },
    { axis: 'DEF',   key: 'DEF'   },
    { axis: 'MIL',   key: 'MID'   },
    { axis: 'ATT',   key: 'FWD'   },
    { axis: 'Bonus', key: 'bonus' },
  ].map(({ axis, key }) => {
    const point: RadarPoint = { subject: axis }
    for (const u of users) {
      if (key === 'bonus') {
        point[u.id] = bonusPtsByUser[u.id] ?? 0
      } else {
        const posKey = key as 'GK' | 'DEF' | 'MID' | 'FWD'
        point[u.id] = avg(radarAccum[u.id]?.[posKey] ?? [])
      }
    }
    return point
  })

  const radarUsers: RadarUser[] = users.map(u => ({ id: u.id, username: u.username }))

  // ── Classement par match : 2pts 1er / 1pt 2e / 0pt 3e+ ─────────────────────
  const matchRankPts: Record<string, Record<string, number>> = {}
  const matchRankPos: Record<string, Record<string, number>> = {}

  for (const match of matches) {
    const sorted = extPicks
      .filter(p => p.match_id === match.id && p.points_finaux != null)
      .sort((a, b) => (b.points_finaux ?? 0) - (a.points_finaux ?? 0))

    matchRankPts[match.id] = {}
    matchRankPos[match.id] = {}

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]
      const rank = i > 0 && sorted[i - 1].points_finaux === p.points_finaux
        ? matchRankPos[match.id][sorted[i - 1].user_id]
        : i + 1
      matchRankPos[match.id][p.user_id] = rank
      matchRankPts[match.id][p.user_id] = rank === 1 ? 2 : rank === 2 ? 1 : 0
    }
  }

  const userMatchPts: Record<string, number> = {}
  const userMedals: Record<string, { gold: number; silver: number; bronze: number }> = {}
  for (const u of users) {
    userMatchPts[u.id] = 0
    userMedals[u.id] = { gold: 0, silver: 0, bronze: 0 }
  }
  for (const matchId of matchIds) {
    for (const [userId, pts] of Object.entries(matchRankPts[matchId] ?? {})) {
      userMatchPts[userId] = (userMatchPts[userId] ?? 0) + pts
    }
    for (const [userId, rank] of Object.entries(matchRankPos[matchId] ?? {})) {
      if (rank === 1)      userMedals[userId].gold++
      else if (rank === 2) userMedals[userId].silver++
      else if (rank === 3) userMedals[userId].bronze++
    }
  }

  const usersRankedByMatchPts = [...users].sort((a, b) => {
    const ptsDiff = (userMatchPts[b.id] ?? 0) - (userMatchPts[a.id] ?? 0)
    if (ptsDiff !== 0) return ptsDiff
    return (userMedals[b.id]?.gold ?? 0) - (userMedals[a.id]?.gold ?? 0)
  })

  // ── Bonus stats ──────────────────────────────────────────────────────────────
  type BonusStat = { type: string; count: number; totalPts: number }
  const bonusMap: Record<string, BonusStat> = {}
  let noBonusTotalPts = 0
  let noBonusCount    = 0

  for (const p of extPicks) {
    if (p.points_finaux == null) continue
    if (!p.bonus_type) {
      noBonusTotalPts += p.points_finaux
      noBonusCount++
      continue
    }
    if (!bonusMap[p.bonus_type]) bonusMap[p.bonus_type] = { type: p.bonus_type, count: 0, totalPts: 0 }
    bonusMap[p.bonus_type].count++
    bonusMap[p.bonus_type].totalPts += p.points_finaux
  }

  const bonusStats = Object.values(bonusMap).sort((a, b) => b.totalPts - a.totalPts)
  const avgNoBonusPts = noBonusCount > 0 ? Math.round(noBonusTotalPts / noBonusCount * 10) / 10 : 0
  const maxAvgBonusPts = Math.max(...bonusStats.map(b => b.totalPts / b.count), avgNoBonusPts, 1)

  // ── Picks 💩 : joueurs pickés sans note (n'ont pas joué) ────────────────────
  const ratedMatchIds = new Set(ratings.map(r => r.match_id))
  const cacaPicks: Record<string, number> = {}
  for (const u of users) cacaPicks[u.id] = 0

  for (const pick of extPicks) {
    if (!ratedMatchIds.has(pick.match_id)) continue
    for (const pid of [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id]) {
      if (!pid) continue
      const rating = ratingsMap[`${pick.match_id}:${pid}`]
      if (rating == null || rating === 0) {
        cacaPicks[pick.user_id] = (cacaPicks[pick.user_id] ?? 0) + 1
      }
    }
  }

  const usersRankedByCaca = [...users].sort(
    (a, b) => (cacaPicks[a.id] ?? 0) - (cacaPicks[b.id] ?? 0)
  )

  // ─────────────────────────────────────────────────────────────────────────────

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

        {/* ── 1. Évolution des points cumulés ── */}
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

        {/* ── 2. Radar par participant ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Profil par poste
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <RadarChart users={radarUsers} data={radarData} />
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 px-1">
            Note moyenne par poste (hors note 0) · Bonus = total de points bonus gagnés
          </p>
        </section>

        {/* ── 3. Classement par match ── */}
        {matches.length > 0 && users.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Classement par match
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                      Joueur
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-center">
                      Pts
                    </th>
                    <th className="px-3 py-2.5 text-base text-center">🥇</th>
                    <th className="px-3 py-2.5 text-base text-center">🥈</th>
                    <th className="px-3 py-2.5 text-base text-center">🥉</th>
                  </tr>
                </thead>
                <tbody>
                  {usersRankedByMatchPts.map((u, uIdx) => {
                    const colorIdx = users.indexOf(u)
                    return (
                      <tr
                        key={u.id}
                        className={uIdx < usersRankedByMatchPts.length - 1 ? 'border-b border-zinc-800/50' : ''}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold" style={{ color: COLORS[colorIdx % COLORS.length] }}>
                            {u.username}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm font-bold tabular-nums text-zinc-100">
                            {userMatchPts[u.id] ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm tabular-nums text-zinc-300">
                            {userMedals[u.id]?.gold ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm tabular-nums text-zinc-300">
                            {userMedals[u.id]?.silver ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm tabular-nums text-zinc-300">
                            {userMedals[u.id]?.bronze ?? 0}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-zinc-600 px-4 py-2.5 border-t border-zinc-800/50">
                2 pts · 1re place · 1 pt · 2e place · 0 pt · 3e et au-delà
              </p>
            </div>
          </section>
        )}

        {/* ── 4. Statistiques bonus ── */}
        {bonusStats.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Bonus utilisés
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">

              {avgNoBonusPts > 0 && (
                <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/60">
                  <div className="w-32 text-right text-[11px] text-zinc-500">Sans bonus</div>
                  <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-600"
                      style={{ width: `${(avgNoBonusPts / maxAvgBonusPts) * 100}%` }}
                    />
                  </div>
                  <div className="w-24 text-[11px] text-zinc-500 tabular-nums">
                    {avgNoBonusPts} pts moy.
                  </div>
                </div>
              )}

              {bonusStats.map(stat => {
                const meta   = BONUS_META[stat.type]
                const avgPts = Math.round(stat.totalPts / stat.count * 10) / 10
                const pct    = Math.round((avgPts / maxAvgBonusPts) * 100)
                return (
                  <div key={stat.type} className="flex items-center gap-3">
                    <div className="w-32 text-right text-[11px] text-zinc-300 leading-tight">
                      {meta ? `${meta.icon} ${meta.name}` : stat.type}
                    </div>
                    <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta?.color ?? '#2aad66' }}
                      />
                    </div>
                    <div className="w-24 text-[11px] text-zinc-400 tabular-nums">
                      {avgPts} pts · {stat.count}×
                    </div>
                  </div>
                )
              })}

              <p className="text-[10px] text-zinc-600 pt-1">
                Moyenne des points finaux par match · nombre d&apos;utilisations
              </p>
            </div>
          </section>
        )}

        {/* ── 5. Picks 💩 ── */}
        {ratedMatchIds.size > 0 && users.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Picks 💩
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                      Joueur
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider text-center">
                      💩 picks à 0 pts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersRankedByCaca.map((u, uIdx) => {
                    const colorIdx = users.indexOf(u)
                    const count = cacaPicks[u.id] ?? 0
                    return (
                      <tr
                        key={u.id}
                        className={uIdx < usersRankedByCaca.length - 1 ? 'border-b border-zinc-800/50' : ''}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold" style={{ color: COLORS[colorIdx % COLORS.length] }}>
                            {u.username}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold tabular-nums ${count === 0 ? 'text-green-400' : 'text-zinc-300'}`}>
                            {count === 0 ? '✨ 0' : count}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-zinc-600 px-4 py-2.5 border-t border-zinc-800/50">
                Joueurs pickés sans note (absents ou n&apos;ayant pas joué) sur les matchs notés
              </p>
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
