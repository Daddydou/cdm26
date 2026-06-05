import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import MatchClient from './MatchClient'
import type { PickRow, RatingEntry, MatchData } from './MatchClient'

// ─── Helper ───────────────────────────────────────────────────────────────────

function isoFlag(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MatchPage({ params }: { params: { match_id: string } }) {
  const supabase      = createClient()
  const supabaseAdmin = createAdminClient()
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

    supabaseAdmin
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

  if (!matchRes.data) notFound()

  const match    = matchRes.data
  const picks    = (picksRes.data ?? []) as unknown as PickRow[]
  const nationA  = match.nation_a as unknown as { name: string; code: string } | null
  const nationB  = match.nation_b as unknown as { name: string; code: string } | null

  const playerIds = [...new Set(
    picks.flatMap(p =>
      [p.player_a1_id, p.player_a2_id, p.player_b1_id, p.player_b2_id].filter(Boolean) as string[]
    )
  )]

  const { data: ratingsData } = playerIds.length > 0
    ? await supabase
        .from('cdm_player_ratings')
        .select('player_id, fotmob_rating, goals, assists, penalty_saved')
        .eq('match_id', params.match_id)
        .in('player_id', playerIds)
    : { data: [] }

  const isFinished = match.status === 'termine'
  const isOngoing  = match.status === 'en_cours'

  const matchData: MatchData = {
    id:               match.id,
    kickoff_at:       match.kickoff_at,
    status:           match.status,
    score_a:          match.score_a,
    score_b:          match.score_b,
    phase:            match.phase,
    points_multiplier: match.points_multiplier,
    nation_a:         nationA,
    nation_b:         nationB,
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header (statique) ── */}
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
              {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "EEE d MMM · HH'h'mm", { locale: fr })}
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

      {/* ── Contenu dynamique (picks + live refresh) ── */}
      <MatchClient
        match={matchData}
        initialPicks={picks}
        initialRatings={(ratingsData ?? []) as RatingEntry[]}
        myAuthId={user?.id}
      />

    </div>
  )
}
