'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/connexion')
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-xs bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 px-3 py-1 rounded-full transition-colors"
    >
      Déco
    </button>
  )
}
