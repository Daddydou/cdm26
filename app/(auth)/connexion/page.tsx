'use client'

import { useState, useTransition } from 'react'
import { signInWithMagicLink } from '@/app/actions/auth'
import Link from 'next/link'

export default function ConnexionPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, start]  = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const result = await signInWithMagicLink(email.trim())
      if (result?.error) {
        setError(result.error)
      } else {
        setSent(true)
      }
    })
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

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-100 mb-5">Connexion</h2>

        {sent ? (
          <div className="bg-green-950/40 border border-green-800/40 rounded-xl px-4 py-5 text-center space-y-2">
            <p className="text-2xl">✉️</p>
            <p className="text-sm font-medium text-green-300">Lien envoyé !</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Un lien de connexion a été envoyé à{' '}
              <span className="text-zinc-200 font-medium">{email}</span>.{' '}
              Vérifie ta boîte mail !
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-2 underline underline-offset-2"
            >
              Utiliser un autre email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3.5 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isPending || !email.trim()}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
              >
                {isPending ? 'Envoi en cours…' : 'Recevoir mon lien de connexion'}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-zinc-500 mt-5">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="text-green-500 hover:text-green-400 font-medium transition-colors">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  )
}
