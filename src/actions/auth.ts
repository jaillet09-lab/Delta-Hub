'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { type PortalKey, PORTAL_LOGIN } from '@/lib/supabase/portal'

export async function signOutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()

  // Redirect to the login page for whichever portal the user was in
  const portalHeader = headers().get('x-portal') as PortalKey | null
  const loginPath = PORTAL_LOGIN[portalHeader ?? 'admin']
  redirect(loginPath)
}
