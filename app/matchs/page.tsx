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

export default async function MatchsPage() {
  const supabase = await createClient()
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

  // Profil CDM pour les picks
  const { data: cdmUser } = user
    ? await supabase.from('cdm_users').select('id').eq('auth_id', user.id).single()
    : { data: null }

  // Tous les matchs à venir (nations vedettes)
  const matchesQuery = supabase
    .from('cdm_matches')
    .select('id, kickoff_at, status, score_a, score_b, nation_a:cdm_nations!nation_a_id(name, code), nation_b:cdm_nations!nation_b_id(name, code)')
    .eq('status', 'a_venir')
    .order('kickoff_at', { ascending: true })

  const { data: matchesRaw } = nationFilter
    ? await matchesQuery.or(nationFilter)
    : await matchesQuery

  const matches = (matchesRaw ?? []) as unknown as Match[]

  // Picks de l'utilisateur
  let userPickedMatchIds = new Set<string>()
  if (cdmUser && matches.length > 0) {
    const { data: picks } = await supabase
      .from('cdm_picks')
      .select('match_id')
      .eq('user_id', cdmUser.id)
      .in('match_id', matches.map(m => m.id))
    userPickedMatchIds = new Set(picks?.map(p => p.match_id) ?? [])
  }

  // Groupement par date
  const byDate: Record<string, { label: string; matches: Match[] }> = {}
  for (const match of matches) {
    const key   = formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', 'yyyy-MM-dd')
    const label = formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', 'EEEE d MMMM', { locale: fr })
    if (!byDate[key]) byDate[key] = { label, matches: [] }
    byDate[key].matches.push(match)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <h1 className="text-base font-bold tracking-tight">
            CDM<span className="text-green-500">26</span>
            <span className="ml-2 text-zinc-500 font-normal text-sm">· Prochains matchs</span>
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <a href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-4">
          ← Retour
        </a>
        {matches.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-10 text-center">
            <p className="text-3xl mb-3">📅</p>
            <p className="text-sm text-zinc-400 font-medium">Aucun match à venir pour le moment</p>
          </div>
        ) : (
          Object.entries(byDate).map(([key, { label, matches: dayMatches }]) => (
            <div key={key}>
              <p className="text-[11px] font-semibold text-zinc-400 capitalize mb-2 px-0.5">{label}</p>
              <div className="space-y-2">
                {dayMatches.map(match => (
                  <div key={match.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-3">
                      <Link href={`/match/${match.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xl leading-none">{iso(match.nation_a?.code ?? '')}</span>
                          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[90px]">{match.nation_a?.name}</span>
                          <span className="text-[10px] font-bold text-zinc-600 px-1">VS</span>
                          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[90px]">{match.nation_b?.name}</span>
                          <span className="text-xl leading-none">{iso(match.nation_b?.code ?? '')}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "HH'h'mm", { locale: fr })}
                        </p>
                      </Link>
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
                    <div className="h-0.5 bg-gradient-to-r from-green-600/40 via-green-500/20 to-transparent" />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
