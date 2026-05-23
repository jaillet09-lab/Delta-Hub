import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { getPortalKey, cookiePrefix } from './portal'

export function createClient() {
  // Detect which portal we're in from the current URL path.
  // Falls back to 'admin' during SSR (window not available) — browser clients
  // are only ever called client-side so this is always safe.
  const portal = typeof window !== 'undefined'
    ? getPortalKey(window.location.pathname)
    : 'admin'
  const prefix = cookiePrefix(portal) // "sb-admin" | "sb-manager" | "sb-cleaner" | "sb-client"

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: prefix,
        // Persist session cookies for 400 days so iOS PWA swipe-up never clears them
        maxAge: 400 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: true,
      },
      // Disable singleton so each portal can have its own isolated client instance
      isSingleton: false,
    }
  )
}
