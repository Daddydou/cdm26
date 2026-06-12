'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HIDDEN_ON = ['/connexion', '/auth/callback']

const TABS = [
  { href: '/',               label: 'Accueil',   icon: '🏠' },
  { href: '/matchs',         label: 'Matchs',    icon: '📅' },
  { href: '/resultats',      label: 'Résultats', icon: '🏆' },
  { href: '/statistiques',   label: 'Stats',     icon: '📊' },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null

  return (
    <>
      {/* Spacer pour compenser la hauteur de la barre fixe */}
      <div className="h-16 shrink-0" aria-hidden />

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950 border-t border-zinc-800/80 h-16">
        <div className="max-w-lg mx-auto h-full flex items-center justify-around px-2">
          {TABS.map(({ href, label, icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-colors',
                  isActive
                    ? 'bg-zinc-800/60 text-green-500'
                    : 'text-zinc-400 hover:text-zinc-300',
                ].join(' ')}
              >
                <span className="text-xl leading-none">{icon}</span>
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-green-500' : 'text-zinc-500'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
