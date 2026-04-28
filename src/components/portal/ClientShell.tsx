import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { LogoutButton } from './LogoutButton'
import { ClientOnboardingModal } from './client/ClientOnboardingModal'
import { HowItWorksButton } from './client/HowItWorksButton'
import { SiteSelector } from './client/SiteSelector'

const NAV = [
  { href: '/client/dashboard',   label: 'Overview'    },
  { href: '/client/compliance',  label: 'Compliance'  },
  { href: '/client/services',    label: 'Services'    },
  { href: '/client/contact',     label: 'Contact'     },
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

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top bar — desktop focused */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-8 h-16 max-w-5xl mx-auto">
          {/* Logo + client name + site selector */}
          <div className="flex items-center gap-4 min-w-0">
            <Image
              src="/logo-white.png"
              alt="Delta Cleaning"
              width={110}
              height={34}
              className="object-contain invert flex-shrink-0"
              priority
            />
            {clientName && (
              <>
                <span className="text-gray-200 text-lg font-thin flex-shrink-0">|</span>
                <span className="text-sm font-semibold text-gray-700 truncate">{clientName}</span>
              </>
            )}
            {hasSites && sites && (
              <>
                <span className="text-gray-200 text-lg font-thin flex-shrink-0">|</span>
                <Suspense fallback={null}>
                  <SiteSelector sites={sites} selectedSiteId={selectedSiteId} />
                </Suspense>
              </>
            )}
          </div>

          {/* Nav + user */}
          <div className="flex items-center gap-6">
            {NAV.map((item) => {
              const isActive = activePath === item.href || activePath?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-black' : 'text-gray-400 hover:text-black'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
            <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
              <HowItWorksButton />
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Onboarding modal — shows on first login, reopenable via How it works */}
      <ClientOnboardingModal />

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-8 py-10">
        {children}
      </main>
    </div>
  )
}
