import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

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
  const supabase = await createClient()
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

  // Points par match pour l'utilisateur connecté
  let pointsByMatch: Record<string, number | null> = {}
  if (cdmUser && matches.length > 0) {
    const { data: picks } = await supabase
      .from('cdm_picks')
      .select('match_id, points_finaux')
      .eq('user_id', cdmUser.id)
      .in('match_id', matches.map(m => m.id))
    pointsByMatch = Object.fromEntries(
      (picks ?? []).map(p => [p.match_id, p.points_finaux])
    )
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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-2">
        {matches.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-10 text-center">
            <p className="text-3xl mb-3">🏆</p>
            <p className="text-sm text-zinc-400 font-medium">Aucun résultat disponible pour le moment</p>
          </div>
        ) : (
          matches.map(match => {
            const pts    = pointsByMatch[match.id]
            const picked = match.id in pointsByMatch
            return (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-3 transition-colors"
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
                    {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "d MMM", { locale: fr })}
                    {match.phase && ` · ${match.phase}`}
                  </p>
                </div>

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
          })
        )}
      </main>
    </div>
  )
}
