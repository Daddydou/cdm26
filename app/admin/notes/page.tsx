import { createClient } from '@/lib/supabase/server'
import { saveRatings } from '@/app/actions/admin'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { EspnMatchButton, EspnAutoButton } from './EspnButtons'

const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
const POSITION_COLOR: Record<string, string> = {
  GK:  'bg-yellow-950/50 text-yellow-400 border-yellow-800/40',
  DEF: 'bg-blue-950/50 text-blue-400 border-blue-800/40',
  MID: 'bg-green-950/50 text-green-400 border-green-800/40',
  FWD: 'bg-red-950/50 text-red-400 border-red-800/40',
}

const _INPUT_SM = 'w-16 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-zinc-100 text-center focus:outline-none focus:border-zinc-500 transition-colors tabular-nums'

export default async function NotesPage({
  searchParams,
}: {
  searchParams: { matchId?: string; saved?: string; error?: string }
}) {
  const supabase = createClient()
  const { matchId, saved, error } = searchParams

  // Load matches (terminé + en cours)
  const { data: matches } = await supabase
    .from('cdm_matches')
    .select(`
      id, kickoff_at,
      nation_a:cdm_nations!nation_a_id ( name ),
      nation_b:cdm_nations!nation_b_id ( name )
    `)
    .in('status', ['termine', 'en_cours'])
    .order('kickoff_at', { ascending: false })

  // Load players + ratings if match selected
  type Player = { id: string; name: string; position: string; nation_id: string }
  type Rating = { fotmob_rating: number | null; goals: number; assists: number; penalty_saved: boolean }

  let playersA: Player[] = []
  let playersB: Player[] = []
  let ratingsMap: Record<string, Rating> = {}
  let matchLabel = ''

  if (matchId) {
    const { data: md } = await supabase
      .from('cdm_matches')
      .select('id, nation_a_id, nation_b_id, nation_a:cdm_nations!nation_a_id(name), nation_b:cdm_nations!nation_b_id(name)')
      .eq('id', matchId)
      .single()

    if (md) {
      const na = md.nation_a as unknown as { name: string }
      const nb = md.nation_b as unknown as { name: string }
      matchLabel = `${na?.name} vs ${nb?.name}`

      const { data: pp } = await supabase
        .from('cdm_players')
        .select('id, name, position, nation_id')
        .in('nation_id', [md.nation_a_id, md.nation_b_id])

      const sorted = (pp ?? []).sort(
        (a, b) => (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
      )
      playersA = sorted.filter(p => p.nation_id === md.nation_a_id)
      playersB = sorted.filter(p => p.nation_id === md.nation_b_id)

      const allIds = (pp ?? []).map(p => p.id)
      if (allIds.length > 0) {
        const { data: rr } = await supabase
          .from('cdm_player_ratings')
          .select('player_id, fotmob_rating, goals, assists, penalty_saved')
          .eq('match_id', matchId)
          .in('player_id', allIds)
        ratingsMap = Object.fromEntries((rr ?? []).map(r => [r.player_id, r]))
      }
    }
  }

  const allPlayers = [...playersA, ...playersB]
  const playerIds = allPlayers.map(p => p.id).join(',')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Notes joueurs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Saisie manuelle ou import automatique via ESPN</p>
        </div>
        <EspnAutoButton />
      </div>

      {/* Sélecteur de match */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <form method="GET" action="/admin/notes" className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Match</label>
            <select
              name="matchId"
              defaultValue={matchId ?? ''}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              <option value="">Sélectionner un match…</option>
              {(matches ?? []).map(m => {
                const na = m.nation_a as unknown as { name: string }
                const nb = m.nation_b as unknown as { name: string }
                return (
                  <option key={m.id} value={m.id}>
                    {na?.name} vs {nb?.name} — {format(new Date(m.kickoff_at), 'd MMM yyyy', { locale: fr })}
                  </option>
                )
              })}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-semibold rounded-lg transition-colors"
          >
            Charger
          </button>
        </form>
      </div>

      {saved && (
        <div className="bg-green-950/30 border border-green-800/50 text-green-400 text-sm px-4 py-3 rounded-lg">
          ✓ Notes enregistrées pour {matchLabel}
        </div>
      )}
      {error && (
        <div className="bg-red-950/30 border border-red-800/50 text-red-400 text-sm px-4 py-3 rounded-lg">
          ✗ {decodeURIComponent(error)}
        </div>
      )}

      {/* Formulaire de notes */}
      {matchId && allPlayers.length > 0 && (
        <form action={saveRatings} className="space-y-5">
          <input type="hidden" name="match_id" value={matchId} />
          <input type="hidden" name="player_ids" value={playerIds} />

          {/* En-tête colonnes */}
          <div className="hidden sm:grid grid-cols-[1fr_60px_64px_48px_48px_52px] gap-2 px-4 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
            <span>Joueur</span>
            <span className="text-center">Note</span>
            <span className="text-center">Buts</span>
            <span className="text-center">Pass.</span>
            <span className="text-center">Arrêt P.</span>
            <span />
          </div>

          {/* Équipe A */}
          {playersA.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
                <p className="text-xs font-semibold text-zinc-400">{matchLabel.split(' vs ')[0]}</p>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {playersA.map(p => (
                  <PlayerRow key={p.id} player={p} rating={ratingsMap[p.id]} />
                ))}
              </div>
            </div>
          )}

          {/* Équipe B */}
          {playersB.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
                <p className="text-xs font-semibold text-zinc-400">{matchLabel.split(' vs ')[1]}</p>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {playersB.map(p => (
                  <PlayerRow key={p.id} player={p} rating={ratingsMap[p.id]} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-start gap-3">
            <button
              type="submit"
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Enregistrer toutes les notes
            </button>
            <EspnMatchButton matchId={matchId} />
          </div>
        </form>
      )}

      {matchId && allPlayers.length === 0 && (
        <div className="text-center py-8 text-zinc-500 text-sm">
          Aucun joueur trouvé pour ce match. Ajoutez des joueurs dans la section Joueurs.
        </div>
      )}
    </div>
  )
}

function PlayerRow({
  player,
  rating,
}: {
  player: { id: string; name: string; position: string }
  rating?: { fotmob_rating: number | null; goals: number; assists: number; penalty_saved: boolean }
}) {
  const posColor = POSITION_COLOR[player.position] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'

  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_64px_64px_48px_64px] gap-2 items-center px-4 py-3">
      {/* Nom + position */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${posColor}`}>
          {player.position}
        </span>
        <span className="text-sm text-zinc-200 truncate">{player.name}</span>
      </div>

      {/* Inputs — empilés sur mobile */}
      <div className="flex items-center gap-2 sm:contents">
        <div className="sm:flex sm:justify-center">
          <input
            type="number"
            name={`rating_${player.id}`}
            defaultValue={rating?.fotmob_rating ?? ''}
            step="0.1"
            min="0"
            max="10"
            placeholder="—"
            className="w-16 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-zinc-100 text-center focus:outline-none focus:border-zinc-500 transition-colors tabular-nums"
          />
        </div>
        <div className="sm:flex sm:justify-center">
          <input
            type="number"
            name={`goals_${player.id}`}
            defaultValue={rating?.goals ?? 0}
            min="0"
            max="20"
            className="w-14 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-zinc-100 text-center focus:outline-none focus:border-zinc-500 transition-colors tabular-nums"
          />
        </div>
        <div className="sm:flex sm:justify-center">
          <input
            type="number"
            name={`assists_${player.id}`}
            defaultValue={rating?.assists ?? 0}
            min="0"
            max="20"
            className="w-14 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-zinc-100 text-center focus:outline-none focus:border-zinc-500 transition-colors tabular-nums"
          />
        </div>
        <div className="sm:flex sm:justify-center">
          <label className="flex items-center justify-center cursor-pointer">
            <input
              type="checkbox"
              name={`penalty_saved_${player.id}`}
              defaultChecked={rating?.penalty_saved ?? false}
              className="w-4 h-4 accent-green-500 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
