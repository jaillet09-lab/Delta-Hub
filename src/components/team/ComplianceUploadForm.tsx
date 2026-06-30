'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { uploadComplianceDocAction } from '@/actions/team'

interface Person { id: string; business_name?: string; full_name?: string }

const TYPES: { value: string; label: string }[] = [
  { value: 'sds',          label: 'Safety Data Sheet (SDS)' },
  { value: 'insurance',    label: 'Insurance Certificate' },
  { value: 'contract',     label: 'Client Contract' },
  { value: 'police_check', label: 'Police Check' },
  { value: 'white_card',   label: 'White Card' },
  { value: 'qualification',label: 'Qualification / Cert' },
  { value: 'other',        label: 'Other' },
]

export function ComplianceUploadForm({ clients, cleaners = [] }: { clients: Person[]; cleaners?: Person[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('sds')
  const [assignee, setAssignee] = useState('')   // '' = global, c:<id> = client, p:<id> = cleaner
  const [expiry, setExpiry] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2.5 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !file) return setError('Name and file are required')
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('description', description.trim())
    fd.append('type', type)
    fd.append('clientId', assignee.startsWith('c:') ? assignee.slice(2) : '')
    fd.append('profileId', assignee.startsWith('p:') ? assignee.slice(2) : '')
    fd.append('expiryDate', expiry)
    const result = await uploadComplianceDocAction(fd)
    setUploading(false)
    if (result.error) return setError(result.error)
    setSuccess(true); setName(''); setDescription(''); setFile(null); setAssignee(''); setExpiry('')
    if (fileRef.current) fileRef.current.value = ''
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2.5">✓ Document uploaded</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">{error}</div>}

      <div>
        <label className={lbl}>Document Name</label>
        <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Public Liability Insurance" />
      </div>
      <div>
        <label className={lbl}>Description <span className="text-gray-400">(optional)</span></label>
        <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this document" />
      </div>
      <div>
        <label className={lbl}>Type</label>
        <select className={inp} value={type} onChange={(e) => {
          const t = e.target.value
          setType(t)
          if (t === 'contract') { setName('Service Agreement'); setDescription('Your signed service agreement outlining scope, schedule, and terms.') }
          else if (type === 'contract') { setName(''); setDescription('') }
        }}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>Belongs to</label>
        <select className={inp} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Global (all clients)</option>
          {clients.length > 0 && (
            <optgroup label="Client">
              {clients.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.business_name}</option>)}
            </optgroup>
          )}
          {cleaners.length > 0 && (
            <optgroup label="Cleaner">
              {cleaners.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.full_name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <div>
        <label className={lbl}>Expiry date <span className="text-gray-400">(optional — drives the monitor)</span></label>
        <input type="date" className={inp} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
      <div>
        <label className={lbl}>File (PDF)</label>
        <input ref={fileRef} type="file" accept=".pdf,image/*" className={inp + ' py-1.5'}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <button type="submit" disabled={uploading} className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
        {uploading ? 'Uploading…' : 'Upload Document'}
      </button>
    </form>
  )
}
