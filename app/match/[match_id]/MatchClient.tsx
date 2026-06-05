'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RatingEntry = {
  player_id: string
  fotmob_rating: number | null
  goals: number | null
  assists: number | null
  penalty_saved: number | null
}

type RatingData = Omit<RatingEntry, 'player_id'>

export type PickRow = {
  id: string
  points_finaux: number | null
  bonus_type: string | null
  bonus_player_id: string | null
  player_a1_id: string | null
  player_a2_id: string | null
  player_b1_id: string | null
  player_b2_id: string | null
  player_a1: { name: string; position: string } | null
  player_a2: { name: string; position: string } | null
  player_b1: { name: string; position: string } | null
  player_b2: { name: string; position: string } | null
  user: { id: string; auth_id: string; username: string; photo_url: string | null } | null
}

export type MatchData = {
  id: string
  kickoff_at: string
  status: string
  score_a: number | null
  score_b: number | null
  phase: string | null
  points_multiplier: number | null
  nation_a: { name: string; code: string } | null
  nation_b: { name: string; code: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BONUS_META: Record<string, { icon: string; name: string }> = {
  double_mise:     { icon: '⚡', name: 'Double Mise' },
  troisieme_homme: { icon: '👤', name: 'Troisième Homme' },
  bouclier:        { icon: '🛡️', name: 'Bouclier' },
  sniper:          { icon: '🎯', name: 'Sniper' },
  passeur_genie:   { icon: '🎪', name: 'Passeur de Génie' },
  mur:             { icon: '🧱', name: 'Mur' },
  capitaine_bis:   { icon: '👑', name: 'Capitaine Bis' },
  espion:          { icon: '🕵️', name: 'Espion' },
  all_in:          { icon: '🎲', name: 'All-In' },
}

const MEDALS = ['🥇', '🥈', '🥉']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeEffectivePoints(
  pick: PickRow,
  ratingsMap: Record<string, RatingData>,
  multiplier: number,
): number | null {
  if (pick.points_finaux != null) return pick.points_finaux
  const ids = [pick.player_a1_id, pick.player_a2_id, pick.player_b1_id, pick.player_b2_id]
  if (!ids.some(id => id && ratingsMap[id]?.fotmob_rating != null)) return null
  let total = 0
  for (const id of ids) {
    if (!id) continue
    const rating = ratingsMap[id]?.fotmob_rating ?? 0
    total += id === pick.bonus_player_id ? rating * 1.5 : rating
  }
  return Math.round(total * multiplier * 10) / 10
}

// ─── PickCard ─────────────────────────────────────────────────────────────────

function PickCard({
  pick, rank, ratingsMap, highlight, effectivePoints,
}: {
  pick: PickRow
  rank: number
  ratingsMap: Record<string, RatingData>
  highlight: boolean
  effectivePoints: number | null
}) {
  const u = pick.user
  const bonus = pick.bonus_type ? BONUS_META[pick.bonus_type] : null
  const players = [
    { id: pick.player_a1_id, info: pick.player_a1 },
    { id: pick.player_a2_id, info: pick.player_a2 },
    { id: pick.player_b1_id, info: pick.player_b1 },
    { id: pick.player_b2_id, info: pick.player_b2 },
  ]

  return (
    <div className={[
      'rounded-xl border p-3.5 space-y-2',
      highlight ? 'bg-green-950/15 border-green-700/50' : 'bg-zinc-900 border-zinc-800',
    ].join(' ')}>

      <div className="flex items-center gap-2.5">
        <div className="w-7 flex-shrink-0 text-center">
          {rank <= 3
            ? <span className="text-base leading-none">{MEDALS[rank - 1]}</span>
            : <span className="text-xs text-zinc-600 font-mono tabular-nums">{rank}</span>
          }
        </div>
        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-zinc-500">
          {u?.photo_url
            ? <Image src={u.photo_url} alt={u.username} width={28} height={28} className="object-cover w-full h-full" />
            : u?.username?.[0]?.toUpperCase() ?? '?'
          }
        </div>
        <span className={`flex-1 text-sm font-semibold truncate ${highlight ? 'text-green-400' : 'text-zinc-100'}`}>
          {u?.username ?? 'Anonyme'}
          {highlight && <span className="ml-1.5 text-[10px] text-zinc-600 font-normal">moi</span>}
        </span>
        <div className="flex-shrink-0 text-right">
          {effectivePoints != null
            ? <span className="text-sm font-bold text-green-400 tabular-nums">{effectivePoints} pts</span>
            : <span className="text-xs text-zinc-600 flex items-center gap-1">⏳ –</span>
          }
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-[47px]">
        {players.map(({ id, info }) => {
          if (!info) return null
          const r = id ? ratingsMap[id] : undefined
          const isStar = !!id && id === pick.bonus_player_id
          return (
            <span key={id ?? info.name} className={[
              'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border',
              isStar
                ? 'bg-yellow-950/40 border-yellow-800/40 text-yellow-200'
                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-300',
            ].join(' ')}>
              {isStar && <span className="text-[9px] text-yellow-400">⭐</span>}
              <span className="truncate max-w-[72px]">{info.name}</span>
              {r?.fotmob_rating != null
                ? <span className={`font-bold text-[10px] tabular-nums ${r.fotmob_rating >= 7 ? 'text-green-400' : r.fotmob_rating >= 5 ? 'text-zinc-400' : 'text-red-400'}`}>{r.fotmob_rating}</span>
                : <span className="text-zinc-600 text-[10px]">–</span>
              }
              {r && (r.goals ?? 0) > 0 && <span className="text-[10px]">⚽</span>}
              {r && (r.assists ?? 0) > 0 && <span className="text-[10px]">🅰️</span>}
              {r && (r.penalty_saved ?? 0) > 0 && <span className="text-[10px]">🧤</span>}
            </span>
          )
        })}
      </div>

      {bonus && (
        <div className="pl-[47px]">
          <span className="inline-flex items-center gap-1 text-[11px] text-violet-300 bg-violet-950/30 border border-violet-800/30 px-2 py-0.5 rounded-md">
            {bonus.icon} {bonus.name}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MatchClient({
  match,
  initialPicks,
  initialRatings,
  myAuthId,
}: {
  match: MatchData
  initialPicks: PickRow[]
  initialRatings: RatingEntry[]
  myAuthId: string | undefined
}) {
  const [picks, setPicks] = useState<PickRow[]>(initialPicks)
  const [ratings, setRatings] = useState<RatingEntry[]>(initialRatings)
  const [countdown, setCountdown] = useState(30)

  const isUpcoming    = match.status === 'a_venir'
  const isOngoing     = match.status === 'en_cours'
  const isFinished    = match.status === 'termine'
  const hasRatings    = ratings.length > 0
  const awaitingNotes = isFinished && picks.length > 0 && !hasRatings

  const ratingsMap: Record<string, RatingData> = Object.fromEntries(
    ratings.map(r => [r.player_id, {
      fotmob_rating: r.fotmob_rating,
      goals: r.goals,
      assists: r.assists,
      penalty_saved: r.penalty_saved,
    }])
  )

  const multiplier  = match.points_multiplier ?? 1
  const myPick      = picks.find(p => p.user?.auth_id === myAuthId) ?? null
  const rankedPicks = [...picks].sort((a, b) => {
    const ap = computeEffectivePoints(a, ratingsMap, multiplier) ?? -999
    const bp = computeEffectivePoints(b, ratingsMap, multiplier) ?? -999
    return bp - ap
  })
  const myRank = myPick ? rankedPicks.findIndex(p => p.id === myPick.id) + 1 : 0

  // Refresh toutes les 30 secondes + countdown 1s
  useEffect(() => {
    if (!isOngoing) return

    let secondsLeft = 30

    const tick = setInterval(async () => {
      secondsLeft -= 1
      setCountdown(secondsLeft)

      if (secondsLeft <= 0) {
        secondsLeft = 30
        setCountdown(30)
        try {
          const res  = await fetch(`/api/match/${match.id}/live`)
          const data = await res.json()
          if (data.ratings) setRatings(data.ratings)
          if (data.picks)   setPicks(data.picks)
        } catch { /* silent fail */ }
      }
    }, 1000)

    return () => clearInterval(tick)
  }, [isOngoing, match.id])

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-10">

      {/* ── Indicateur live ── */}
      {isOngoing && (
        <div className="flex items-center gap-2 text-[11px] text-orange-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          Live — mise à jour dans {countdown}s
        </div>
      )}

      {/* ── À venir ── */}
      {isUpcoming && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-8 text-center space-y-3">
          <p className="text-3xl">📅</p>
          <p className="text-sm font-medium text-zinc-300">Ce match n&apos;a pas encore eu lieu</p>
          {!myPick ? (
            <Link
              href={`/pick/${match.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Faire mes picks →
            </Link>
          ) : (
            <Link
              href={`/pick/${match.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Modifier mes picks
            </Link>
          )}
        </div>
      )}

      {/* ── En cours ── */}
      {isOngoing && (
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-xl flex-shrink-0">⚽</span>
          <div>
            <p className="text-sm font-semibold text-blue-300">Match en cours — picks verrouillés</p>
            <p className="text-xs text-zinc-500 mt-0.5">Les résultats seront disponibles après le match</p>
          </div>
        </div>
      )}

      {/* ── Notes en attente ── */}
      {awaitingNotes && (
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-xl flex-shrink-0">⏳</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">Notes ESPN en attente</p>
            <p className="text-xs text-zinc-500 mt-0.5">Le calcul des points sera effectué dès que les notes sont disponibles</p>
          </div>
        </div>
      )}

      {/* ── Mes picks ── */}
      {myPick && (isFinished || isOngoing) && (
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Mes picks
          </h2>
          <PickCard
            pick={myPick}
            rank={myRank}
            ratingsMap={ratingsMap}
            highlight
            effectivePoints={computeEffectivePoints(myPick, ratingsMap, multiplier)}
          />
        </section>
      )}

      {/* ── Classement du match ── */}
      {(isFinished || isOngoing) && rankedPicks.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Classement du match
          </h2>
          <div className="space-y-2">
            {rankedPicks.map((pick, i) => (
              <PickCard
                key={pick.id}
                pick={pick}
                rank={i + 1}
                ratingsMap={ratingsMap}
                highlight={false}
                effectivePoints={computeEffectivePoints(pick, ratingsMap, multiplier)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Aucun pick ── */}
      {(isFinished || isOngoing) && rankedPicks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-500">Aucun pick enregistré pour ce match</p>
        </div>
      )}

      {/* ── Participants si à venir ── */}
      {isUpcoming && picks.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            {picks.length} participant{picks.length > 1 ? 's' : ''} inscrit{picks.length > 1 ? 's' : ''}
          </h2>
          <div className="flex flex-wrap gap-2">
            {picks.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-[9px] text-zinc-400 font-semibold overflow-hidden">
                  {p.user?.photo_url
                    ? <Image src={p.user.photo_url} alt="" width={20} height={20} className="object-cover w-full h-full" />
                    : p.user?.username?.[0]?.toUpperCase()
                  }
                </div>
                <span className="text-xs text-zinc-400">{p.user?.username ?? '?'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
