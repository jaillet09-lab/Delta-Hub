'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { createProposalAction } from '@/actions/proposal-docs'

export function NewProposalButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      onClick={() => { setBusy(true); createProposalAction() }}
      disabled={busy}
      className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-[0_4px_12px_rgba(30,58,95,0.25)] active:scale-[0.98] transition-all disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} New proposal
    </button>
  )
}
