import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import MatchPickRow, { type MatchPick, type MatchRating } from '@/app/components/MatchPickRow'

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

// ─── Drapeau emoji ────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

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
                  'Angleterre', 'Croatie', 'République Tchèque', 'Afrique du Sud'])

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
            id, match_id, points_finaux, bonus_type, bonus_player_id,
            bonus_player:cdm_players!bonus_player_id(id, name, position),
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
                    {ranked.map((pick, i) => (
                      <MatchPickRow
                        key={pick.id}
                        pick={pick}
                        rank={i + 1}
                        matchId={match.id}
                        ratingsMap={ratingsMap}
                        cdmUserId={cdmUser?.id ?? null}
                      />
                    ))}
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
