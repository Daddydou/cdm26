import Image from 'next/image'
import { effectiveRating, ratingColorClass } from '@/lib/scoring-display'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchPick = {
  id: string
  match_id: string
  points_finaux: number | null
  bonus_type: string | null
  bonus_player_id: string | null
  bonus_player: { id: string; name: string; position: string } | null
  player_a1: { id: string; name: string; position: string } | null
  player_a2: { id: string; name: string; position: string } | null
  player_b1: { id: string; name: string; position: string } | null
  player_b2: { id: string; name: string; position: string } | null
  user: { id: string; username: string; photo_url: string | null } | null
}

export type MatchRating = {
  player_id: string
  match_id: string
  fotmob_rating: number | null
  goals: number | null
  assists: number | null
  penalty_saved: number | null
}

// ─── Component ────────────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉']

export default function MatchPickRow({
  pick,
  rank,
  matchId,
  ratingsMap,
  cdmUserId,
}: {
  pick: MatchPick
  rank: number
  matchId: string
  ratingsMap: Record<string, MatchRating>
  cdmUserId: string | null
}) {
  const isMe = pick.user?.id === cdmUserId
  const players = [pick.player_a1, pick.player_a2, pick.player_b1, pick.player_b2]
    .filter(Boolean) as NonNullable<MatchPick['player_a1']>[]

  const totalGoals   = players.reduce((s, p) => s + (ratingsMap[`${matchId}:${p.id}`]?.goals   ?? 0), 0)
  const totalAssists = players.reduce((s, p) => s + (ratingsMap[`${matchId}:${p.id}`]?.assists ?? 0), 0)
  const hasPenSave   = players.some(p => (ratingsMap[`${matchId}:${p.id}`]?.penalty_saved ?? 0) > 0)
  const bonusPlayer  = pick.bonus_player
  const bonusPlayerR = bonusPlayer ? ratingsMap[`${matchId}:${bonusPlayer.id}`] : undefined
  const bonusRating  = bonusPlayerR?.fotmob_rating ?? 0
  // Le plancher du bouclier ne s'applique qu'une fois le match noté, sinon un
  // match à venir afficherait 5 pour tout le monde.
  const matchHasRatings = Object.keys(ratingsMap).some(k => k.startsWith(`${matchId}:`))

  // Joueur ×2 : stocké via bonus_player_id seul (bonus_type null ou autre bonus classique).
  // Le 3e homme utilise aussi bonus_player_id, mais pour un 5e joueur ajouté — on l'exclut.
  const x2PlayerId = pick.bonus_type === 'troisieme_homme' ? null : pick.bonus_player_id
  const x2Name = x2PlayerId
    ? (bonusPlayer?.id === x2PlayerId ? bonusPlayer.name : players.find(p => p.id === x2PlayerId)?.name) ?? null
    : null

  const bonusLabel = (() => {
    switch (pick.bonus_type) {
      case 'sniper':          return `🎯 Sniper +${totalGoals * 3}`
      case 'passeur_genie':   return `🎪 Passeur de Génie +${totalAssists * 3}`
      case 'troisieme_homme': return `👤 3e Homme +${bonusRating}`
      case 'mur':             return hasPenSave ? '🧱 Mur +8' : '🧱 Mur +0'
      case 'double_mise':     return '⚡ Double Mise ×2'
      case 'bouclier':        return '🛡️ Bouclier'
      case 'espion':          return '🕵️ Espion'
      case 'all_in':          return '🎲 All-In'
      default: return null
    }
  })()

  return (
    <div className="flex items-start gap-2">
      {/* Rang */}
      <div className="w-5 text-center flex-shrink-0 pt-0.5">
        {rank <= 3
          ? <span className="text-sm leading-none">{MEDALS[rank - 1]}</span>
          : <span className="text-[11px] text-zinc-600 font-mono tabular-nums">{rank}</span>
        }
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-[8px] font-semibold text-zinc-500">
            {pick.user?.photo_url
              ? <Image src={pick.user.photo_url} alt="" width={16} height={16} className="object-cover w-full h-full" />
              : pick.user?.username?.[0]?.toUpperCase() ?? '?'
            }
          </div>
          <span className={`text-[12px] font-semibold truncate ${isMe ? 'text-green-400' : 'text-zinc-100'}`}>
            {pick.user?.username ?? '?'}
            {isMe && <span className="ml-1 text-[10px] text-zinc-600 font-normal">moi</span>}
          </span>
          <span className={`text-[11px] font-bold tabular-nums ml-auto flex-shrink-0 ${pick.points_finaux != null && pick.points_finaux > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
            {pick.points_finaux != null ? `${pick.points_finaux} pts` : '– pts'}
          </span>
        </div>

        {/* Joueurs pickés avec notes */}
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {players.map(p => {
              const r = ratingsMap[`${matchId}:${p.id}`]
              const eff = effectiveRating(r?.fotmob_rating, pick.bonus_type, matchHasRatings)
              const isStar = p.id === x2PlayerId
              return (
                <span
                  key={p.id}
                  className={[
                    'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border',
                    isStar
                      ? 'bg-yellow-950/40 border-yellow-800/40 text-yellow-200'
                      : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-300',
                  ].join(' ')}
                >
                  {isStar && <span className="text-[9px] text-yellow-400">⭐</span>}
                  <span>{p.name}</span>
                  {eff.value != null
                    ? <span
                        className={`font-bold tabular-nums ${ratingColorClass(eff.value, eff.shielded)}`}
                        title={eff.shielded ? 'Note remontée à 5 par le bouclier' : undefined}
                      >
                        {eff.value}{eff.shielded && <span className="ml-0.5 text-[9px]">🛡️</span>}
                      </span>
                    : <span className="text-zinc-600">–</span>
                  }
                  {(r?.goals ?? 0) > 0 && <span>{'⚽'.repeat(r!.goals!)}</span>}
                  {(r?.assists ?? 0) > 0 && <span>{'🅰️'.repeat(r!.assists!)}</span>}
                  {(r?.penalty_saved ?? 0) > 0 && <span>🧤</span>}
                </span>
              )
            })}
            {pick.bonus_type === 'troisieme_homme' && bonusPlayer && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border bg-violet-950/40 border-violet-800/40 text-violet-200">
                <span className="text-[9px] text-violet-400 font-bold">3e</span>
                <span>{bonusPlayer.name}</span>
                {bonusPlayerR?.fotmob_rating != null
                  ? <span className={`font-bold tabular-nums ${bonusPlayerR.fotmob_rating >= 7 ? 'text-green-400' : bonusPlayerR.fotmob_rating >= 5 ? 'text-zinc-400' : 'text-red-400'}`}>{bonusPlayerR.fotmob_rating}</span>
                  : <span className="text-zinc-600">–</span>
                }
                {(bonusPlayerR?.goals ?? 0) > 0 && <span>{'⚽'.repeat(bonusPlayerR!.goals!)}</span>}
                {(bonusPlayerR?.assists ?? 0) > 0 && <span>{'🅰️'.repeat(bonusPlayerR!.assists!)}</span>}
              </span>
            )}
          </div>
          {(bonusLabel || x2Name) && (
            <div className="flex flex-wrap gap-1">
              {x2Name && (
                <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-yellow-950/30 border border-yellow-800/30 text-yellow-300 font-semibold">
                  ⭐ ×2 {x2Name}
                </span>
              )}
              {bonusLabel && (
                <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded bg-violet-950/30 border border-violet-800/30 text-violet-300 font-semibold">
                  {bonusLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
