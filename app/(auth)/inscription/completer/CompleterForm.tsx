'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { completeProfile } from '@/app/actions/auth'
import { useState, useRef } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
    >
      {pending ? 'Création du profil…' : 'Rejoindre le jeu'}
    </button>
  )
}

export default function CompleterForm({ email, authId }: { email: string; authId: string }) {
  const [state, formAction] = useFormState(completeProfile, { error: null })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-base font-semibold text-zinc-100 mb-1">Ton profil</h2>
      <p className="text-xs text-zinc-500 mb-5">Connecté en tant que <span className="text-zinc-300">{email}</span></p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="auth_id" value={authId} />
        <input type="hidden" name="email"   value={email} />

        {state?.error && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3.5 py-2.5">
            <p className="text-red-400 text-sm">{state.error}</p>
          </div>
        )}

        {/* Photo */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">
            Photo de profil <span className="text-zinc-600 normal-case">· optionnelle</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex-shrink-0 w-14 h-14 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-700 hover:border-green-500 transition-colors overflow-hidden"
              aria-label="Choisir une photo"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xl">+</span>
              )}
            </button>
            <p className="text-xs text-zinc-500 leading-relaxed">JPG, PNG ou WEBP<br />Max 2 Mo</p>
          </div>
          <input
            ref={fileInputRef}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {/* Pseudo */}
        <div>
          <label htmlFor="username" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
            Pseudo
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            placeholder="MonPseudo"
            maxLength={30}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
          />
        </div>

        {/* Code de groupe */}
        <div>
          <label htmlFor="group_code" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
            Code de groupe
          </label>
          <input
            id="group_code"
            name="group_code"
            type="text"
            required
            placeholder="XXXX"
            maxLength={20}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors uppercase tracking-widest font-mono"
          />
          <p className="text-xs text-zinc-600 mt-1">Demande ce code à l&apos;administrateur de ton groupe</p>
        </div>

        <div className="pt-1">
          <SubmitButton />
        </div>
      </form>
    </div>
  )
}
