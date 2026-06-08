import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = 'lolo.rms@gmail.com'
const ADMIN_PW = 'CDM2026fantasy2026'
const SHARED_PW = 'CDM2026'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const identifier: string = (body.identifier ?? '').trim()
  const password: string = body.password ?? ''

  console.log('[api/auth/login] identifier:', identifier)

  if (!identifier) {
    return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 })
  }

  if (password !== SHARED_PW) {
    console.log('[api/auth/login] mot de passe incorrect')
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  // Prépare la réponse avec Set-Cookie via le server client
  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const admin = createAdminClient()

  if (identifier === ADMIN_EMAIL) {
    console.log('[api/auth/login] admin: trying signInWithPassword')
    let { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PW,
    })
    console.log('[api/auth/login] admin: signInWithPassword', error?.message ?? 'ok')

    if (error) {
      console.log('[api/auth/login] admin: trying signUp first')
      const { error: signUpErr } = await supabase.auth.signUp({ email: ADMIN_EMAIL, password: ADMIN_PW })
      console.log('[api/auth/login] admin: signUp', signUpErr?.message ?? 'ok')

      const retry = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PW })
      console.log('[api/auth/login] admin: retry', retry.error?.message ?? 'ok')
      error = retry.error
    }

    if (error) {
      return NextResponse.json({ error: 'Erreur de connexion admin: ' + error.message }, { status: 401 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    console.log('[api/auth/login] admin: user id', user?.id)

    if (user) {
      const { data: existing } = await admin
        .from('cdm_users')
        .select('id, is_admin')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!existing) {
        await admin.from('cdm_users').insert({ auth_id: user.id, username: 'lolo', is_admin: true })
        console.log('[api/auth/login] admin: cdm_users créé')
      } else if (!existing.is_admin) {
        await admin.from('cdm_users').update({ is_admin: true }).eq('id', existing.id)
        console.log('[api/auth/login] admin: is_admin mis à jour')
      } else {
        console.log('[api/auth/login] admin: cdm_users ok (is_admin=true)')
      }
    }

  } else {
    console.log('[api/auth/login] player: signInAnonymously pour', identifier)
    const { data, error } = await supabase.auth.signInAnonymously()
    console.log('[api/auth/login] player: signInAnonymously', error?.message ?? 'ok', data?.user?.id)

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Erreur connexion anonyme: ' + (error?.message ?? 'no user') },
        { status: 500 }
      )
    }

    const { data: existing } = await admin
      .from('cdm_users')
      .select('id')
      .eq('username', identifier)
      .maybeSingle()

    if (existing) {
      await admin.from('cdm_users').update({ auth_id: data.user.id }).eq('id', existing.id)
      console.log('[api/auth/login] player: auth_id mis à jour pour', existing.id)
    } else {
      const { error: insertErr } = await admin
        .from('cdm_users')
        .insert({ username: identifier, auth_id: data.user.id, is_admin: false })
      console.log('[api/auth/login] player: nouveau user créé', insertErr?.message ?? 'ok')
    }
  }

  return response
}
