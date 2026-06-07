import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Ces routes passent sans aucune vérification d'auth ni création de client Supabase
const BYPASS_PATHS = [
  '/connexion',
  '/inscription',
  '/auth/callback',
  '/inscription/completer',
  '/api/admin/import-from-browser',
  '/api/admin/import-squads',
  '/api/admin/clear-players',
  '/guide',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (BYPASS_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // — À partir d'ici : routes protégées uniquement —
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Maintient la session active — ne pas supprimer
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log('[middleware] non connecté →', pathname, '→ redirect /connexion')
    return NextResponse.redirect(new URL('/connexion', request.url))
  }

  if (pathname.startsWith('/admin')) {
    const { data: cdmUser } = await supabase
      .from('cdm_users')
      .select('is_admin')
      .eq('auth_id', user.id)
      .single()

    if (!cdmUser?.is_admin) {
      console.log('[middleware] accès admin refusé pour', user.email)
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
