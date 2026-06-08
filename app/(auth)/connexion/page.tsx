'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createOrUpdatePlayerAuthId, ensureAdminCdmUser } from '@/app/actions/auth'

const ADMIN_EMAIL = 'lolo.rms@gmail.com'
const ADMIN_PW = 'CDM2026fantasy2026'
const SHARED_PW = 'CDM2026'

export default function ConnexionPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isPWA, setIsPWA] = useState(false)
  const didCheck = useRef(false)

  useEffect(() => {
    if (didCheck.current) return
    didCheck.current = true

    setIsPWA(window.matchMedia('(display-mode: standalone)').matches)

    const supabase = createClient()

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace('/')
          return
        }

        const authenticated = localStorage.getItem('cdm26_authenticated')
        const savedIdentifier = localStorage.getItem('cdm26_identifier')

        if (authenticated === 'true' && savedIdentifier) {
          if (savedIdentifier === ADMIN_EMAIL) {
            const { error } = await supabase.auth.signInWithPassword({
              email: ADMIN_EMAIL,
              password: ADMIN_PW,
            })
            if (!error) {
              router.replace('/')
              return
            }
          } else {
            const { data } = await supabase.auth.signInAnonymously()
            if (data.user) {
              await createOrUpdatePlayerAuthId(savedIdentifier, data.user.id)
              router.replace('/')
              return
            }
          }
          localStorage.removeItem('cdm26_authenticated')
          localStorage.removeItem('cdm26_identifier')
        }
      } catch {
        // Network error → show form
      }
      setChecking(false)
    }

    checkAuth()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const id = identifier.trim()

    if (!id) {
      setError('Saisis ton identifiant')
      setLoading(false)
      return
    }

    if (password !== SHARED_PW) {
      setError('Mot de passe incorrect')
      setLoading(false)
      return
    }

    const supabase = createClient()

    try {
      if (id === ADMIN_EMAIL) {
        let { error } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: ADMIN_PW,
        })

        if (error) {
          await supabase.auth.signUp({ email: ADMIN_EMAIL, password: ADMIN_PW })
          const result = await supabase.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PW,
          })
          error = result.error
        }

        if (error) {
          setError('Erreur de connexion admin')
          setLoading(false)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (user) await ensureAdminCdmUser(user.id)

      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error || !data.user) {
          setError('Erreur de connexion, réessaie')
          setLoading(false)
          return
        }

        const result = await createOrUpdatePlayerAuthId(id, data.user.id)
        if (result.error) {
          setError('Erreur lors de la connexion')
          setLoading(false)
          return
        }
      }

      localStorage.setItem('cdm26_authenticated', 'true')
      localStorage.setItem('cdm26_identifier', id)

      router.push('/')
    } catch {
      setError('Erreur inattendue, réessaie')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-600/15 border border-green-600/25">
          <span className="text-2xl">⚽</span>
        </div>
        <p className="text-sm text-zinc-500">Connexion en cours…</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-600/15 border border-green-600/25 mb-4">
          <span className="text-2xl">⚽</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">CDM 2026</h1>
        <p className="text-zinc-500 mt-1 text-xs">Pronostics · Classements · Groupes</p>
      </div>

      {isPWA && (
        <div className="mb-4 bg-green-950/40 border border-green-800/40 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-base">📱</span>
          <p className="text-xs text-green-300 font-medium">Application CDM26</p>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-100 mb-1">Connexion</h2>

          {error && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3.5 py-2.5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="identifier" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              Ton identifiant
            </label>
            <input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="pseudo ou email"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
          >
            {loading ? 'Connexion…' : 'Accéder au jeu →'}
          </button>
        </form>
      </div>
    </div>
  )
}
