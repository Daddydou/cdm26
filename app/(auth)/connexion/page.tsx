'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from '@/app/actions/auth'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
    >
      {pending ? 'Connexion…' : 'Se connecter'}
    </button>
  )
}

export default function ConnexionPage() {
  const [state, formAction] = useFormState(signIn, { error: null })

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

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3.5 py-2.5">
              <p className="text-red-400 text-sm">{state.error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vous@exemple.com"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
            />
          </div>

          <div className="pt-1">
            <SubmitButton />
          </div>
        </form>
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
