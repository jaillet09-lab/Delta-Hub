'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MapPin, ChevronDown, Check } from 'lucide-react'

interface Site {
  id: string
  site_name: string
  suburb?: string | null
}

interface Props {
  sites: Site[]
  selectedSiteId?: string | null
}

export function SiteSelector({ sites, selectedSiteId }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  if (sites.length < 2) return null

  const options = [
    { value: '', label: 'All sites' },
    ...sites.map((s) => ({
      value: s.id,
      label: s.site_name + (s.suburb ? ` · ${s.suburb}` : ''),
    })),
  ]

  const selected = options.find((o) => o.value === (selectedSiteId ?? ''))

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('site', value)
    else params.delete('site')
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-700 focus:outline-none"
      >
        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span>{selected?.label ?? 'All sites'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[180px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-sm text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className={(selectedSiteId ?? '') === opt.value ? 'font-semibold text-black' : 'text-gray-700'}>
                {opt.label}
              </span>
              {(selectedSiteId ?? '') === opt.value && (
                <Check className="w-3.5 h-3.5 text-black flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
