import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CompleterForm from './CompleterForm'

export default async function CompleterPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  // Déjà un profil → accueil
  const { data: existing } = await supabase
    .from('cdm_users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (existing) redirect('/')

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-600/15 border border-green-600/25 mb-4">
          <span className="text-2xl">⚽</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">CDM 2026</h1>
        <p className="text-zinc-500 mt-1 text-xs">Complète ton profil pour rejoindre le jeu</p>
      </div>

      <CompleterForm email={user.email!} authId={user.id} />
    </div>
  )
}
