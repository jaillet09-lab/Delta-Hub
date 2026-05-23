'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPortalKey, PORTAL_LOGIN } from '@/lib/supabase/portal'

/**
 * Prevents iOS PWA from signing users out when the app is closed with a swipe-up.
 *
 * iOS clears session (non-persistent) cookies when a PWA is force-closed.
 * On reopen, the server middleware finds no session and redirects to /login.
 *
 * Fix: on every visibilitychange (app came back to foreground), re-validate and
 * re-hydrate the session from Supabase. If the refresh token is still valid
 * (7-day window), the user stays logged in silently. If not, navigate to login.
 */
export function SessionKeepAlive() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function refreshSession() {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (!session || error) {
        // Try refreshing with the stored refresh token
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          // Genuinely expired — redirect to this portal's login page
          const portal = getPortalKey(window.location.pathname)
          router.replace(PORTAL_LOGIN[portal])
        }
      }
    }

    // Re-validate session whenever the app comes back to the foreground
    function handleVisibilityChange() {
      if (!document.hidden) {
        refreshSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [router])

  return null
}
