import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/connexion', '/inscription']

export async function middleware(request: NextRequest) {
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

  // Ne pas supprimer — maintient la session active
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  console.log('[middleware]', pathname, '|', user ? `connecté (${user.email})` : 'non connecté', '|', isPublic ? 'public' : 'protégé')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/connexion', request.url))
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (user && pathname.startsWith('/admin')) {
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
