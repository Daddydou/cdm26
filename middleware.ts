import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const BYPASS_PATHS = [
  '/connexion',
  '/inscription',
  '/auth/callback',
  '/inscription/completer',
  '/api/auth/login',
  '/api/auth/signout',
  '/api/admin/import-from-browser',
  '/api/admin/import-squads',
  '/api/admin/clear-players',
  '/api/admin/import-ratings',
  '/guide',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (BYPASS_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[middleware] Supabase env vars manquantes')
    return NextResponse.redirect(new URL('/connexion', request.url))
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.log('[middleware] non connecté →', pathname, '→ redirect /connexion')
      return NextResponse.redirect(new URL('/connexion', request.url))
    }

    // Vérifie le profil uniquement sur les vraies pages (pas les API ni les assets)
    const isPageRequest = !pathname.startsWith('/api') && !pathname.includes('.')

    if (isPageRequest) {
      const profileCookie = request.cookies.get('cdm26-profile')
      let isAdmin = false

      if (!profileCookie) {
        // Première visite ou cookie expiré → query Supabase
        const { data: profile } = await supabase
          .from('cdm_users')
          .select('id, is_admin')
          .eq('auth_id', user.id)
          .single()

        if (!profile) {
          console.log('[middleware] pas de profil cdm_users pour', user.id, '→ redirect /inscription/completer')
          return NextResponse.redirect(new URL('/inscription/completer', request.url))
        }

        isAdmin = profile.is_admin ?? false
        // Met en cache 24h — supabaseResponse inclut déjà les cookies de refresh token
        supabaseResponse.cookies.set('cdm26-profile', isAdmin ? 'admin' : '1', {
          maxAge: 86400,
          path: '/',
          httpOnly: true,
        })
      } else {
        isAdmin = profileCookie.value === 'admin'
      }

      if (pathname.startsWith('/admin') && !isAdmin) {
        console.log('[middleware] accès admin refusé pour', user.id)
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  } catch (err) {
    console.error('[middleware] exception →', pathname, err)
    return NextResponse.redirect(new URL('/connexion', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
}
