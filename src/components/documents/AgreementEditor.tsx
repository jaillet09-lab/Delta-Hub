'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Check, Download, Loader2, PenLine } from 'lucide-react'
import { AgreementDocument } from '@/components/documents/render/AgreementDocument'
import { withAgreementDefaults, type AgreementData } from '@/lib/documents/agreement'
import type { ScopeGroup } from '@/lib/documents/proposal'
import { saveAgreementDocAction } from '@/actions/proposal-docs'
import { SendAgreementModal } from '@/components/documents/SendAgreementModal'

const inputCls = 'w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
const labelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1'

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className={labelCls}>{label}</label><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} /></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border-b border-gray-100 pb-5 mb-5"><p className="font-display text-sm font-bold text-gray-900 mb-3">{title}</p><div className="space-y-3">{children}</div></div>
}

export function AgreementEditor({ id, initialData, status }: { id: string; initialData: AgreementData; status: string }) {
  const [data, setData] = useState<AgreementData>(withAgreementDefaults(initialData))
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewWrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.55)
  const [showSend, setShowSend] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')

  const set = useCallback(<K extends keyof AgreementData>(key: K, val: AgreementData[K]) => setData(prev => ({ ...prev, [key]: val })), [])

  useEffect(() => {
    setSaved('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => { await saveAgreementDocAction(id, data); setSaved('saved') }, 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const fit = useCallback(() => {
    const w = previewWrap.current?.clientWidth ?? 600
    if (w > 0) setScale(Math.min(0.85, (w - 32) / 794))
  }, [])
  useEffect(() => {
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [fit])
  useEffect(() => {
    if (mobileView === 'preview') { const t = setTimeout(fit, 60); return () => clearTimeout(t) }
  }, [mobileView, fit])

  const updateScope = (i: number, patch: Partial<ScopeGroup>) => set('scopeGroups', data.scopeGroups.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const updateScopeItem = (gi: number, ii: number, val: string) => updateScope(gi, { items: data.scopeGroups[gi].items.map((it, idx) => idx === ii ? val : it) })
  const addScopeItem = (gi: number) => updateScope(gi, { items: [...data.scopeGroups[gi].items, ''] })
  const removeScopeItem = (gi: number, ii: number) => updateScope(gi, { items: data.scopeGroups[gi].items.filter((_, idx) => idx !== ii) })

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col -m-4 lg:-m-8">
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/documents" className="text-gray-400 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{data.clientName || 'Untitled agreement'}</p>
            <p className="text-[11px] text-gray-400">{data.agreementRef} · Service Agreement</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            {saved === 'saving' ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : <><Check className="w-3 h-3 text-emerald-500" /> Saved</>}
          </span>
          <a href={`/documents/${id}/print`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
          <button onClick={() => setShowSend(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#1e3a5f] hover:bg-[#162d4a] text-white rounded-lg px-3 py-2 transition-colors">
            <PenLine className="w-3.5 h-3.5" /> Send for signature
          </button>
        </div>
      </div>
      {showSend && <SendAgreementModal id={id} status={status} onClose={() => setShowSend(false)} />}

      {/* Mobile Edit/Preview toggle (desktop shows both side-by-side) */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={() => setMobileView('edit')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mobileView === 'edit' ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]' : 'text-gray-400 border-b-2 border-transparent'}`}>
          Edit
        </button>
        <button onClick={() => setMobileView('preview')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mobileView === 'preview' ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]' : 'text-gray-400 border-b-2 border-transparent'}`}>
          Preview
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className={`w-full lg:w-[400px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-5 ${mobileView === 'edit' ? 'block' : 'hidden'} lg:block`}>
          <Section title="Parties">
            <Field label="Provider legal name" value={data.providerName} onChange={v => set('providerName', v)} />
            <Field label="Provider ABN" value={data.providerABN} onChange={v => set('providerABN', v)} />
            <Field label="Client legal name" value={data.clientName} onChange={v => set('clientName', v)} />
            <Field label="Client ABN" value={data.clientABN} onChange={v => set('clientABN', v)} />
          </Section>
          <Section title="Particulars">
            <Field label="Premises / site" value={data.premises} onChange={v => set('premises', v)} />
            <Field label="Frequency" value={data.frequency} onChange={v => set('frequency', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Commencement" value={data.commencementDate} onChange={v => set('commencementDate', v)} placeholder="1 July 2026" />
              <Field label="Initial term" value={data.initialTerm} onChange={v => set('initialTerm', v)} />
            </div>
            <Field label="Service fee" value={data.serviceFee} onChange={v => set('serviceFee', v)} />
            <Field label="Payment terms" value={data.paymentTerms} onChange={v => set('paymentTerms', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agreement ref" value={data.agreementRef} onChange={v => set('agreementRef', v)} />
              <Field label="Proposal ref" value={data.proposalRef} onChange={v => set('proposalRef', v)} />
            </div>
            <Field label="Agreement date" value={data.agreementDate} onChange={v => set('agreementDate', v)} />
            <Field label="Special conditions" value={data.specialConditions} onChange={v => set('specialConditions', v)} />
          </Section>
          <Section title="Schedule 1 — scope">
            {data.scopeGroups.map((g, gi) => (
              <div key={gi} className="rounded-lg border border-gray-150 bg-gray-50 p-2.5 space-y-2">
                <input value={g.title} onChange={e => updateScope(gi, { title: e.target.value })} placeholder="Category title" className={inputCls + ' font-semibold'} />
                {g.items.map((it, ii) => (
                  <div key={ii} className="flex items-center gap-1.5">
                    <input value={it} onChange={e => updateScopeItem(gi, ii, e.target.value)} placeholder="Inclusion" className={inputCls} />
                    <button onClick={() => removeScopeItem(gi, ii)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => addScopeItem(gi)} className="text-[11px] font-semibold text-[#1e3a5f] hover:underline">+ Add inclusion</button>
              </div>
            ))}
          </Section>
          <Section title="Delta contact">
            <Field label="Name" value={data.contactName} onChange={v => set('contactName', v)} />
            <Field label="Role" value={data.contactRole} onChange={v => set('contactRole', v)} />
            <Field label="Phone" value={data.contactPhone} onChange={v => set('contactPhone', v)} />
            <Field label="Email" value={data.contactEmail} onChange={v => set('contactEmail', v)} />
          </Section>
        </div>

        <div ref={previewWrap} className={`flex-1 overflow-auto bg-[#E6E8EB] p-4 ${mobileView === 'preview' ? 'block' : 'hidden'} lg:block`}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: 794, margin: '0 auto' }}>
            <AgreementDocument data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}
