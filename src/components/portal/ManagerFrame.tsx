import Link from 'next/link'
import { Suspense } from 'react'
import { LogoutButton } from './LogoutButton'
import { Briefcase, Building2, Users, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const NAV = [
  { href: '/manager/dashboard', label: 'Jobs',    icon: <Briefcase className="w-5 h-5" />,    badge: false },
  { href: '/manager/clients',   label: 'Clients', icon: <Building2 className="w-5 h-5" />,    badge: false },
  { href: '/manager/team',      label: 'Team',    icon: <Users className="w-5 h-5" />,         badge: false },
  { href: '/manager/flags',     label: 'Flags',   icon: <AlertTriangle className="w-5 h-5" />, badge: true  },
]

async function FlagsBadge() {
  const supabase = createClient()
  const [{ count: flagCount }, { count: issueCount }, { count: unassignedCount }] = await Promise.all([
    (supabase as any).from('job_flags').select('*', { count: 'exact', head: true }).eq('resolved', false),
    (supabase as any).from('client_issues').select('*', { count: 'exact', head: true }).eq('resolved', false),
    (supabase as any).from('clients').select('*', { count: 'exact', head: true }).eq('active', true).is('assigned_cleaner_id', null),
  ])
  const total = (flagCount ?? 0) + (issueCount ?? 0) + (unassignedCount ?? 0)
  if (total === 0) return null
  return (
    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 bg-yellow-400 text-black text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
      {total > 99 ? '99+' : total}
    </span>
  )
}

interface Props {
  userName?: string | null
  children: React.ReactNode
}

// Persistent shell — lives in layout so header + nav never unmount between nav tabs
export function ManagerFrame({ userName, children }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-5 h-14 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark-white.png"
              alt="Delta Cleaning"
              style={{ height: '32px', width: 'auto', flexShrink: 0 }}
              className="invert block"
            />
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-3">Manager</span>
          </div>
          <div className="flex items-center gap-3">
            {userName && <span className="text-xs text-gray-500 hidden sm:block">{userName}</span>}
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
          {children}
        </div>
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch max-w-2xl mx-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-gray-500 hover:text-black transition-colors"
            >
              <span className="relative flex items-center justify-center">
                {item.icon}
                {item.badge && (
                  <Suspense fallback={null}>
                    <FlagsBadge />
                  </Suspense>
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
