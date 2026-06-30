'use client'

import { Printer } from 'lucide-react'

export function PrintButton({ label = 'Print / Save PDF' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg px-3 py-1.5 transition-colors"
    >
      <Printer className="w-3.5 h-3.5" /> {label}
    </button>
  )
}
