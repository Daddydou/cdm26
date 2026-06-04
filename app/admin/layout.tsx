import Link from 'next/link'

const NAV = [
  { href: '/admin',          label: 'Dashboard' },
  { href: '/admin/matchs',   label: 'Matchs' },
  { href: '/admin/notes',    label: 'Notes' },
  { href: '/admin/joueurs',  label: 'Joueurs' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-1">
          <span className="text-sm font-bold text-green-500 mr-3 flex-shrink-0">⚽ Admin</span>
          <div className="flex gap-0.5 flex-1">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0">
            ← Site
          </Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6 pb-10">
        {children}
      </main>
    </div>
  )
}
