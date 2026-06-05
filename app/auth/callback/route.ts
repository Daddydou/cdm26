import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? origin
  const homeUrl   = `${siteUrl}/`

  if (code) {
    const cookieStore = cookies()
    const response    = NextResponse.redirect(homeUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession:', error.message)
      return NextResponse.redirect(`${siteUrl}/connexion?error=lien_invalide`)
    }

    return response
  }

  return NextResponse.redirect(homeUrl)
}
