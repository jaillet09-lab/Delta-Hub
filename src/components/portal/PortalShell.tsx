import Link from 'next/link'
import { LogoutButton } from './LogoutButton'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface PortalShellProps {
  children: React.ReactNode
  userName?: string | null
  subtitle?: string
  navItems?: NavItem[]
  /** Back link shown in header instead of full nav */
  backHref?: string
  backLabel?: string
}

export function PortalShell({
  children,
  userName,
  subtitle,
  navItems,
  backHref,
  backLabel,
}: PortalShellProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Top bar — safe area aware for iPhone notch / Dynamic Island */}
      <header
        className="sticky top-0 z-40 bg-white border-b border-gray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
          {backHref ? (
            <Link
              href={backHref}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-black transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel ?? 'Back'}
            </Link>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo-mark-white.png"
              alt="Delta Cleaning"
              style={{ height: '32px', width: 'auto', flexShrink: 0 }}
              className="invert block"
            />
          )}

          <div className="flex items-center gap-3">
            {userName && (
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {userName}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
        {subtitle && (
          <div className="px-5 pb-3 max-w-lg mx-auto">
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 pb-24">
          {children}
        </div>
      </main>

      {/* Bottom tab navigation (only when navItems provided) */}
      {navItems && navItems.length > 0 && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-stretch max-w-lg mx-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-gray-500 hover:text-black transition-colors"
              >
                <span className="w-6 h-6 flex items-center justify-center">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
