import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ComputeButton from './ComputeButton'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

const STATUS_LABEL: Record<string, string> = {
  a_venir:  'À venir',
  en_cours: 'En cours',
  termine:  'Terminé',
}
const STATUS_COLOR: Record<string, string> = {
  a_venir:  'bg-green-950 text-green-400',
  en_cours: 'bg-orange-950 text-orange-400',
  termine:  'bg-zinc-800 text-zinc-500',
}

export default async function AdminMatchsPage({
  searchParams,
}: {
  searchParams: { msg?: string; error?: string }
}) {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('cdm_matches')
    .select(`
      id, kickoff_at, status, score_a, score_b, phase, points_multiplier,
      nation_a:cdm_nations!nation_a_id ( name ),
      nation_b:cdm_nations!nation_b_id ( name )
    `)
    .order('kickoff_at', { ascending: false })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Matchs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{matches?.length ?? 0} match(s)</p>
        </div>
        <Link
          href="/admin/matchs/nouveau"
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Ajouter un match
        </Link>
      </div>

      {searchParams.msg && (
        <div className="bg-green-950/30 border border-green-800/50 text-green-400 text-sm px-4 py-3 rounded-lg">
          ✓ {decodeURIComponent(searchParams.msg)}
        </div>
      )}
      {searchParams.error && (
        <div className="bg-red-950/30 border border-red-800/50 text-red-400 text-sm px-4 py-3 rounded-lg">
          ✗ {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <div className="space-y-2">
        {(matches ?? []).map(match => {
          const na = match.nation_a as unknown as { name: string } | null
          const nb = match.nation_b as unknown as { name: string } | null
          const status = match.status as string

          return (
            <div
              key={match.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center gap-3"
            >
              {/* Infos match */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="font-semibold text-zinc-100 text-sm">
                  {na?.name ?? '?'} vs {nb?.name ?? '?'}
                  {(match.score_a != null && match.score_b != null) && (
                    <span className="ml-2 text-zinc-400">{match.score_a} – {match.score_b}</span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "d MMM yyyy · HH'h'mm", { locale: fr })}</span>
                  {match.phase && <span className="text-zinc-600">• {match.phase}</span>}
                  {match.points_multiplier && match.points_multiplier !== 1 && (
                    <span className="text-amber-500">×{match.points_multiplier}</span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLOR[status] ?? 'bg-zinc-800 text-zinc-500'}`}>
                {STATUS_LABEL[status] ?? status}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/admin/matchs/${match.id}/edit`}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
                >
                  Modifier
                </Link>

                {status === 'termine' && <ComputeButton matchId={match.id} />}
              </div>
            </div>
          )
        })}

        {(matches ?? []).length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-sm">
            Aucun match. <Link href="/admin/matchs/nouveau" className="text-green-500 hover:underline">Ajouter le premier.</Link>
          </div>
        )}
      </div>
    </div>
  )
}
