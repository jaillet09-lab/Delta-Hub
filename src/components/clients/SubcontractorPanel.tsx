'use client'

import { useState } from 'react'
import { Link2, Check, Copy, Loader2, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react'
import { ensureSubcontractorLinkAction } from '@/actions/subcontractor'

interface Sub {
  company_name: string | null
  abn: string | null
  contact_name: string | null
  contact_email: string | null
  insurance_expiry: string | null
  sign_code: string | null
  signed_at: string | null
  signed_name: string | null
}

function expiryInfo(dateStr: string | null): { label: string; cls: string; days: number | null } {
  if (!dateStr) return { label: 'Not recorded', cls: 'text-gray-400', days: null }
  const days = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  if (days < 0) return { label: `${label} · expired`, cls: 'text-red-600', days }
  if (days <= 30) return { label: `${label} · ${days}d`, cls: 'text-red-600', days }
  if (days <= 60) return { label: `${label} · ${days}d`, cls: 'text-amber-600', days }
  return { label, cls: 'text-gray-800', days }
}

export function SubcontractorPanel({ sub }: { sub: Sub | null }) {
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function makeLink() {
    setBusy(true)
    const res = await ensureSubcontractorLinkAction()
    setBusy(false)
    if ('link' in res) { setLink(res.link); copy(res.link) }
  }
  function copy(l: string) {
    navigator.clipboard?.writeText(l).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

  const signed = !!sub?.signed_at
  const ins = expiryInfo(sub?.insurance_expiry ?? null)
  const shownLink = link ?? (sub?.sign_code ? `https://portal.deltacleaning.com.au/onboard/${sub.sign_code}` : null)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Subcontractor</p>
        </div>
        {signed && <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">Onboarded</span>}
      </div>

      {signed ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Company</span>
            <span className="font-semibold text-gray-900">{sub?.company_name || '—'}{sub?.abn ? <span className="text-gray-400 font-normal"> · ABN {sub.abn}</span> : null}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Signed by</span>
            <span className="font-medium text-gray-800">{sub?.signed_name} · {new Date(sub!.signed_at!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Insurance expiry</span>
            <span className={`font-medium flex items-center gap-1 ${ins.cls}`}>
              {ins.days != null && ins.days <= 60 && <AlertTriangle className="w-3.5 h-3.5" />}
              {ins.label}
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1">
            {shownLink && <a href={shownLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e3a5f] hover:underline"><ExternalLink className="w-3.5 h-3.5" /> View signed documents</a>}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">No subcontractor onboarded yet. Create a secure link and send it to your subcontractor company — they review the whole pack, add their details, and sign once.</p>
          {shownLink && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 mb-2">
              <span className="text-xs text-gray-500 truncate flex-1">{shownLink}</span>
              <button onClick={() => copy(shownLink)} className="text-xs font-semibold text-[#1e3a5f] inline-flex items-center gap-1">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          )}
          <button onClick={makeLink} disabled={busy}
            className="inline-flex items-center gap-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl px-4 py-2.5 disabled:opacity-50 transition-colors">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Link2 className="w-4 h-4" /> {shownLink ? 'New link' : 'Create onboarding link'}</>}
          </button>
        </div>
      )}
    </div>
  )
}
