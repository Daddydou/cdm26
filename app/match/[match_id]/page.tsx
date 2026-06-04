import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'

// ─── Helpers drapeaux ─────────────────────────────────────────────────────────

function isoFlag(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}
const FLAGS: Record<string, string> = {
  'France': isoFlag('FR'), 'Brésil': isoFlag('BR'), 'Bresil': isoFlag('BR'),
  'Argentine': isoFlag('AR'), 'Espagne': isoFlag('ES'), 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Allemagne': isoFlag('DE'), 'Portugal': isoFlag('PT'), 'Italie': isoFlag('IT'),
  'États-Unis': isoFlag('US'), 'Etats-Unis': isoFlag('US'), 'USA': isoFlag('US'),
  'Mexique': isoFlag('MX'), 'Canada': isoFlag('CA'), 'Maroc': isoFlag('MA'),
  'Japon': isoFlag('JP'), 'Corée du Sud': isoFlag('KR'), 'Australie': isoFlag('AU'),
  'Pays-Bas': isoFlag('NL'), 'Belgique': isoFlag('BE'), 'Croatie': isoFlag('HR'),
  'Suisse': isoFlag('CH'), 'Pologne': isoFlag('PL'), 'Serbie': isoFlag('RS'),
  'Danemark': isoFlag('DK'), 'Ukraine': isoFlag('UA'), 'Turquie': isoFlag('TR'),
  'Türkiye': isoFlag('TR'), 'Sénégal': isoFlag('SN'), 'Uruguay': isoFlag('UY'),
  'Colombie': isoFlag('CO'), 'Équateur': isoFlag('EC'), 'Pérou': isoFlag('PE'),
  'Chili': isoFlag('CL'), 'Nigeria': isoFlag('NG'), 'Cameroun': isoFlag('CM'),
  'Maroc': isoFlag('MA'), 'Tunisie': isoFlag('TN'), 'Algérie': isoFlag('DZ'),
  'Brazil': isoFlag('BR'), 'Argentina': isoFlag('AR'), 'Spain': isoFlag('ES'),
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Germany': isoFlag('DE'), 'Italy': isoFlag('IT'),
  'Netherlands': isoFlag('NL'), 'Belgium': isoFlag('BE'), 'Croatia': isoFlag('HR'),
  'Morocco': isoFlag('MA'), 'Japan': isoFlag('JP'), 'South Korea': isoFlag('KR'),
  'United States': isoFlag('US'), 'Mexico': isoFlag('MX'),
}
function getFlag(name: string) { return FLAGS[name] ?? '⚽' }

// ─── Bonus meta ───────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerInPick = { name: string; position: string } | null

type RatingData = {
  fotmob_rating: number | null
  goals: number | null
  assists: number | null
  penalty_saved: number | null
}

type PickRow = {
  id: string
  points_finaux: number | null
  bonus_type: string | null
  bonus_player_id: string | null
  player_a1_id: string | null
  player_a2_id: string | null
  player_b1_id: string | null
  player_b2_id: string | null
  player_a1: PlayerInPick
  player_a2: PlayerInPick
  player_b1: PlayerInPick
  player_b2: PlayerInPick
  user: { id: string; auth_id: string; username: string; photo_url: string | null } | null
}

// ─── Calcul des points effectifs ──────────────────────────────────────────────

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

  const players: Array<{ id: string | null; info: PlayerInPick }> = [
    { id: pick.player_a1_id, info: pick.player_a1 },
    { id: pick.player_a2_id, info: pick.player_a2 },
    { id: pick.player_b1_id, info: pick.player_b1 },
    { id: pick.player_b2_id, info: pick.player_b2 },
  ]

  return (
    <div className={[
      'rounded-xl border p-3.5 space-y-2',
      highlight
        ? 'bg-green-950/15 border-green-700/50'
        : 'bg-zinc-900 border-zinc-800',
    ].join(' ')}>

      {/* Ligne 1 : rang + avatar + pseudo + points */}
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
            : <span className="text-xs text-zinc-600">—</span>
          }
        </div>
      </div>

      {/* Ligne 2 : joueurs avec notes FotMob + stats */}
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

      {/* Ligne 3 : bonus activé */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MatchPage({ params }: { params: { match_id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [matchRes, picksRes, meRes] = await Promise.all([
    supabase
      .from('cdm_matches')
      .select(`
        id, kickoff_at, status, score_a, score_b, phase, points_multiplier,
        nation_a:cdm_nations!nation_a_id ( name, code ),
        nation_b:cdm_nations!nation_b_id ( name, code )
      `)
      .eq('id', params.match_id)
      .single(),

    supabase
      .from('cdm_picks')
      .select(`
        id, points_finaux, bonus_type, bonus_player_id,
        player_a1_id, player_a2_id, player_b1_id, player_b2_id,
        user:cdm_users!user_id ( id, auth_id, username, photo_url ),
        player_a1:cdm_players!player_a1_id ( name, position ),
        player_a2:cdm_players!player_a2_id ( name, position ),
        player_b1:cdm_players!player_b1_id ( name, position ),
        player_b2:cdm_players!player_b2_id ( name, position )
      `)
      .eq('match_id', params.match_id)
      .order('points_finaux', { ascending: false }),

    user
      ? supabase.from('cdm_users').select('id, auth_id').eq('auth_id', user.id).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  console.log('[match/page] match_id param:', params.match_id)
  console.log('[match/page] matchRes.data:', JSON.stringify(matchRes.data), '| error:', matchRes.error?.message, matchRes.error?.code)
  console.log('[match/page] picks data:', JSON.stringify(picksRes.data?.slice(0, 2)), '| error:', picksRes.error?.message, picksRes.error?.code)
  console.log('[match/page] picks count:', picksRes.data?.length ?? 0)

  if (!matchRes.data) {
    console.log('[match/page] notFound déclenché — match introuvable pour id:', params.match_id)
    notFound()
  }

  const match = matchRes.data
  const picks: PickRow[] = (picksRes.data ?? []) as PickRow[]
  const nationA = match.nation_a as { name: string; code: string } | null
  const nationB = match.nation_b as { name: string; code: string } | null
  const me = meRes.data

  // Ratings FotMob — query séquentielle avec les player IDs des picks
  const playerIds = [...new Set(
    picks.flatMap(p => [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id]
      .filter(Boolean) as string[])
  )]

  const { data: ratingsData } = playerIds.length > 0
    ? await supabase
        .from('cdm_player_ratings')
        .select('player_id, fotmob_rating, goals, assists, penalty_saved')
        .eq('match_id', params.match_id)
        .in('player_id', playerIds)
    : { data: [] }

  console.log('[match/page] ratings:', ratingsData)

  const ratingsMap: Record<string, RatingData> = Object.fromEntries(
    (ratingsData ?? []).map(r => [r.player_id, r])
  )

  const isUpcoming = match.status === 'a_venir'
  const isOngoing  = match.status === 'en_cours'
  const isFinished = match.status === 'termine'

  const multiplier = match.points_multiplier ?? 1
  const myPick = picks.find(p => (p.user as any)?.auth_id === user?.id) ?? null
  const rankedPicks = [...picks].sort((a, b) => {
    const ap = computeEffectivePoints(a, ratingsMap, multiplier) ?? -999
    const bp = computeEffectivePoints(b, ratingsMap, multiplier) ?? -999
    return bp - ap
  })
  const myRank = myPick ? rankedPicks.findIndex(p => p.id === myPick.id) + 1 : 0

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
              ← Retour
            </Link>
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              <span className="text-xl leading-none">{isoFlag(nationA?.code ?? '')}</span>
              <span className="text-sm font-bold text-zinc-100 truncate max-w-[75px]">{nationA?.name}</span>
              <span className="text-sm font-bold text-zinc-400 px-0.5 tabular-nums">
                {isFinished || isOngoing
                  ? `${match.score_a ?? '?'} - ${match.score_b ?? '?'}`
                  : <span className="text-[10px] text-zinc-600">VS</span>
                }
              </span>
              <span className="text-sm font-bold text-zinc-100 truncate max-w-[75px]">{nationB?.name}</span>
              <span className="text-xl leading-none">{isoFlag(nationB?.code ?? '')}</span>
            </div>
            <span className={[
              'text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0',
              isFinished ? 'bg-zinc-800 text-zinc-500'
                : isOngoing ? 'bg-orange-950 text-orange-400'
                : 'bg-green-950 text-green-500',
            ].join(' ')}>
              {isFinished ? 'Terminé' : isOngoing ? 'En cours' : 'À venir'}
            </span>
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-[11px] text-zinc-500 capitalize">
              {format(new Date(match.kickoff_at), "EEEE d MMMM · HH'h'mm", { locale: fr })}
            </p>
            {(match.phase || (match.points_multiplier && match.points_multiplier !== 1)) && (
              <p className="text-[10px] text-zinc-600">
                {match.phase}
                {match.points_multiplier && match.points_multiplier !== 1 && ` • ×${match.points_multiplier}`}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-10">

        {/* ── À venir ── */}
        {isUpcoming && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-8 text-center space-y-3">
            <p className="text-3xl">📅</p>
            <p className="text-sm font-medium text-zinc-300">Ce match n&apos;a pas encore eu lieu</p>
            {!myPick && (
              <Link
                href={`/pick/${match.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Faire mes picks →
              </Link>
            )}
            {myPick && (
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
          <div className="bg-orange-950/20 border border-orange-800/30 rounded-2xl px-5 py-6 text-center space-y-2">
            <p className="text-3xl">⚽</p>
            <p className="text-sm font-semibold text-orange-300">Match en cours</p>
            <p className="text-xs text-zinc-500">Les résultats seront disponibles après le match</p>
          </div>
        )}

        {/* ── Mes picks (mis en évidence) ── */}
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

        {/* ── Picks déposés si a_venir ── */}
        {isUpcoming && picks.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.12em] mb-3">
              {picks.length} participant{picks.length > 1 ? 's' : ''} inscrit{picks.length > 1 ? 's' : ''}
            </h2>
            <div className="flex flex-wrap gap-2">
              {picks.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-[9px] text-zinc-400 font-semibold overflow-hidden">
                    {(p.user as any)?.photo_url
                      ? <Image src={(p.user as any).photo_url} alt="" width={20} height={20} className="object-cover w-full h-full" />
                      : (p.user as any)?.username?.[0]?.toUpperCase()
                    }
                  </div>
                  <span className="text-xs text-zinc-400">{(p.user as any)?.username ?? '?'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
