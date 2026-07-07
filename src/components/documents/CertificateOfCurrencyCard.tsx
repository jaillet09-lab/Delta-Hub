'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Upload, Loader2, ExternalLink } from 'lucide-react'
import { uploadComplianceDocAction } from '@/actions/team'

// Company-level Certificate of Currency: stored in Supabase via the shared
// compliance-doc uploader (global, type 'certificate_of_currency'). Shows the
// current one with a View link, and lets the owner upload or replace it.
export function CertificateOfCurrencyCard({
  current,
  viewHref,
}: {
  current: { expiry_date: string | null; created_at: string } | null
  viewHref: string | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', 'Certificate of Currency')
    fd.append('description', 'Current certificate of currency for Delta Cleaning insurance.')
    fd.append('type', 'certificate_of_currency')
    fd.append('clientId', '')
    fd.append('profileId', '')
    fd.append('expiryDate', '')
    const res = await uploadComplianceDocAction(fd)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (res?.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">Certificate of Currency</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {current
              ? `Uploaded ${new Date(current.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}${current.expiry_date ? ` · expires ${new Date(current.expiry_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
              : 'Not uploaded yet — add your insurer’s certificate of currency (PDF).'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {viewHref && (
            <a href={viewHref} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-full px-3.5 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors">
              View <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 border border-gray-200 rounded-full px-3.5 py-1.5 hover:border-gray-300 transition-colors disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {current ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
