'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createOrUpdatePlayerAuthId(
  username: string,
  authId: string
): Promise<{ id?: string; error?: string }> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('cdm_users')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('cdm_users')
      .update({ auth_id: authId })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { id: existing.id }
  }

  const { data: newUser, error } = await admin
    .from('cdm_users')
    .insert({ username, auth_id: authId, is_admin: false })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: newUser!.id }
}

export async function ensureAdminCdmUser(authId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('cdm_users')
    .select('id, is_admin')
    .eq('auth_id', authId)
    .maybeSingle()

  if (!existing) {
    await admin.from('cdm_users').insert({
      auth_id: authId,
      username: 'lolo',
      is_admin: true,
    })
  } else if (!existing.is_admin) {
    await admin
      .from('cdm_users')
      .update({ is_admin: true })
      .eq('id', existing.id)
  }
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/connexion')
}
