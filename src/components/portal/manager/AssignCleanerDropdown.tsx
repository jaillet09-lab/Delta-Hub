'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignCleanerToClientAction } from '@/actions/manager'
import { PortalSelect } from '@/components/portal/PortalSelect'

interface Props {
  clientId: string
  currentCleanerId: string | null
  cleaners: { id: string; full_name: string | null }[]
}

export function AssignCleanerDropdown({ clientId, currentCleanerId, cleaners }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(currentCleanerId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleChange(newId: string) {
    setValue(newId)
    setSaving(true)
    setSaved(false)
    await assignCleanerToClientAction(clientId, newId || null)
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  const options = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.full_name ?? c.id })),
  ]

  return (
    <div className="bg-white rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Assign Cleaner</p>
      <PortalSelect
        value={value}
        onChange={handleChange}
        options={options}
        placeholder="Unassigned"
        disabled={saving}
      />
      {saved && <p className="text-xs text-green-600 mt-2">✓ Saved</p>}
    </div>
  )
}
