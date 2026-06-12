'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Lead } from '@/types/app'

interface ProposalFormProps {
  lead: Lead
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  loading?: boolean
}

const inputClass = 'w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
const labelClass = 'text-xs font-medium text-gray-600 block mb-1.5'

export function ProposalForm({ lead, onSave, onCancel, loading }: ProposalFormProps) {
  const existing = lead.proposal_data || {}

  const [form, setForm] = useState({
    contactName:        existing.contactName        ?? lead.contact_name ?? '',
    businessName:       existing.businessName       ?? lead.business_name ?? '',
    address:            existing.address            ?? [lead.address, lead.suburb, lead.state].filter(Boolean).join(', '),
    serviceTypes:       existing.serviceTypes       ?? '',
    frequency:          existing.frequency          ?? '',
    ratePerVisit:       existing.ratePerVisit       ?? '',
    scopeOfWork:        existing.scopeOfWork        ?? '',
    inclusions:         existing.inclusions         ?? '',
    exclusions:         existing.exclusions         ?? '',
    termsAndConditions: existing.termsAndConditions ?? '',
    validUntil:         existing.validUntil         ?? '',
  })

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Contact Name</label>
          <input value={form.contactName} onChange={update('contactName')} className={inputClass} placeholder="Contact person" />
        </div>
        <div>
          <label className={labelClass}>Business Name</label>
          <input value={form.businessName} onChange={update('businessName')} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Address</label>
        <input value={form.address} onChange={update('address')} className={inputClass} placeholder="Site address" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Services</label>
          <input value={form.serviceTypes} onChange={update('serviceTypes')} className={inputClass} placeholder="e.g. General Cleaning" />
        </div>
        <div>
          <label className={labelClass}>Frequency</label>
          <select value={form.frequency} onChange={update('frequency')} className={inputClass + ' cursor-pointer'}>
            <option value="">Select…</option>
            {['Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'One-off'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Rate Per Visit ($)</label>
          <input type="number" inputMode="decimal" value={form.ratePerVisit} onChange={update('ratePerVisit')} className={inputClass} placeholder="0.00" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Scope of Work</label>
        <textarea value={form.scopeOfWork} onChange={update('scopeOfWork')} rows={3} className={inputClass + ' resize-none'} placeholder="Describe cleaning scope…" />
      </div>
      <div>
        <label className={labelClass}>Inclusions</label>
        <textarea value={form.inclusions} onChange={update('inclusions')} rows={2} className={inputClass + ' resize-none'} placeholder="What's included…" />
      </div>
      <div>
        <label className={labelClass}>Exclusions</label>
        <textarea value={form.exclusions} onChange={update('exclusions')} rows={2} className={inputClass + ' resize-none'} placeholder="What's excluded…" />
      </div>
      <div>
        <label className={labelClass}>Terms &amp; Conditions</label>
        <textarea value={form.termsAndConditions} onChange={update('termsAndConditions')} rows={3} className={inputClass + ' resize-none'} placeholder="Payment terms, cancellation policy…" />
      </div>
      <div>
        <label className={labelClass}>Valid Until</label>
        <input type="date" value={form.validUntil} onChange={update('validUntil')} className={inputClass} />
      </div>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={() => onSave({ ...form, generatedDate: new Date().toISOString() })} disabled={loading}>
          {loading ? 'Saving…' : 'Save Proposal'}
        </Button>
      </div>
    </div>
  )
}
