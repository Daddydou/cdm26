import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'
import NotificationButton from './components/NotificationButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type CdmUser = {
  id: string
  auth_id: string
  username: string
  photo_url: string | null
  total_points: number | null
}

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

// ─── Drapeaux ─────────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉']

function Avatar({
  src, name, size,
}: {
  src: string | null
  name: string
  size: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 32 : 36
  const cls = size === 'sm'
    ? 'w-8 h-8 text-xs'
    : 'w-9 h-9 text-sm'

  return (
    <div className={`${cls} rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center font-semibold text-zinc-500`}>
      {src
        ? <Image src={src} alt={name} width={dim} height={dim} className="object-cover w-full h-full" />
        : name[0]?.toUpperCase()
      }
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [usersRes, picksRes, matchesRes, recentMatchesRes, meRes] = await Promise.all([
    supabase
      .from('cdm_users')
      .select('id, auth_id, username, photo_url, total_points')
      .order('total_points', { ascending: false, nullsFirst: false }),

    supabase
      .from('cdm_picks')
      .select('user_id, match_id'),

    supabase
      .from('cdm_matches')
      .select('id, kickoff_at, status, score_a, score_b, nation_a:cdm_nations!nation_a_id(name, code), nation_b:cdm_nations!nation_b_id(name, code)')
      .eq('status', 'a_venir')
      .order('kickoff_at', { ascending: true }),

    supabase
      .from('cdm_matches')
      .select('id, kickoff_at, status, score_a, score_b, phase, nation_a:cdm_nations!nation_a_id(name, code), nation_b:cdm_nations!nation_b_id(name, code)')
      .in('status', ['termine', 'en_cours'])
      .order('kickoff_at', { ascending: false })
      .limit(10),

    user
      ? supabase
          .from('cdm_users')
          .select('id, photo_url, username, is_admin')
          .eq('auth_id', user.id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  console.log('[page] prochains matchs:', matchesRes.data, matchesRes.error)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('[page] matchs récents:', recentMatchesRes.data, (recentMatchesRes as any).error)

  const cdmUsers: CdmUser[] = (usersRes.data ?? []) as unknown as CdmUser[]
  const upcomingMatches: Match[] = (matchesRes.data ?? []) as unknown as Match[]
  const recentMatches: Match[] = (recentMatchesRes.data ?? []) as unknown as Match[]
  const me = meRes.data

  // Picks de l'utilisateur (matchs à venir + récents)
  let userPickedMatchIds = new Set<string>()
  let pointsByMatch: Record<string, number | null> = {}
  if (me) {
    const { data: userPicks } = await supabase
      .from('cdm_picks')
      .select('match_id, points_finaux')
      .eq('user_id', me.id)
    userPickedMatchIds = new Set(userPicks?.map(p => p.match_id) ?? [])
    pointsByMatch = Object.fromEntries(
      userPicks?.map(p => [p.match_id, p.points_finaux]) ?? []
    )
  }

  // Nombre de matchs joués par user_id
  const matchesPlayed: Record<string, number> = {}
  for (const pick of (picksRes.data ?? [])) {
    matchesPlayed[pick.user_id] = (matchesPlayed[pick.user_id] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">⚽</span>
            <span className="text-base font-bold tracking-tight">
              CDM<span className="text-green-500">26</span>
            </span>
          </div>

          {me && (
            <div className="flex items-center gap-2">
              {(me as { is_admin?: boolean }).is_admin && (
                <Link
                  href="/admin"
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800/60"
                >
                  ⚙️
                </Link>
              )}
              <NotificationButton />
              <Link href={`/profil/${me.id}`} className="flex items-center gap-2.5 group">
                <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors hidden sm:block">
                  {me.username}
                </span>
                <Avatar src={me.photo_url} name={me.username} size="sm" />
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-7 pb-10">

        {/* ── Prochains matchs ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Prochains matchs
          </h2>

          {upcomingMatches.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-8 text-center">
              <p className="text-2xl mb-2">🏆</p>
              <p className="text-sm text-zinc-400 font-medium">La compétition n&apos;a pas encore commencé</p>
              <p className="text-xs text-zinc-600 mt-1">Les matchs apparaîtront ici dès leur ajout</p>
            </div>
          ) : (() => {
            // Groupement par date (Europe/Paris)
            const byDate: Record<string, { label: string; matches: Match[] }> = {}
            for (const match of upcomingMatches) {
              const key   = formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', 'yyyy-MM-dd')
              const label = formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', 'EEEE d MMMM', { locale: fr })
              if (!byDate[key]) byDate[key] = { label, matches: [] }
              byDate[key].matches.push(match)
            }

            return (
              <div className="space-y-5">
                {Object.entries(byDate).map(([key, { label, matches: dayMatches }]) => (
                  <div key={key}>
                    {/* Séparateur de date */}
                    <p className="text-[11px] font-semibold text-zinc-400 capitalize mb-2 px-0.5">
                      {label}
                    </p>

                    <div className="space-y-2">
                      {dayMatches.map(match => (
                        <div
                          key={match.id}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                        >
                          <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-3">
                            {/* Équipes */}
                            <Link href={`/match/${match.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xl leading-none">{iso(match.nation_a?.code ?? '')}</span>
                                <span className="text-sm font-semibold text-zinc-100 truncate max-w-[90px]">
                                  {match.nation_a?.name}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-600 px-1">VS</span>
                                <span className="text-sm font-semibold text-zinc-100 truncate max-w-[90px]">
                                  {match.nation_b?.name}
                                </span>
                                <span className="text-xl leading-none">{iso(match.nation_b?.code ?? '')}</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-1">
                                {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "HH'h'mm", { locale: fr })}
                              </p>
                            </Link>

                            {/* CTA */}
                            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                              {userPickedMatchIds.has(match.id) && (
                                <span className="text-[10px] text-green-500 font-semibold whitespace-nowrap">
                                  ✓ Picks effectués
                                </span>
                              )}
                              <Link
                                href={`/pick/${match.id}`}
                                className="px-3.5 py-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                              >
                                Pronostic
                              </Link>
                            </div>
                          </div>

                          {/* Barre verte fine en bas */}
                          <div className="h-0.5 bg-gradient-to-r from-green-600/40 via-green-500/20 to-transparent" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </section>

        {/* ── Matchs récents ── */}
        {recentMatches.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Matchs récents
            </h2>
            <div className="space-y-2">
              {recentMatches.map(match => {
                const pts    = pointsByMatch[match.id]
                const picked = match.id in pointsByMatch
                return (
                  <Link
                    key={match.id}
                    href={`/match/${match.id}`}
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3 transition-colors"
                  >
                    {/* Équipes + score */}
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-zinc-600">
                          {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "d MMM", { locale: fr })}
                          {match.phase && ` · ${match.phase}`}
                        </p>
                      </div>
                    </div>

                    {/* Points user + statut */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {picked ? (
                        <span className={`text-sm font-bold tabular-nums ${pts != null && pts > 0 ? 'text-green-400' : 'text-zinc-400'}`}>
                          {pts != null ? `${pts} pts` : '— pts'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-medium">Non joué</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        match.status === 'termine' ? 'bg-zinc-800 text-zinc-500' : 'bg-orange-950 text-orange-400'
                      }`}>
                        {match.status === 'termine' ? 'Terminé' : 'En cours'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Classement général ── */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
            Classement général
          </h2>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {cdmUsers.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-zinc-500">Aucun joueur inscrit pour le moment</p>
              </div>
            ) : (
              <>
                {/* En-tête colonnes */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-950/40">
                  <div className="w-7" />
                  <div className="w-9" />
                  <div className="flex-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Joueur</div>
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider w-12 text-right">Matchs</div>
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider w-12 text-right">Points</div>
                </div>

                <ul>
                  {cdmUsers.map((cdmUser, i) => {
                    const isMe = cdmUser.auth_id === user?.id
                    const played = matchesPlayed[cdmUser.id] ?? 0
                    const pts = cdmUser.total_points ?? 0

                    return (
                      <li
                        key={cdmUser.id}
                        className={[
                          'flex items-center gap-3 px-4 py-3',
                          i < cdmUsers.length - 1 ? 'border-b border-zinc-800/70' : '',
                          isMe ? 'bg-green-950/25' : '',
                        ].join(' ')}
                      >
                        {/* Rang */}
                        <div className="w-7 text-center flex-shrink-0">
                          {i < 3
                            ? <span className="text-base leading-none">{MEDALS[i]}</span>
                            : <span className="text-xs text-zinc-600 font-mono tabular-nums">{i + 1}</span>
                          }
                        </div>

                        {/* Avatar */}
                        <Avatar src={cdmUser.photo_url} name={cdmUser.username} size="md" />

                        {/* Nom */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate leading-tight ${isMe ? 'text-green-400' : 'text-zinc-100'}`}>
                            {cdmUser.username}
                            {isMe && <span className="ml-1.5 text-[10px] text-zinc-600 font-normal">moi</span>}
                          </p>
                        </div>

                        {/* Matchs joués */}
                        <div className="w-12 text-right flex-shrink-0">
                          <span className="text-xs text-zinc-500 tabular-nums">{played}</span>
                        </div>

                        {/* Points */}
                        <div className="w-12 text-right flex-shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${pts > 0 ? 'text-green-400' : 'text-zinc-600'}`}>
                            {pts}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}
