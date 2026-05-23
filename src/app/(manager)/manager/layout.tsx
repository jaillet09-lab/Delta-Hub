import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ManagerFrame } from '@/components/portal/ManagerFrame'
import { SessionKeepAlive } from '@/components/portal/SessionKeepAlive'

// Persistent layout — ManagerFrame never unmounts when switching between manager tabs
export default async function ManagerPagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/manager/login')

  const role = user.user_metadata?.role ?? 'admin'
  if (role !== 'manager' && role !== 'admin') redirect('/manager/login')

  const { data: profile } = await (supabase as any).from('profiles').select('full_name').eq('user_id', user.id).single()

  return (
    <>
      <SessionKeepAlive />
      <ManagerFrame userName={profile?.full_name}>{children}</ManagerFrame>
    </>
  )
}
