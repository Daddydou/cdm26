import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const SECTIONS = [
  { href: '/admin/matchs',           icon: '📅', label: 'Matchs',     desc: 'Créer, modifier, calculer les points' },
  { href: '/admin/notes',            icon: '📝', label: 'Notes',      desc: 'Saisir les notes FotMob par match' },
  { href: '/admin/import-sofascore', icon: '🌐', label: 'SofaScore',  desc: 'Importer les notes depuis le navigateur' },
  { href: '/admin/joueurs',          icon: '👤', label: 'Joueurs',    desc: 'Gérer la liste des joueurs par nation' },
]

export default async function AdminDashboard() {
  const supabase = createClient()

  const [matchesRes, usersRes, picksRes] = await Promise.all([
    supabase.from('cdm_matches').select('*', { count: 'exact', head: true }),
    supabase.from('cdm_users').select('*', { count: 'exact', head: true }),
    supabase.from('cdm_picks').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Matchs',       value: matchesRes.count ?? 0 },
    { label: 'Participants', value: usersRes.count ?? 0 },
    { label: 'Picks',        value: picksRes.count ?? 0 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard Admin</h1>
        <p className="text-sm text-zinc-500 mt-1">Gestion de CDM26</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-zinc-100 tabular-nums">{value}</p>
            <p className="text-xs text-zinc-500 mt-1 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="grid gap-3 sm:grid-cols-3">
        {SECTIONS.map(({ href, icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-5 transition-colors group"
          >
            <p className="text-2xl mb-2">{icon}</p>
            <p className="font-semibold text-zinc-100 group-hover:text-white">{label}</p>
            <p className="text-xs text-zinc-500 mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
