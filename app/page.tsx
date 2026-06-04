import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'

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
  nation_a: { name: string; code: string } | null
  nation_b: { name: string; code: string } | null
}

// ─── Drapeaux ─────────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

const FLAGS: Record<string, string> = {
  // Noms français
  'France': iso('FR'), 'Brésil': iso('BR'), 'Bresil': iso('BR'),
  'Argentine': iso('AR'), 'Espagne': iso('ES'), 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Allemagne': iso('DE'), 'Portugal': iso('PT'), 'Italie': iso('IT'),
  'États-Unis': iso('US'), 'Etats-Unis': iso('US'), 'USA': iso('US'),
  'Mexique': iso('MX'), 'Canada': iso('CA'), 'Maroc': iso('MA'),
  'Japon': iso('JP'), 'Corée du Sud': iso('KR'), 'Australie': iso('AU'),
  'Pays-Bas': iso('NL'), 'Belgique': iso('BE'), 'Croatie': iso('HR'),
  'Suisse': iso('CH'), 'Pologne': iso('PL'), 'Serbie': iso('RS'),
  'Danemark': iso('DK'), 'Ukraine': iso('UA'), 'Turquie': iso('TR'),
  'Türkiye': iso('TR'), 'Sénégal': iso('SN'), 'Senegal': iso('SN'),
  'Uruguay': iso('UY'), 'Colombie': iso('CO'), 'Équateur': iso('EC'),
  'Equateur': iso('EC'), 'Pérou': iso('PE'), 'Chili': iso('CL'),
  'Venezuela': iso('VE'), 'Bolivie': iso('BO'), 'Paraguay': iso('PY'),
  'Nigeria': iso('NG'), 'Cameroun': iso('CM'), 'Ghana': iso('GH'),
  'Tunisie': iso('TN'), 'Algérie': iso('DZ'), 'Algerie': iso('DZ'),
  'Arabie Saoudite': iso('SA'), 'Iran': iso('IR'), 'Qatar': iso('QA'),
  'Costa Rica': iso('CR'), 'Honduras': iso('HN'), 'Panama': iso('PA'),
  'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Ecosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Pays de Galles': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Roumanie': iso('RO'), 'Slovaquie': iso('SK'), 'Autriche': iso('AT'),
  // Noms anglais
  'Brazil': iso('BR'), 'Argentina': iso('AR'), 'Spain': iso('ES'),
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Germany': iso('DE'), 'Italy': iso('IT'),
  'Netherlands': iso('NL'), 'Belgium': iso('BE'), 'Croatia': iso('HR'),
  'Switzerland': iso('CH'), 'Poland': iso('PL'), 'Denmark': iso('DK'),
  'Morocco': iso('MA'), 'Japan': iso('JP'), 'South Korea': iso('KR'),
  'Australia': iso('AU'), 'United States': iso('US'), 'Mexico': iso('MX'),
  'Colombia': iso('CO'), 'Ecuador': iso('EC'), 'Peru': iso('PE'),
  'Chile': iso('CL'), 'Serbia': iso('RS'), 'Tunisia': iso('TN'),
  'Cameroon': iso('CM'), 'Saudi Arabia': iso('SA'), 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
}

function getFlag(team: string): string {
  return FLAGS[team] ?? '⚽'
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
      .select('user_id')
      .not('points_finaux', 'is', null),

    supabase
      .from('cdm_matches')
      .select('id, kickoff_at, status, score_a, score_b, nation_a:cdm_nations!nation_a_id(name, code), nation_b:cdm_nations!nation_b_id(name, code)')
      .eq('status', 'a_venir')
      .order('kickoff_at', { ascending: true })
      .limit(5),

    supabase
      .from('cdm_matches')
      .select('id, kickoff_at, status, score_a, score_b, nation_a:cdm_nations!nation_a_id(name, code), nation_b:cdm_nations!nation_b_id(name, code)')
      .in('status', ['termine', 'en_cours'])
      .order('kickoff_at', { ascending: false })
      .limit(5),

    user
      ? supabase
          .from('cdm_users')
          .select('id, photo_url, username')
          .eq('auth_id', user.id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  console.log('[page] prochains matchs:', matchesRes.data, matchesRes.error)
  console.log('[page] matchs récents:', recentMatchesRes.data, (recentMatchesRes as any).error)

  const cdmUsers: CdmUser[] = usersRes.data ?? []
  const upcomingMatches: Match[] = matchesRes.data ?? []
  const recentMatches: Match[] = recentMatchesRes.data ?? []
  const me = meRes.data

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
            <Link href={`/profil/${me.id}`} className="flex items-center gap-2.5 group">
              <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors hidden sm:block">
                {me.username}
              </span>
              <Avatar src={me.photo_url} name={me.username} size="sm" />
            </Link>
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
          ) : (
            <div className="space-y-2.5">
              {upcomingMatches.map(match => (
                <div
                  key={match.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                >
                  <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-3">
                    {/* Équipes — cliquable vers la page du match */}
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
                      <p className="text-[11px] text-zinc-500 mt-1 capitalize">
                        {format(new Date(match.kickoff_at), "EEEE d MMMM · HH'h'mm", { locale: fr })}
                      </p>
                    </Link>

                    {/* CTA */}
                    <Link
                      href={`/pick/${match.id}`}
                      className="flex-shrink-0 px-3.5 py-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Pronostic
                    </Link>
                  </div>

                  {/* Barre verte fine en bas */}
                  <div className="h-0.5 bg-gradient-to-r from-green-600/40 via-green-500/20 to-transparent" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Résultats récents ── */}
        {recentMatches.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              Matchs récents
            </h2>
            <div className="space-y-2">
              {recentMatches.map(match => (
                <Link
                  key={match.id}
                  href={`/match/${match.id}`}
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="text-lg leading-none">{iso(match.nation_a?.code ?? '')}</span>
                    <span className="text-sm font-semibold text-zinc-200 truncate max-w-[80px]">{match.nation_a?.name}</span>
                    <span className="text-sm font-bold text-zinc-300 tabular-nums px-1">
                      {match.score_a ?? '?'} - {match.score_b ?? '?'}
                    </span>
                    <span className="text-sm font-semibold text-zinc-200 truncate max-w-[80px]">{match.nation_b?.name}</span>
                    <span className="text-lg leading-none">{iso(match.nation_b?.code ?? '')}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                    match.status === 'termine' ? 'bg-zinc-800 text-zinc-500' : 'bg-orange-950 text-orange-400'
                  }`}>
                    {match.status === 'termine' ? 'Terminé' : 'En cours'}
                  </span>
                </Link>
              ))}
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
