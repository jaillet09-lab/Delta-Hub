'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Lead } from '@/types/app'

interface AgreementFormProps {
  lead: Lead
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  loading?: boolean
}

const inputClass = 'w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
const labelClass = 'text-xs font-medium text-gray-600 block mb-1.5'

export function AgreementForm({ lead, onSave, onCancel, loading }: AgreementFormProps) {
  const existing = lead.agreement_data || {}
  const proposal = lead.proposal_data || {}

  const [form, setForm] = useState({
    contactName:        existing.contactName        ?? lead.contact_name ?? '',
    businessName:       existing.businessName       ?? lead.business_name ?? '',
    address:            existing.address            ?? [lead.address, lead.suburb, lead.state].filter(Boolean).join(', '),
    serviceTypes:       existing.serviceTypes       ?? proposal.serviceTypes ?? '',
    frequency:          existing.frequency          ?? proposal.frequency ?? '',
    ratePerVisit:       existing.ratePerVisit       ?? proposal.ratePerVisit ?? '',
    commencementDate:   existing.commencementDate   ?? '',
    contractLength:     existing.contractLength     ?? '12 months',
    noticePeriod:       existing.noticePeriod       ?? '30 days',
    paymentTerms:       existing.paymentTerms       ?? 'Net 14 days',
    specialInstructions: existing.specialInstructions ?? '',
    terminationClause:  existing.terminationClause  ?? 'Either party may terminate this agreement by providing the required notice period in writing.',
    signatoryName:      existing.signatoryName      ?? lead.contact_name ?? '',
    signatoryTitle:     existing.signatoryTitle     ?? '',
  })

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Contact Name</label>
          <input value={form.contactName} onChange={update('contactName')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Business Name</label>
          <input value={form.businessName} onChange={update('businessName')} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Site Address</label>
        <input value={form.address} onChange={update('address')} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Services</label>
          <input value={form.serviceTypes} onChange={update('serviceTypes')} className={inputClass} />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Commencement Date</label>
          <input type="date" value={form.commencementDate} onChange={update('commencementDate')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contract Length</label>
          <input value={form.contractLength} onChange={update('contractLength')} className={inputClass} placeholder="e.g. 12 months" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Notice Period</label>
          <input value={form.noticePeriod} onChange={update('noticePeriod')} className={inputClass} placeholder="e.g. 30 days" />
        </div>
        <div>
          <label className={labelClass}>Payment Terms</label>
          <input value={form.paymentTerms} onChange={update('paymentTerms')} className={inputClass} placeholder="e.g. Net 14 days" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Special Instructions</label>
        <textarea value={form.specialInstructions} onChange={update('specialInstructions')} rows={3} className={inputClass + ' resize-none'} placeholder="Access instructions, special requirements…" />
      </div>
      <div>
        <label className={labelClass}>Termination Clause</label>
        <textarea value={form.terminationClause} onChange={update('terminationClause')} rows={2} className={inputClass + ' resize-none'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Signatory Name</label>
          <input value={form.signatoryName} onChange={update('signatoryName')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Signatory Title</label>
          <input value={form.signatoryTitle} onChange={update('signatoryTitle')} className={inputClass} placeholder="e.g. Director" />
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={() => onSave({ ...form, generatedDate: new Date().toISOString() })} disabled={loading}>
          {loading ? 'Saving…' : 'Save Agreement'}
        </Button>
      </div>
    </div>
  )
}
