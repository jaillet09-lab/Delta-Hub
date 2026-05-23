import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SessionKeepAlive } from '@/components/portal/SessionKeepAlive'

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/client/login')

  const role = user.user_metadata?.role ?? 'admin'
  if (role !== 'client') redirect('/client/login')

  return (
    <>
      <SessionKeepAlive />
      {children}
    </>
  )
}
