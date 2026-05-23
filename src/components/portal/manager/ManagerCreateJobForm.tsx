'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createJobAction } from '@/actions/team'
import { PortalSelect } from '@/components/portal/PortalSelect'

interface Client { id: string; business_name: string; address?: string | null; suburb?: string | null; frequency?: string | null }
interface Cleaner { id: string; fullName: string }
interface Props { clients: Client[]; cleaners: Cleaner[] }

export function ManagerCreateJobForm({ clients, cleaners }: Props) {
  const router = useRouter()
  const [clientId, setClientId]   = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [date, setDate]           = useState('')
  const [address, setAddress]     = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors bg-transparent placeholder-gray-400'

  const clientOptions = [
    { value: '', label: 'Select client…' },
    ...clients.map((c) => ({ value: c.id, label: c.business_name })),
  ]
  const cleanerOptions = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.fullName })),
  ]

  function handleClientChange(id: string) {
    setClientId(id)
    const client = clients.find((c) => c.id === id)
    if (client) {
      const addr = [client.address, client.suburb].filter(Boolean).join(', ')
      if (addr) setAddress(addr)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !date) return setError('Client and date are required')
    setSaving(true); setError(null)
    const selectedClient = clients.find((c) => c.id === clientId)
    const result = await createJobAction({
      clientId,
      cleanerId: cleanerId || null,
      scheduledDate: date,
      address: address.trim(),
      accessNotes: notes.trim() || null,
      frequencyLabel: selectedClient?.frequency ?? null,
      checklist: [],
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    setSuccess(true)
    setClientId(''); setCleanerId(''); setDate(''); setAddress(''); setNotes('')
    router.refresh()
    setTimeout(() => setSuccess(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <p className="text-xs text-green-700 font-medium">✓ Job created</p>}
      {error   && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Client</p>
        <PortalSelect value={clientId} onChange={handleClientChange} options={clientOptions} placeholder="Select client…" />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Assign Cleaner</p>
        <PortalSelect value={cleanerId} onChange={setCleanerId} options={cleanerOptions} placeholder="Unassigned" />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Date</p>
        <input className={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Address</p>
        <input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Suburb" />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Access Notes (optional)</p>
        <input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Entry codes, alarm pin…" />
      </div>

      <button type="submit" disabled={saving || !clientId || !date}
        className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3.5 disabled:opacity-40 active:scale-[0.98] transition-all">
        {saving ? 'Creating…' : 'Create Job'}
      </button>
    </form>
  )
}
