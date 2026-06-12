'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Menu, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { EnablePushButton } from '@/components/portal/EnablePushButton'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients':   'Clients',
  '/leads':     'Leads',
  '/documents': 'Documents',
  '/surveys':   'Surveys',
  '/financial': 'Financials',
  '/analytics': 'Analytics',
  '/team':      'Team',
  '/sops':      'SOPs',
  '/settings':  'Settings',
}

function getModuleLabel(pathname: string): string {
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return label
    }
  }
  return 'Delta Operations Hub'
}

interface TopBarProps {
  userEmail?: string
  onMenuClick: () => void
}

export function TopBar({ userEmail, onMenuClick }: TopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : 'A'

  return (
    <header
      className="bg-white/85 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-30"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
    <div className="h-14 flex items-center px-5 lg:px-6 gap-4">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Module name */}
      <div className="flex-1 flex items-baseline gap-3 min-w-0">
        <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">
          {getModuleLabel(pathname)}
        </h1>
        <span className="hidden md:block text-xs text-gray-400">
          {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <span className="hidden sm:block text-xs text-gray-500 max-w-28 truncate">
            {userEmail || 'Admin'}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-20">
              <div className="px-3 py-2 border-b border-gray-100 mb-1">
                <p className="text-xs font-medium text-gray-400">Signed in as</p>
                <p className="text-xs text-gray-900 font-medium truncate mt-0.5">{userEmail}</p>
              </div>
              <div className="px-3 py-2">
                <EnablePushButton />
              </div>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </header>
  )
}
