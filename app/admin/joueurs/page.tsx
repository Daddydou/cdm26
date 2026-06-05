import { createClient } from '@/lib/supabase/server'
import { addPlayer } from '@/app/actions/admin'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const POSITION_COLOR: Record<string, string> = {
  GK:  'bg-yellow-950/50 text-yellow-400 border-yellow-800/40',
  DEF: 'bg-blue-950/50 text-blue-400 border-blue-800/40',
  MID: 'bg-green-950/50 text-green-400 border-green-800/40',
  FWD: 'bg-red-950/50 text-red-400 border-red-800/40',
}
const POSITION_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors'
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5'

export default async function JoueursPage({
  searchParams,
}: {
  searchParams: { msg?: string; error?: string }
}) {
  const supabase = createClient()

  const [playersRes, nationsRes] = await Promise.all([
    supabase
      .from('cdm_players')
      .select('id, name, position, nation_id')
      .order('name'),
    supabase
      .from('cdm_nations')
      .select('id, name')
      .order('name'),
  ])

  const players = playersRes.data ?? []
  const nations = nationsRes.data ?? []

  // Group players by nation
  const byNation = new Map<string, typeof players>()
  for (const p of players) {
    if (!byNation.has(p.nation_id)) byNation.set(p.nation_id, [])
    byNation.get(p.nation_id)!.push(p)
  }
  // Sort players within each nation by position then name
  for (const [, pp] of byNation) {
    pp.sort((a, b) =>
      (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9) ||
      a.name.localeCompare(b.name)
    )
  }
  const _nationMap = new Map(nations.map(n => [n.id, n.name]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Joueurs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{players.length} joueur(s) au total</p>
        </div>
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

      {/* Formulaire d'ajout */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Ajouter un joueur</h2>
        <form action={addPlayer} className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className={LABEL}>Nom</label>
            <input
              type="text"
              name="name"
              required
              placeholder="Nom du joueur"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Nation</label>
            <select name="nation_id" required className={INPUT}>
              <option value="">Sélectionner…</option>
              {nations.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Poste</label>
            <select name="position" required className={INPUT}>
              <option value="">Sélectionner…</option>
              {POSITIONS.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Ajouter
            </button>
          </div>
        </form>
      </div>

      {/* Liste par nation */}
      <div className="space-y-4">
        {nations
          .filter(n => byNation.has(n.id))
          .map(nation => {
            const pp = byNation.get(nation.id) ?? []
            return (
              <div key={nation.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
                  <p className="text-xs font-semibold text-zinc-300">{nation.name}</p>
                  <span className="text-xs text-zinc-600">{pp.length} joueur(s)</span>
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {pp.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${POSITION_COLOR[p.position] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                        {p.position}
                      </span>
                      <span className="text-sm text-zinc-200">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

        {nations.filter(n => !byNation.has(n.id)).length === nations.length && (
          <div className="text-center py-8 text-zinc-500 text-sm">
            Aucun joueur. Utilisez le formulaire ci-dessus pour en ajouter.
          </div>
        )}
      </div>
    </div>
  )
}
