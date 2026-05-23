'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createJobAction } from '@/actions/team'
import { PortalSelect } from '@/components/portal/PortalSelect'

interface Props {
  clientId: string
  clientAddress?: string | null
  clientSuburb?: string | null
  serviceDays?: string[]
  cleaners: { id: string; full_name: string | null }[]
}

const DAY_NUM: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function upcomingDates(serviceDays: string[], count = 8): string[] {
  const targets = serviceDays
    .map((d) => DAY_NUM[d.toLowerCase()])
    .filter((n) => n !== undefined)
  if (targets.length === 0) return []
  const results: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 90 && results.length < count; i++) {
    if (targets.includes(cursor.getDay())) {
      results.push(cursor.toISOString().split('T')[0])
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return results
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function ManagerQuickJobForm({
  clientId, clientAddress, clientSuburb, serviceDays = [], cleaners,
}: Props) {
  const router = useRouter()
  const dates  = upcomingDates(serviceDays)
  const hasDates = dates.length > 0

  const [selectedDate, setSelectedDate] = useState(dates[0] ?? '')
  const [manualDate, setManualDate]     = useState('')
  const [cleanerId, setCleanerId]       = useState('')
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [success, setSuccess]           = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const inp = 'w-full border-b border-gray-200 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors bg-transparent placeholder-gray-400'
  const chosenDate = hasDates ? selectedDate : manualDate

  const dateOptions = dates.map((d) => ({ value: d, label: formatDate(d) }))
  const cleanerOptions = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.full_name ?? c.id })),
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chosenDate) { setError('Select a date'); return }
    setSaving(true)
    setError(null)
    const address = [clientAddress, clientSuburb].filter(Boolean).join(', ')
    const result = await createJobAction({
      clientId,
      cleanerId:      cleanerId || null,
      scheduledDate:  chosenDate,
      address,
      accessNotes:    notes.trim() || null,
      frequencyLabel: null,
      checklist:      [],
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setSuccess(true)
    setCleanerId(''); setNotes(''); setManualDate('')
    if (hasDates) {
      const idx = dates.indexOf(selectedDate)
      setSelectedDate(dates[idx + 1] ?? dates[0] ?? '')
    }
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="bg-white rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Schedule Job</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {success && <p className="text-xs text-green-600 font-semibold">✓ Job scheduled</p>}
        {error   && <p className="text-xs text-red-500">{error}</p>}

        <div>
          <p className="text-xs text-gray-400 mb-1.5">Service Date</p>
          {hasDates ? (
            <PortalSelect
              value={selectedDate}
              onChange={setSelectedDate}
              options={dateOptions}
              placeholder="Select date…"
            />
          ) : (
            <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} required className={inp} />
          )}
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">Assign Cleaner</p>
          <PortalSelect
            value={cleanerId}
            onChange={setCleanerId}
            options={cleanerOptions}
            placeholder="Unassigned"
          />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">Access Notes (optional)</p>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Entry codes, alarm pin…" className={inp} />
        </div>

        <button type="submit" disabled={saving || !chosenDate}
          className="w-full bg-black text-white text-sm font-semibold rounded-2xl py-3.5 disabled:opacity-40 active:scale-[0.98] transition-all">
          {saving ? 'Scheduling…' : 'Schedule Job'}
        </button>
      </form>
    </div>
  )
}
