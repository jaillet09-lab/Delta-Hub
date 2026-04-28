'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MapPin, ChevronDown } from 'lucide-react'

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
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  if (sites.length < 2) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('site', e.target.value)
    } else {
      params.delete('site')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const selected = sites.find((s) => s.id === selectedSiteId)

  return (
    <div className="relative flex items-center gap-1.5 text-sm">
      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="relative">
        <select
          value={selectedSiteId ?? ''}
          onChange={handleChange}
          className="appearance-none bg-transparent text-sm font-medium text-gray-700 pr-5 cursor-pointer focus:outline-none border-none"
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.site_name}{s.suburb ? ` · ${s.suburb}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      </div>
    </div>
  )
}
