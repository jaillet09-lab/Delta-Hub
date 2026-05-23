/**
 * Portal isolation — gives each role its own cookie namespace so multiple
 * users (admin, manager, cleaner, client) can be logged in simultaneously
 * on the same browser without overwriting each other's sessions.
 */

export type PortalKey = 'admin' | 'manager' | 'cleaner' | 'client'

export function getPortalKey(pathname: string): PortalKey {
  if (pathname.startsWith('/manager')) return 'manager'
  if (pathname.startsWith('/cleaner')) return 'cleaner'
  if (pathname.startsWith('/client'))  return 'client'
  return 'admin'
}

/** Cookie name prefix — each portal uses its own namespace */
export function cookiePrefix(portal: PortalKey): string {
  return `sb-${portal}`
}

/** Login path for each portal */
export const PORTAL_LOGIN: Record<PortalKey, string> = {
  admin:   '/login',
  manager: '/manager/login',
  cleaner: '/cleaner/login',
  client:  '/client/login',
}
