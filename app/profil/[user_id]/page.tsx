import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoFlag(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

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

const POS: Record<string, string> = { GK: 'G', DEF: 'D', MID: 'M', FWD: 'A' }
const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
const MEDALS = ['🥇', '🥈', '🥉']

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerInfo = { name: string; position: string } | null

type PickData = {
  id: string
  bonus_type: string | null
  bonus_player_id: string | null
  points_finaux: number | null
  points_bruts: number | null
  player_a1_id: string | null
  player_a2_id: string | null
  player_b1_id: string | null
  player_b2_id: string | null
  player_a1: PlayerInfo
  player_a2: PlayerInfo
  player_b1: PlayerInfo
  player_b2: PlayerInfo
  match: {
    id: string
    kickoff_at: string
    phase: string | null
    points_multiplier: number | null
    status: string
    score_a: number | null
    score_b: number | null
    nation_a: { name: string; code: string } | null
    nation_b: { name: string; code: string } | null
  } | null
}

type RatingData = {
  fotmob_rating: number | null
  goals: number | null
  assists: number | null
  penalty_saved: number | null
}

type Player = {
  id: string
  name: string
  position: string
  nation_id: string
  nation: { name: string; code: string } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilPage({ params }: { params: { user_id: string } }) {
  const supabase      = createClient()
  const supabaseAdmin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Requêtes parallèles initiales
  const [profileRes, allUsersRes, picksRes] = await Promise.all([
    supabase
      .from('cdm_users')
      .select('id, auth_id, username, photo_url, total_points')
      .eq('id', params.user_id)
      .single(),

    supabase
      .from('cdm_users')
      .select('id, total_points')
      .order('total_points', { ascending: false, nullsFirst: false }),

    supabase
      .from('cdm_picks')
      .select(`
        id, bonus_type, bonus_player_id, points_finaux, points_bruts,
        player_a1_id, player_a2_id, player_b1_id, player_b2_id,
        player_a1:cdm_players!player_a1_id(name, position),
        player_a2:cdm_players!player_a2_id(name, position),
        player_b1:cdm_players!player_b1_id(name, position),
        player_b2:cdm_players!player_b2_id(name, position),
        match:cdm_matches!match_id(
          id, kickoff_at, phase, points_multiplier, status, score_a, score_b,
          nation_a:cdm_nations!nation_a_id(name, code),
          nation_b:cdm_nations!nation_b_id(name, code)
        )
      `)
      .eq('user_id', params.user_id),
  ])

  console.log('[profil] user_id param:', params.user_id)
  console.log('[profil] profile.id:', profileRes.data?.id)

  if (!profileRes.data) notFound()

  const profile  = profileRes.data
  const allUsers = allUsersRes.data ?? []
  const picks: PickData[] = (picksRes.data ?? []) as unknown as PickData[]

  // Count via client admin pour bypasser le RLS
  const { data: allPicks, error: picksCountError } = await supabaseAdmin
    .from('cdm_picks')
    .select('id')
    .eq('user_id', params.user_id)

  console.log('[profil] allPicks:', allPicks, picksCountError)

  picks.sort((a, b) => (b.match?.kickoff_at ?? '').localeCompare(a.match?.kickoff_at ?? ''))

  // Rang dans le classement général
  const rank = allUsers.findIndex(u => u.id === params.user_id) + 1

  // Stats
  const totalPoints = profile.total_points ?? 0

  // Notes FotMob — une seule requête croisée match×joueur
  const matchIds    = [...new Set(picks.map(p => p.match?.id).filter(Boolean) as string[])]
  const allPlayerIds = [...new Set(
    picks.flatMap(p => [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id])
      .filter(Boolean) as string[]
  )]

  const { data: ratingsData } = matchIds.length > 0 && allPlayerIds.length > 0
    ? await supabase
        .from('cdm_player_ratings')
        .select('player_id, match_id, fotmob_rating, goals, assists, penalty_saved')
        .in('match_id', matchIds)
        .in('player_id', allPlayerIds)
    : { data: [] as { player_id: string; match_id: string; fotmob_rating: number | null; goals: number | null; assists: number | null; penalty_saved: number | null }[] }

  // Clé : `matchId:playerId`
  const ratingsMap: Record<string, RatingData> = Object.fromEntries(
    (ratingsData ?? []).map(r => [`${r.match_id}:${r.player_id}`, r])
  )

  // Joueurs déjà utilisés + tous les joueurs (pour section disponibles)
  const [usedRes, allPlayersRes] = await Promise.all([
    supabase
      .from('cdm_player_usage')
      .select('player_id')
      .eq('user_id', params.user_id)
      .or('actually_played.is.null,actually_played.eq.true'),

    supabase
      .from('cdm_players')
      .select('id, name, position, nation_id, nation:cdm_nations!nation_id(name, code)'),
  ])

  const usedIds        = new Set((usedRes.data ?? []).map(u => u.player_id))
  const allPlayers     = ((allPlayersRes.data ?? []) as unknown as Player[])
  const available      = allPlayers
    .filter(p => !usedIds.has(p.id))
    .sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9))

  const byNation: Record<string, Player[]> = {}
  for (const p of available) {
    const n = p.nation?.name ?? 'Autre'
    if (!byNation[n]) byNation[n] = []
    byNation[n].push(p)
  }
  const nationEntries = Object.entries(byNation).sort(([a], [b]) => a.localeCompare(b, 'fr'))

  const isMe = !!user && profile.auth_id === user.id

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
            ← Retour
          </Link>
          <span className="flex-1 text-sm font-semibold text-zinc-100 text-center truncate">
            {profile.username}
          </span>
          {isMe ? (
            <Link
              href={`/profil/${profile.id}/edit`}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
            >
              Modifier
            </Link>
          ) : (
            <div className="w-14" />
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-7 pb-10">

        {/* ── Avatar + nom + rang ── */}
        <section className="flex flex-col items-center gap-3 pt-2">
          <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center text-2xl font-bold text-zinc-500 flex-shrink-0">
            {profile.photo_url
              ? <Image src={profile.photo_url} alt={profile.username} width={80} height={80} className="object-cover w-full h-full" />
              : profile.username[0]?.toUpperCase()
            }
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-zinc-100">{profile.username}</h1>
            <p className="text-sm text-zinc-400">
              {rank > 0 && rank <= 3 && <span className="mr-1">{MEDALS[rank - 1]}</span>}
              <span className={`font-bold tabular-nums ${totalPoints > 0 ? 'text-green-400' : 'text-zinc-600'}`}>
                {totalPoints} pts
              </span>
              {rank > 0 && (
                <span className="ml-2 text-zinc-600">· {rank}{rank === 1 ? 'er' : 'ème'}</span>
              )}
            </p>
          </div>
        </section>

        {/* ── Stats rapides ── */}
        <section>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400 tabular-nums">{totalPoints} pts</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Total points</p>
          </div>
        </section>

        {/* ── Historique des picks ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Historique des picks
          </h2>

          {picks.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-8 text-center">
              <p className="text-sm text-zinc-500">Aucun pick pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {picks.map(pick => {
                const m = pick.match
                if (!m) return null

                const isFinished = m.status === 'termine'
                const isOngoing  = m.status === 'en_cours'
                const multiplier = m.points_multiplier ?? 1
                const pts        = pick.points_finaux
                const bonus      = pick.bonus_type ? BONUS_META[pick.bonus_type] : null

                const players = [
                  { id: pick.player_a1_id, info: pick.player_a1 },
                  { id: pick.player_a2_id, info: pick.player_a2 },
                  { id: pick.player_b1_id, info: pick.player_b1 },
                  { id: pick.player_b2_id, info: pick.player_b2 },
                ].filter(p => p.info != null)

                return (
                  <div key={pick.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">

                    {/* Match header — cliquable */}
                    <Link href={`/match/${m.id}`} className="block px-4 pt-3.5 pb-2.5 hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="text-lg leading-none flex-shrink-0">{isoFlag(m.nation_a?.code ?? '')}</span>
                          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[68px]">{m.nation_a?.name}</span>
                          <span className="text-xs font-bold text-zinc-400 px-1 tabular-nums flex-shrink-0">
                            {isFinished || isOngoing
                              ? `${m.score_a ?? '?'} - ${m.score_b ?? '?'}`
                              : 'VS'
                            }
                          </span>
                          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[68px]">{m.nation_b?.name}</span>
                          <span className="text-lg leading-none flex-shrink-0">{isoFlag(m.nation_b?.code ?? '')}</span>
                        </div>

                        <div className="flex-shrink-0">
                          {pts != null ? (
                            <span className="text-sm font-bold text-green-400 tabular-nums">{pts} pts</span>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isOngoing ? 'bg-orange-950 text-orange-400' : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              {isOngoing ? 'En cours' : 'À venir'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-zinc-500 capitalize">
                          {format(new Date(m.kickoff_at), "d MMM · HH'h'mm", { locale: fr })}
                        </p>
                        {m.phase && <span className="text-[10px] text-zinc-600">· {m.phase}</span>}
                        {multiplier !== 1 && <span className="text-[10px] text-amber-500 font-semibold">×{multiplier}</span>}
                      </div>
                    </Link>

                    {/* Joueurs + bonus */}
                    <div className="px-4 pb-3.5 space-y-2">
                      {isFinished ? (
                        <div className="flex flex-wrap gap-1.5">
                          {players.map(({ id, info }) => {
                            if (!info) return null
                            const rKey   = `${m.id}:${id}`
                            const r      = ratingsMap[rKey]
                            const isStar = !!id && id === pick.bonus_player_id
                            const rating = r?.fotmob_rating

                            return (
                              <span
                                key={id ?? info.name}
                                className={[
                                  'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border',
                                  isStar
                                    ? 'bg-yellow-950/40 border-yellow-800/40 text-yellow-200'
                                    : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-300',
                                ].join(' ')}
                              >
                                {isStar && <span className="text-[9px] text-yellow-400">⭐</span>}
                                <span className="text-[10px] text-zinc-600">{POS[info.position] ?? info.position}</span>
                                <span className="truncate max-w-[72px]">{info.name}</span>
                                {rating != null
                                  ? <span className={`font-bold text-[10px] tabular-nums ${rating >= 7 ? 'text-green-400' : rating >= 5 ? 'text-zinc-400' : 'text-red-400'}`}>{rating}</span>
                                  : <span className="text-zinc-600 text-[10px]">–</span>
                                }
                                {(r?.goals ?? 0) > 0 && <span className="text-[10px]">⚽</span>}
                                {(r?.assists ?? 0) > 0 && <span className="text-[10px]">🅰️</span>}
                                {(r?.penalty_saved ?? 0) > 0 && <span className="text-[10px]">🧤</span>}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-600 italic">En attente des notes…</p>
                      )}

                      {bonus && (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] text-violet-300 bg-violet-950/30 border border-violet-800/30 px-2 py-0.5 rounded-md">
                            {bonus.icon} {bonus.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {pts != null && (
                      <div className="h-0.5 bg-gradient-to-r from-green-600/40 via-green-500/20 to-transparent" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Joueurs encore disponibles ── */}
        {available.length > 0 && (
          <section>
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none mb-3">
                <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em]">
                  Joueurs disponibles ({available.length})
                </h2>
                <span className="text-zinc-600 text-[10px] transition-transform group-open:rotate-180 inline-block">▼</span>
              </summary>

              <div className="space-y-4">
                {nationEntries.map(([nationName, players]) => {
                  const code = players[0]?.nation?.code ?? ''
                  return (
                    <div key={nationName}>
                      <p className="text-[11px] font-semibold text-zinc-500 mb-1.5 flex items-center gap-1.5">
                        <span>{code ? isoFlag(code) : '🏳️'}</span>
                        {nationName}
                        <span className="text-zinc-700 font-normal">({players.length})</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {players.map(p => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 text-zinc-400"
                          >
                            <span className="text-[10px] text-zinc-600">{POS[p.position] ?? p.position}</span>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>
          </section>
        )}

      </main>
    </div>
  )
}
