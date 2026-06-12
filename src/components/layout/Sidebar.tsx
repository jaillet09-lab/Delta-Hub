'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  DollarSign,
  BarChart3,
  Settings,
  UserCog,
  ClipboardCheck,
  FileText,
  BookOpen,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads',     label: 'Leads',     icon: TrendingUp },
  { href: '/clients',   label: 'Clients',   icon: Users },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/surveys',   label: 'Surveys',   icon: ClipboardCheck },
  { href: '/financial', label: 'Financials', icon: DollarSign },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/team',      label: 'Team',      icon: UserCog },
  { href: '/sops',      label: 'SOPs',      icon: BookOpen },
]

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const navLink = (item: { href: string; label: string; icon: React.ElementType }) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onMobileClose}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          active
            ? 'bg-[#1e3a5f] text-white shadow-[0_1px_8px_rgba(30,58,95,0.5)]'
            : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-0.5'
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 h-5 w-1 rounded-r-full bg-sky-400" />
        )}
        <Icon className={cn(
          'w-[18px] h-[18px] flex-shrink-0 transition-colors',
          active ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'
        )} />
        {item.label}
      </Link>
    )
  }

  const content = (
    <div className="flex flex-col h-full bg-[#0b1320] border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-white/5 flex-shrink-0">
        <Image
          src="/logo-white.png"
          alt="Delta Cleaning"
          width={120}
          height={36}
          className="object-contain"
          priority
        />
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-3 lg:hidden p-1.5 rounded text-slate-500 hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          Workspace
        </p>
        {NAV_ITEMS.map(navLink)}
      </nav>

      {/* Bottom nav */}
      <div className="py-3 px-3 border-t border-white/5 space-y-1">
        {BOTTOM_ITEMS.map(navLink)}
        <p className="px-3 pt-2 text-[10px] text-slate-700 tracking-wide">
          Delta Operations Hub
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-56 lg:flex-shrink-0 lg:h-screen lg:sticky lg:top-0">
        {content}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={onMobileClose} />
          <div className="relative flex flex-col w-56 flex-shrink-0">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
