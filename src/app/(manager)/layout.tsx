import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/manager/login')

  const role = user.user_metadata?.role ?? 'admin'
  // Allow managers and admins (admins can view/manage all portals)
  if (role !== 'manager' && role !== 'admin') redirect('/manager/login')

  return <>{children}</>
}
