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

  console.log('[signUp] Données reçues:', { email, username, groupCode, photoSize: photoFile?.size ?? 0 })

  if (!email || !password || !username || !groupCode) {
    return { error: 'Tous les champs sont obligatoires' }
  }

  if (password.length < 6) {
    return { error: 'Le mot de passe doit contenir au moins 6 caractères' }
  }

  // 1. Vérifier le code de groupe
  console.log('[signUp] 1. Recherche du groupe avec code:', groupCode)
  const { data: group, error: groupError } = await supabase
    .from('cdm_groups')
    .select('id')
    .eq('code', groupCode)
    .single()
  console.log('[signUp] 1. Résultat groupe:', { group, error: groupError?.message, code: groupError?.code })

  if (groupError || !group) {
    return { error: 'Code de groupe invalide' }
  }

  // 2. Créer le compte auth
  console.log('[signUp] 2. Création compte auth pour:', email)
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  console.log('[signUp] 2. Résultat auth.signUp:', {
    userId: authData?.user?.id,
    hasSession: !!authData?.session,
    emailConfirmed: authData?.user?.email_confirmed_at,
    error: authError?.message,
  })

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
    console.log('[signUp] 3. Upload photo:', { name: photoFile.name, size: photoFile.size, type: photoFile.type })
    try {
      const ext = photoFile.name.split('.').pop()
      const fileName = `${authData.user.id}.${ext}`
      const bytes = await photoFile.arrayBuffer()

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cdm-avatars')
        .upload(fileName, bytes, { contentType: photoFile.type, upsert: true })
      console.log('[signUp] 3. Résultat upload:', { path: uploadData?.path, error: uploadError?.message })

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('cdm-avatars')
          .getPublicUrl(uploadData.path)
        photoUrl = publicUrl
        console.log('[signUp] 3. Photo URL:', photoUrl)
      }
    } catch (e) {
      console.error('[signUp] 3. Exception upload:', e)
    }
  } else {
    console.log('[signUp] 3. Pas de photo fournie')
  }

  // 4. Insérer dans cdm_users
  console.log('[signUp] 4. Insert cdm_users:', { auth_id: authData.user.id, username, photo_url: photoUrl })
  const { data: cdmUser, error: cdmUserError } = await supabase
    .from('cdm_users')
    .insert({ auth_id: authData.user.id, username, photo_url: photoUrl })
    .select('id')
    .single()
  console.log('[signUp] 4. Résultat cdm_users:', { cdmUser, error: cdmUserError?.message, code: cdmUserError?.code, details: cdmUserError?.details })

  if (cdmUserError) {
    return { error: 'Erreur lors de la création du profil' }
  }

  // 5. Insérer dans cdm_group_members
  console.log('[signUp] 5. Insert cdm_group_members:', { group_id: group.id, user_id: cdmUser.id })
  const { error: memberError } = await supabase
    .from('cdm_group_members')
    .insert({ group_id: group.id, user_id: cdmUser.id })
  console.log('[signUp] 5. Résultat cdm_group_members:', { error: memberError?.message, code: memberError?.code, details: memberError?.details })

  if (memberError) {
    return { error: "Erreur lors de l'ajout au groupe" }
  }

  console.log('[signUp] Inscription complète, redirection vers /')
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
