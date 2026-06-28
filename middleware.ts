import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { PORTAL_LOGIN } from '@/lib/supabase/portal'

// Unauthenticated-accessible routes (all portal login pages + misc public routes)
const PUBLIC_ROUTES = [
  '/login',
  '/manager/login',
  '/cleaner/login',
  '/client/login',
  '/api/cleaner-calendar',
  '/api/docusign/webhook',
  '/survey',
]

/** Where each role lands after login */
const ROLE_HOME: Record<string, string> = {
  admin:   '/dashboard',
  manager: '/manager/dashboard',
  cleaner: '/cleaner/dashboard',
  client:  '/client/dashboard',
}

/** URL prefixes each non-admin role is allowed to visit */
const ROLE_ALLOWED: Record<string, string[]> = {
  cleaner: ['/cleaner'],
  manager: ['/manager'],
  client:  ['/client'],
}

/** Copy Supabase session cookies onto any redirect response so tokens are never lost */
function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
  const response = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie as any)
  })
  return response
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, portal } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))

  // Not authenticated → redirect to this portal's login page
  if (!user && !isPublicRoute) {
    const loginPath = PORTAL_LOGIN[portal]
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = loginPath
    loginUrl.searchParams.set('redirectTo', pathname)
    return redirectWithCookies(loginUrl, supabaseResponse)
  }

  if (user) {
    const role: string = (user.user_metadata?.role as string) ?? 'admin'
    const home = ROLE_HOME[role] ?? '/dashboard'

    // On any login page → redirect to role-appropriate home
    const isAnyLoginPage = PUBLIC_ROUTES.slice(0, 4).some((r) => pathname === r)
    if (isAnyLoginPage) {
      const dest = request.nextUrl.clone()
      dest.pathname = home
      return redirectWithCookies(dest, supabaseResponse)
    }

    // API routes are allowed for any authenticated user — they handle auth internally
    if (pathname.startsWith('/api/')) return supabaseResponse

    // Non-admin visiting a route outside their allowed prefix → send home
    if (role !== 'admin') {
      const allowed = ROLE_ALLOWED[role] ?? []
      const isAllowed = allowed.some((prefix) => pathname.startsWith(prefix))
      if (!isAllowed) {
        const dest = request.nextUrl.clone()
        dest.pathname = home
        return redirectWithCookies(dest, supabaseResponse)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
