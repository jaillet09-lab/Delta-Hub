'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface PortalSelectOption {
  value: string
  label: string
}

interface PortalSelectProps {
  value: string
  onChange: (value: string) => void
  options: PortalSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Custom styled dropdown for the manager/cleaner/client portal.
 * Replaces native <select> so it looks consistent on all platforms.
 */
export function PortalSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
}: PortalSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          border-b border-gray-200 py-2.5 text-sm text-left
          focus:outline-none focus:border-black transition-colors bg-transparent
          disabled:opacity-40
          ${open ? 'border-black' : ''}
        `}
      >
        <span className={selected ? 'text-black' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className={value === opt.value ? 'font-semibold text-black' : 'text-gray-700'}>
                {opt.label}
              </span>
              {value === opt.value && <Check className="w-4 h-4 text-black flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
