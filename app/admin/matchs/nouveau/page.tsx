import { createClient } from '@/lib/supabase/server'
import { createMatch } from '@/app/actions/admin'
import Link from 'next/link'

const PHASES = [
  { value: 'groupes',       label: 'Phase de groupes' },
  { value: 'seiziemes',     label: 'Seizièmes de finale' },
  { value: 'huitiemes',     label: 'Huitièmes de finale' },
  { value: 'quarts',        label: 'Quarts de finale' },
  { value: 'demis',         label: 'Demi-finales' },
  { value: 'finale_3eme',   label: 'Finale 3ème place' },
  { value: 'finale',        label: 'Finale' },
]

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors'
const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5'

export default async function NouveauMatchPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = await createClient()
  const { data: nations } = await supabase
    .from('cdm_nations')
    .select('id, name')
    .order('name')

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/matchs" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">Nouveau match</h1>
      </div>

      {searchParams.error && (
        <div className="bg-red-950/30 border border-red-800/50 text-red-400 text-sm px-4 py-3 rounded-lg">
          ✗ {decodeURIComponent(searchParams.error)}
        </div>
      )}

      <form action={createMatch} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Équipe A</label>
            <select name="nation_a_id" required className={INPUT}>
              <option value="">Sélectionner…</option>
              {(nations ?? []).map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Équipe B</label>
            <select name="nation_b_id" required className={INPUT}>
              <option value="">Sélectionner…</option>
              {(nations ?? []).map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Date et heure du coup d&apos;envoi (UTC)</label>
            <input type="datetime-local" name="kickoff_at" required className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Phase</label>
            <select name="phase" className={INPUT}>
              <option value="">—</option>
              {PHASES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>Multiplicateur de points</label>
          <input
            type="number"
            name="points_multiplier"
            defaultValue="1"
            step="0.5"
            min="1"
            max="4"
            className={INPUT}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Créer le match
          </button>
          <Link href="/admin/matchs" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
