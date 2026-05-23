import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import type { Database } from '@/types/database'
import { type PortalKey, cookiePrefix } from './portal'

export function createClient() {
  const cookieStore = cookies()

  // Middleware stamps x-portal on every request — use it to pick the right cookie namespace.
  // Falls back to 'admin' if called outside middleware scope (e.g. API routes).
  const portalHeader = headers().get('x-portal') as PortalKey | null
  const prefix = cookiePrefix(portalHeader ?? 'admin')

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: prefix },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}
