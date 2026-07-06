'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, FileText, Pencil, Trash2, ExternalLink, AlertTriangle, Loader2, X, ShieldCheck, Upload } from 'lucide-react'
import { saveCertificationAction, deleteCertificationAction, type CertInput } from '@/actions/certifications'

export interface Cert {
  id: string
  name: string
  category: string
  holder: string | null
  issuer: string | null
  reference: string | null
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
  notes: string | null
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'licence', label: 'Licence' },
  { value: 'check', label: 'Background check' },
  { value: 'training', label: 'Training / cert' },
  { value: 'other', label: 'Other' },
]
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? 'Other'

function expiryFlag(dateStr: string | null): { label: string; cls: string; days: number | null } {
  if (!dateStr) return { label: 'No expiry', cls: 'text-gray-400', days: null }
  const days = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  if (days < 0) return { label: `Expired ${label}`, cls: 'text-red-600', days }
  if (days <= 30) return { label: `${label} · ${days}d left`, cls: 'text-red-600', days }
  if (days <= 60) return { label: `${label} · ${days}d left`, cls: 'text-amber-600', days }
  return { label, cls: 'text-gray-700', days }
}

const EMPTY: CertInput = { name: '', category: 'insurance', holder: 'Delta Cleaning', issuer: '', reference: '', issue_date: '', expiry_date: '', file_url: '', notes: '' }
const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'

export function CertificationsPanel({ certs }: { certs: Cert[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<CertInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...certs].sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999'))
  const expiringSoon = certs.filter((c) => { const d = expiryFlag(c.expiry_date).days; return d != null && d <= 60 }).length

  function openNew() { setError(null); setEditing({ ...EMPTY }) }
  function openEdit(c: Cert) {
    setError(null)
    setEditing({ id: c.id, name: c.name, category: c.category, holder: c.holder ?? '', issuer: c.issuer ?? '', reference: c.reference ?? '', issue_date: c.issue_date ?? '', expiry_date: c.expiry_date ?? '', file_url: c.file_url ?? '', notes: c.notes ?? '' })
  }
  const set = (k: keyof CertInput, v: string) => setEditing((p) => p ? { ...p, [k]: v } : p)

  async function upload(file: File) {
    setUploading(true); setError(null)
    try {
      const supabase = createClient() as any
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `certifications/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('job-photos').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (upErr) { setError(upErr.message); setUploading(false); return }
      const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
      set('file_url', data.publicUrl as string)
    } catch { setError('Upload failed.') }
    setUploading(false)
  }

  async function save() {
    if (!editing) return
    setBusy(true); setError(null)
    const res = await saveCertificationAction(editing)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setEditing(null)
    router.refresh()
  }
  async function remove(id: string) {
    if (!confirm('Delete this certificate from the register?')) return
    await deleteCertificationAction(id)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Certifications &amp; insurance</p>
          {expiringSoon > 0 && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{expiringSoon} expiring</span>}
        </div>
        {!editing && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Form */}
      {editing && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{editing.id ? 'Edit certificate' : 'New certificate'}</p>
            <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <input value={editing.name} onChange={(e) => set('name', e.target.value)} placeholder="Name (e.g. Public Liability Insurance)" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <select value={editing.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input value={editing.holder ?? ''} onChange={(e) => set('holder', e.target.value)} placeholder="Held by" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={editing.issuer ?? ''} onChange={(e) => set('issuer', e.target.value)} placeholder="Issuer / insurer" className={inputCls} />
            <input value={editing.reference ?? ''} onChange={(e) => set('reference', e.target.value)} placeholder="Policy / ref number" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-400 block mb-1">Issue date</label><input type="date" value={editing.issue_date ?? ''} onChange={(e) => set('issue_date', e.target.value)} className={inputCls} /></div>
            <div><label className="text-[11px] text-gray-400 block mb-1">Expiry date</label><input type="date" value={editing.expiry_date ?? ''} onChange={(e) => set('expiry_date', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-gray-300">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {editing.file_url ? 'Replace file' : 'Upload certificate'}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
            </label>
            {editing.file_url && <a href={editing.file_url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 inline-flex items-center gap-1 hover:text-gray-800"><FileText className="w-3.5 h-3.5" /> attached</a>}
          </div>
          <input value={editing.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Notes (optional)" className={inputCls} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#0b1320] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save certificate'}
            </button>
            <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 && !editing ? (
        <p className="text-sm text-gray-400 py-2">No certificates yet. Add your insurances, licences and checks to track their expiry.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => {
            const ex = expiryFlag(c.expiry_date)
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">{catLabel(c.category)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {[c.holder, c.reference].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-medium flex items-center gap-1 ${ex.cls}`}>
                    {ex.days != null && ex.days <= 60 && <AlertTriangle className="w-3.5 h-3.5" />}
                    {ex.label}
                  </span>
                  {c.file_url && <a href={c.file_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#1e3a5f]" title="View certificate"><ExternalLink className="w-4 h-4" /></a>}
                  <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-gray-700" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(c.id)} className="text-gray-300 hover:text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
