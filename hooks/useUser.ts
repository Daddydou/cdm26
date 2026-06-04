'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type CdmUser = {
  id: string
  auth_id: string
  username: string
  photo_url: string | null
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [cdmUser, setCdmUser] = useState<CdmUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadCdmUser(authId: string) {
      const { data } = await supabase
        .from('cdm_users')
        .select('id, auth_id, username, photo_url')
        .eq('auth_id', authId)
        .single()
      setCdmUser(data ?? null)
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        await loadCdmUser(user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        await loadCdmUser(currentUser.id)
      } else {
        setCdmUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, cdmUser, loading }
}
