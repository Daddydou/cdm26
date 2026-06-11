import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const allCookies = cookieStore.getAll()

          // Format chunké présent → on retourne tel quel
          const hasChunked = allCookies.some(c => c.name.includes('-auth-token.0'))
          if (hasChunked) return allCookies

          // Format ancien (non chunké) : valeur URL-encodée JSON
          const legacyToken = allCookies.find(c => c.name === 'sb-ubnkuwyqclrjckogldlc-auth-token')
          if (legacyToken) {
            try {
              const parsed = JSON.parse(decodeURIComponent(legacyToken.value))
              return [
                { name: legacyToken.name + '.0', value: JSON.stringify(parsed) },
                ...allCookies.filter(c => c.name !== legacyToken.name),
              ]
            } catch {
              return allCookies
            }
          }

          return allCookies
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export const createClient = createServerClient
