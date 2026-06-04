'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type AuthState = { error: string | null }

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = createClient()

  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const username = (formData.get('username') as string)?.trim()
  const groupCode = (formData.get('group_code') as string)?.toUpperCase().trim()
  const photoFile = formData.get('photo') as File | null

  if (!email || !password || !username || !groupCode) {
    return { error: 'Tous les champs sont obligatoires' }
  }

  if (password.length < 6) {
    return { error: 'Le mot de passe doit contenir au moins 6 caractères' }
  }

  // 1. Vérifier le code de groupe
  const { data: group, error: groupError } = await supabase
    .from('cdm_groups')
    .select('id')
    .eq('code', groupCode)
    .single()

  if (groupError || !group) {
    return { error: 'Code de groupe invalide' }
  }

  // 2. Créer le compte auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })

  if (authError) {
    if (authError.message.toLowerCase().includes('already')) {
      return { error: 'Un compte avec cet email existe déjà' }
    }
    return { error: 'Erreur lors de la création du compte' }
  }

  if (!authData.user) {
    return { error: 'Erreur lors de la création du compte' }
  }

  // 3. Upload de la photo (optionnelle)
  let photoUrl: string | null = null
  if (photoFile && photoFile.size > 0 && photoFile.name !== '') {
    try {
      const ext = photoFile.name.split('.').pop()
      const fileName = `${authData.user.id}.${ext}`
      const bytes = await photoFile.arrayBuffer()

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cdm-avatars')
        .upload(fileName, bytes, { contentType: photoFile.type, upsert: true })

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('cdm-avatars')
          .getPublicUrl(uploadData.path)
        photoUrl = publicUrl
      }
    } catch {
      // Photo optionnelle, on continue sans elle
    }
  }

  // 4. Insérer dans cdm_users
  const { data: cdmUser, error: cdmUserError } = await supabase
    .from('cdm_users')
    .insert({ auth_id: authData.user.id, username, photo_url: photoUrl })
    .select('id')
    .single()

  if (cdmUserError) {
    return { error: 'Erreur lors de la création du profil' }
  }

  // 5. Insérer dans cdm_group_members
  const { error: memberError } = await supabase
    .from('cdm_group_members')
    .insert({ group_id: group.id, user_id: cdmUser.id })

  if (memberError) {
    return { error: "Erreur lors de l'ajout au groupe" }
  }

  redirect('/')
}

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = createClient()

  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Veuillez remplir tous les champs' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email ou mot de passe incorrect' }
  }

  redirect('/')
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/connexion')
}
