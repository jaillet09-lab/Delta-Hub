import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { getPortalKey, cookiePrefix } from './portal'

export async function updateSession(request: NextRequest) {
  const portal = getPortalKey(request.nextUrl.pathname)
  const prefix = cookiePrefix(portal) // e.g. "sb-admin", "sb-client"

  // Stamp x-portal onto every request so Server Components can read it via headers()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-portal', portal)

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: prefix },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options } as any)
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          supabaseResponse.cookies.set({ name, value, ...options } as any)
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options } as any)
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          supabaseResponse.cookies.set({ name, value: '', ...options } as any)
        },
      },
    }
  )

  // Validates session server-side — do not use getSession() here
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user, portal }
}
