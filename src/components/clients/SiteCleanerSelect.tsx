'use client'

import { useState } from 'react'
import { Check, UserCog } from 'lucide-react'
import { assignSiteCleanerAction } from '@/actions/schedule'

export function SiteCleanerSelect({
  clientId, siteId, cleaners, current,
}: {
  clientId: string
  siteId: string
  cleaners: { id: string; full_name: string | null }[]
  current: string | null
}) {
  const [value, setValue] = useState<string>(current ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function change(next: string) {
    setValue(next); setSaved(false); setSaving(true)
    const r = await assignSiteCleanerAction(clientId, siteId, next || null)
    setSaving(false)
    if (!r?.error) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  return (
    <div className="flex items-center gap-2">
      <UserCog className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        className="text-xs rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus:border-[#1e3a5f] outline-none disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {cleaners.map((c) => (
          <option key={c.id} value={c.id}>{c.full_name ?? 'Cleaner'}</option>
        ))}
      </select>
      {saved && <Check className="w-3.5 h-3.5 text-emerald-500" />}
    </div>
  )
}
