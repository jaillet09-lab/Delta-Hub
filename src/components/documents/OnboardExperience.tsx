'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Check, ShieldCheck, Lock, FileText, ExternalLink, Download } from 'lucide-react'
import { SubcontractorAgreementDocument, InductionDocument, type SubbieSignature } from '@/components/documents/render/SwmsDocument'
import { DocBackButton } from '@/components/documents/DocBackButton'
import { SWMS_LIST, POLICIES } from '@/lib/documents/safety'
import { submitSubcontractorOnboardingAction } from '@/actions/subcontractor'

const WORDMARK_WHITE = '/proposal-assets/wordmark-white.png'

const INCLUDED = [
  ...SWMS_LIST.map((s) => ({ slug: s.code.replace(/\s+/g, '-').toLowerCase(), title: `${s.code} — ${s.title}` })),
  ...POLICIES.map((p) => ({ slug: p.slug, title: p.title })),
  { slug: 'modern-slavery', title: 'Modern Slavery Declaration' },
  { slug: 'sds-register', title: 'SDS Register' },
]

export function OnboardExperience({ code, alreadySigned }: { code: string; alreadySigned: SubbieSignature | null }) {
  const [signed, setSigned] = useState<SubbieSignature | null>(alreadySigned)
  const [f, setF] = useState({ companyName: '', abn: '', contactName: '', contactEmail: '', contactPhone: '', insuranceExpiry: '', name: '' })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }), [])
  const hasName = f.name.trim().length >= 2
  const canSign = hasName && agreed && !busy

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / 794))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [signed])

  async function sign() {
    if (!canSign) return
    setBusy(true); setError(null)
    const res = await submitSubcontractorOnboardingAction(code, f.name, {
      companyName: f.companyName, abn: f.abn, contactName: f.contactName, contactEmail: f.contactEmail, contactPhone: f.contactPhone, insuranceExpiry: f.insuranceExpiry,
    })
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setSigned({ name: f.name.trim().replace(/\s+/g, ' '), date: res?.date ?? today, company: f.companyName.trim() || undefined })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'

  return (
    <div className="min-h-[100dvh] bg-[#0b1320]">
      {signed && <DocBackButton fallbackHref="/safety" />}
      <header className="px-5 pt-8 pb-6 text-center">
        <img src={WORDMARK_WHITE} alt="Delta Cleaning" className="h-6 w-auto mx-auto mb-5 opacity-95" />
        {signed ? (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-emerald-400" /></div>
            <h1 className="text-white text-2xl font-bold tracking-tight">You&apos;re onboarded{signed.company ? `, ${signed.company}` : ''}.</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">Your onboarding pack is signed and saved with Delta Cleaning. Thank you.</p>
            <a href={`/api/subcontractor/${code}/pdf`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 mt-5 bg-white text-[#0b1320] text-sm font-semibold rounded-xl px-5 py-2.5 hover:bg-slate-100 transition-colors">
              <Download className="w-4 h-4" /> Download signed copy
            </a>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-blue-300 mb-2">Contractor Onboarding</p>
            <h1 className="text-white text-2xl font-bold tracking-tight max-w-md mx-auto">Welcome — let&apos;s get you set up.</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">Review the pack below, add your company details, and sign once. It takes a few minutes.</p>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[11px] text-slate-500"><Lock className="w-3 h-3" /> Secure · one signature covers everything</div>
          </>
        )}
      </header>

      <div className="mx-auto max-w-[1240px] lg:flex lg:items-start lg:gap-6 lg:px-6 lg:pb-12">
        {/* Documents */}
        <div className="lg:flex-1 lg:min-w-0 bg-[#E6E8EB] lg:rounded-2xl px-3 py-8">
          <div className="flex flex-col items-center gap-8">
            <div style={{ zoom: scale } as any}><SubcontractorAgreementDocument signature={signed} /></div>
            <div style={{ zoom: scale } as any}><InductionDocument signature={signed} /></div>
          </div>
          <div className="max-w-[794px] mx-auto mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Also included in this pack</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {INCLUDED.map((d) => (
                <a key={d.slug} href={`/compliance/${d.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-[#1e3a5f]">
                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" /> <span className="truncate">{d.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Sign panel */}
        {!signed && (
          <aside className="sticky bottom-0 z-10 bg-white border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:self-start lg:sticky lg:top-6 lg:bottom-auto lg:w-[380px] lg:flex-shrink-0 lg:border lg:rounded-2xl lg:shadow-xl">
            <div className="max-w-[560px] lg:max-w-none mx-auto px-5 py-5 lg:px-6 lg:py-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your details</p>
              <div className="space-y-2.5">
                <input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Company name" className={inputCls} />
                <input value={f.abn} onChange={(e) => set('abn', e.target.value)} inputMode="numeric" placeholder="ABN" className={inputCls} />
                <input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Contact name" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} type="email" placeholder="Email" className={inputCls} />
                  <input value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} type="tel" placeholder="Phone" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Insurance (Public Liability) expiry</label>
                  <input value={f.insuranceExpiry} onChange={(e) => set('insuranceExpiry', e.target.value)} type="date" className={inputCls} />
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">Sign</p>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 pt-3 pb-2">
                <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Type your full name" autoComplete="name"
                  className="w-full bg-transparent outline-none text-gray-900 text-base"
                  style={{ fontFamily: hasName ? "'Caveat', cursive" : undefined, fontSize: hasName ? 30 : 16, lineHeight: 1.2 }} />
                <div className="flex items-center justify-between border-t border-gray-200 mt-1 pt-1.5">
                  <span className="text-[11px] text-gray-400">Signature</span>
                  <span className="text-[11px] text-gray-400">{hasName ? today : 'Date'}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 mt-4 cursor-pointer select-none">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0b1320] flex-shrink-0" />
                <span className="text-[13px] leading-snug text-gray-600">
                  I agree to be bound by the Subcontractor Agreement, and I confirm I have read and understood the Induction, SWMS and policies in this pack{f.companyName ? `, on behalf of ${f.companyName}` : ''}.
                </span>
              </label>

              {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">{error}</div>}

              <button onClick={sign} disabled={!canSign}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#0b1320] text-white text-[15px] font-bold rounded-xl py-4 disabled:opacity-40 active:scale-[0.99] transition-all">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing…</> : <><ShieldCheck className="w-4 h-4" /> Sign &amp; onboard</>}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-3">One signature applies to every document in this pack. This electronic signature is legally binding.</p>
            </div>
          </aside>
        )}
      </div>

      {signed && (
        <footer className="text-center py-8 px-5">
          <p className="text-slate-500 text-xs">Signed by {signed.name} on {signed.date} · Delta Cleaning Pty Ltd</p>
        </footer>
      )}
    </div>
  )
}
