import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

type Match = {
  id: string
  kickoff_at: string
  status: string
  score_a: number | null
  score_b: number | null
  phase: string | null
  nation_a: { name: string; code: string } | null
  nation_b: { name: string; code: string } | null
}

type MatchPick = {
  id: string
  match_id: string
  points_finaux: number | null
  bonus_player_id: string | null
  player_a1: { id: string; name: string; position: string } | null
  player_a2: { id: string; name: string; position: string } | null
  player_b1: { id: string; name: string; position: string } | null
  player_b2: { id: string; name: string; position: string } | null
  user: { id: string; username: string; photo_url: string | null } | null
}

type MatchRating = {
  player_id: string
  match_id: string
  fotmob_rating: number | null
  goals: number | null
  assists: number | null
  penalty_saved: number | null
}

// ─── Drapeau emoji ────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ResultatsPage() {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Nations vedettes
  const { data: featuredNations } = await supabase
    .from('cdm_nations')
    .select('id')
    .in('name', ['Mexique', 'Brésil', 'Maroc', 'États-Unis', 'Allemagne', 'Pays-Bas',
                  'Suède', 'Belgique', 'Espagne', 'France', 'Argentine', 'Portugal',
                  'Angleterre', 'Croatie'])

  const featuredIds  = featuredNations?.map(n => n.id) ?? []
  const nationFilter = featuredIds.length > 0
    ? `nation_a_id.in.(${featuredIds.join(',')}),nation_b_id.in.(${featuredIds.join(',')})`
    : null

  // Profil CDM
  const { data: cdmUser } = user
    ? await supabase.from('cdm_users').select('id').eq('auth_id', user.id).single()
    : { data: null }

  // Tous les matchs terminés / en cours
  const matchesQuery = supabase
    .from('cdm_matches')
    .select('id, kickoff_at, status, score_a, score_b, phase, nation_a:cdm_nations!nation_a_id(name, code), nation_b:cdm_nations!nation_b_id(name, code)')
    .in('status', ['termine', 'en_cours'])
    .order('kickoff_at', { ascending: false })

  const { data: matchesRaw } = nationFilter
    ? await matchesQuery.or(nationFilter)
    : await matchesQuery

  const matches = (matchesRaw ?? []) as unknown as Match[]
  const matchIds = matches.map(m => m.id)

  // Picks (tous participants) + ratings en parallèle
  const [matchPicksRes, matchRatingsRes] = await Promise.all([
    matchIds.length > 0
      ? supabaseAdmin
          .from('cdm_picks')
          .select(`
            id, match_id, points_finaux, bonus_player_id,
            player_a1:cdm_players!player_a1_id(id, name, position),
            player_a2:cdm_players!player_a2_id(id, name, position),
            player_b1:cdm_players!player_b1_id(id, name, position),
            player_b2:cdm_players!player_b2_id(id, name, position),
            user:cdm_users!user_id(id, username, photo_url)
          `)
          .in('match_id', matchIds)
          .order('points_finaux', { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [] }),

    matchIds.length > 0
      ? supabase
          .from('cdm_player_ratings')
          .select('player_id, match_id, fotmob_rating, goals, assists, penalty_saved')
          .in('match_id', matchIds)
      : Promise.resolve({ data: [] }),
  ])

  // Picks groupés par match_id (déjà triés points desc)
  const allPicks = (matchPicksRes.data ?? []) as unknown as MatchPick[]
  const picksByMatch: Record<string, MatchPick[]> = {}
  for (const pick of allPicks) {
    if (!picksByMatch[pick.match_id]) picksByMatch[pick.match_id] = []
    picksByMatch[pick.match_id].push(pick)
  }

  // Ratings map : `matchId:playerId`
  const allRatings = (matchRatingsRes.data ?? []) as unknown as MatchRating[]
  const ratingsMap: Record<string, MatchRating> = {}
  for (const r of allRatings) {
    ratingsMap[`${r.match_id}:${r.player_id}`] = r
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <h1 className="text-base font-bold tracking-tight">
            CDM<span className="text-green-500">26</span>
            <span className="ml-2 text-zinc-500 font-normal text-sm">· Résultats</span>
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {matches.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-10 text-center">
            <p className="text-3xl mb-3">🏆</p>
            <p className="text-sm text-zinc-400 font-medium">Aucun résultat disponible pour le moment</p>
          </div>
        ) : (
          matches.map(match => {
            const ranked = picksByMatch[match.id] ?? []
            const isFinished = match.status === 'termine'

            return (
              <div key={match.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

                {/* Match header */}
                <Link
                  href={`/match/${match.id}`}
                  className="flex items-center gap-3 px-4 pt-3.5 pb-3 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-lg leading-none">{iso(match.nation_a?.code ?? '')}</span>
                      <span className="text-sm font-semibold text-zinc-200 truncate max-w-[72px]">{match.nation_a?.name}</span>
                      <span className="text-sm font-bold text-zinc-300 tabular-nums px-1">
                        {match.score_a ?? '?'} - {match.score_b ?? '?'}
                      </span>
                      <span className="text-sm font-semibold text-zinc-200 truncate max-w-[72px]">{match.nation_b?.name}</span>
                      <span className="text-lg leading-none">{iso(match.nation_b?.code ?? '')}</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', 'd MMM', { locale: fr })}
                      {match.phase && ` · ${match.phase}`}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                    isFinished ? 'bg-zinc-800 text-zinc-500' : 'bg-orange-950 text-orange-400'
                  }`}>
                    {isFinished ? 'Terminé' : 'En cours'}
                  </span>
                </Link>

                {/* Classement participants */}
                {ranked.length > 0 && (
                  <div className="border-t border-zinc-800/60 px-4 py-3 space-y-2.5">
                    {ranked.map((pick, i) => {
                      const isMe = pick.user?.id === cdmUser?.id
                      const players = [pick.player_a1, pick.player_a2, pick.player_b1, pick.player_b2]
                        .filter(Boolean) as NonNullable<MatchPick['player_a1']>[]

                      return (
                        <div key={pick.id} className="flex items-start gap-2">
                          {/* Rang */}
                          <div className="w-5 text-center flex-shrink-0 pt-0.5">
                            {i < 3
                              ? <span className="text-sm leading-none">{MEDALS[i]}</span>
                              : <span className="text-[11px] text-zinc-600 font-mono tabular-nums">{i + 1}</span>
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
                            <div className="flex flex-wrap gap-1">
                              {players.map(p => {
                                const rKey = `${match.id}:${p.id}`
                                const r = ratingsMap[rKey]
                                const isStar = p.id === pick.bonus_player_id
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
                                    {r?.fotmob_rating != null
                                      ? <span className={`font-bold tabular-nums ${r.fotmob_rating >= 7 ? 'text-green-400' : r.fotmob_rating >= 5 ? 'text-zinc-400' : 'text-red-400'}`}>{r.fotmob_rating}</span>
                                      : <span className="text-zinc-600">–</span>
                                    }
                                    {(r?.goals ?? 0) > 0 && <span>⚽</span>}
                                    {(r?.assists ?? 0) > 0 && <span>🅰️</span>}
                                    {(r?.penalty_saved ?? 0) > 0 && <span>🧤</span>}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
