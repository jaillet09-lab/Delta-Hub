import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { LayoutDashboard, ShieldCheck, Wrench, MessageCircle } from 'lucide-react'
import { LogoutButton } from './LogoutButton'
import { ClientOnboardingModal } from './client/ClientOnboardingModal'
import { HowItWorksButton } from './client/HowItWorksButton'
import { SiteSelector } from './client/SiteSelector'

const NAV = [
  { href: '/client/dashboard',  label: 'Overview',   icon: LayoutDashboard },
  { href: '/client/compliance', label: 'Compliance', icon: ShieldCheck },
  { href: '/client/services',   label: 'Services',   icon: Wrench },
  { href: '/client/contact',    label: 'Contact',    icon: MessageCircle },
]

interface Site {
  id: string
  site_name: string
  suburb?: string | null
}

interface Props {
  children: React.ReactNode
  clientName?: string | null
  userName?: string | null
  activePath?: string
  sites?: Site[]
  selectedSiteId?: string | null
}

export function ClientShell({ children, clientName, userName, activePath, sites, selectedSiteId }: Props) {
  const hasSites = (sites?.length ?? 0) > 1

  const isActive = (href: string) =>
    activePath === href || activePath?.startsWith(href + '/')

  return (
    <div className="min-h-[100dvh] bg-[#f5f6f8] flex flex-col">
      {/* ── Top bar — navy ink ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-[#0b1320] border-b border-white/5"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 lg:px-8 h-16 max-w-5xl mx-auto">
          {/* Logo + client + site */}
          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
            <Image
              src="/logo-mark-white.png"
              alt="Delta Cleaning"
              width={34}
              height={34}
              className="object-contain flex-shrink-0"
              priority
            />
            {clientName && (
              <>
                <span className="hidden sm:block w-px h-5 bg-white/10 flex-shrink-0" />
                <span className="hidden sm:block text-sm font-semibold text-slate-200 truncate">{clientName}</span>
              </>
            )}
            {hasSites && sites && (
              <>
                <span className="hidden sm:block w-px h-5 bg-white/10 flex-shrink-0" />
                <Suspense fallback={null}>
                  <SiteSelector sites={sites} selectedSiteId={selectedSiteId} />
                </Suspense>
              </>
            )}
          </div>

          {/* Desktop nav + user actions */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="flex items-center gap-4 md:border-l md:border-white/10 md:pl-5">
              <span className="hidden lg:block"><HowItWorksButton /></span>
              <LogoutButton className="text-xs font-medium text-slate-400 hover:text-white transition-colors px-2 py-1" />
            </div>
          </div>
        </div>

        {/* Mobile: client name + site selector row */}
        {(clientName || hasSites) && (
          <div className="sm:hidden flex items-center gap-3 px-5 pb-3 -mt-1">
            {clientName && <span className="text-xs font-semibold text-slate-300 truncate">{clientName}</span>}
            {hasSites && sites && (
              <Suspense fallback={null}>
                <SiteSelector sites={sites} selectedSiteId={selectedSiteId} />
              </Suspense>
            )}
          </div>
        )}
      </header>

      {/* Onboarding modal — shows on first login, reopenable via How it works */}
      <ClientOnboardingModal />

      {/* ── Page content ───────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-5 lg:px-8 py-8 lg:py-10 pb-28 md:pb-10">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                  active ? 'text-[#1e3a5f]' : 'text-gray-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-[#1e3a5f]' : 'text-gray-400'}`} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
