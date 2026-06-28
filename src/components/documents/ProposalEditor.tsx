'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Check, Download, Loader2, Send, FilePen } from 'lucide-react'
import { ProposalDocument } from '@/components/documents/render/ProposalDocument'
import { SendProposalModal } from '@/components/documents/SendProposalModal'
import { withProposalDefaults, type ProposalData, type ScopeGroup, type PricingRow } from '@/lib/documents/proposal'
import { saveProposalDocAction, convertToAgreementAction } from '@/actions/proposal-docs'

const inputCls = 'w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
const labelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1'

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 pb-5 mb-5">
      <p className="font-display text-sm font-bold text-gray-900 mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export function ProposalEditor({ id, initialData, status }: { id: string; initialData: ProposalData; status: string }) {
  const router = useRouter()
  const [data, setData] = useState<ProposalData>(withProposalDefaults(initialData))
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewWrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.55)
  const [showSend, setShowSend] = useState(false)
  const [converting, setConverting] = useState(false)

  const set = useCallback(<K extends keyof ProposalData>(key: K, val: ProposalData[K]) => {
    setData(prev => ({ ...prev, [key]: val }))
  }, [])

  // Debounced autosave
  useEffect(() => {
    setSaved('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await saveProposalDocAction(id, data)
      setSaved('saved')
    }, 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Fit the 794px document to the preview pane width
  useEffect(() => {
    function fit() {
      const w = previewWrap.current?.clientWidth ?? 600
      setScale(Math.min(0.85, (w - 32) / 794))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // ── scope / pricing / services helpers ──
  const updateScope = (i: number, patch: Partial<ScopeGroup>) =>
    set('scopeGroups', data.scopeGroups.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const updateScopeItem = (gi: number, ii: number, val: string) =>
    updateScope(gi, { items: data.scopeGroups[gi].items.map((it, idx) => idx === ii ? val : it) })
  const addScopeItem = (gi: number) => updateScope(gi, { items: [...data.scopeGroups[gi].items, ''] })
  const removeScopeItem = (gi: number, ii: number) => updateScope(gi, { items: data.scopeGroups[gi].items.filter((_, idx) => idx !== ii) })

  const updatePricing = (i: number, patch: Partial<PricingRow>) =>
    set('pricingRows', data.pricingRows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addPricing = () => set('pricingRows', [...data.pricingRows, { service: '', detail: '', frequency: '', days: '', rate: 'POA' }])
  const removePricing = (i: number) => set('pricingRows', data.pricingRows.filter((_, idx) => idx !== i))

  const updateService = (i: number, val: string) => set('additionalServices', data.additionalServices.map((s, idx) => idx === i ? val : s))
  const addService = () => set('additionalServices', [...data.additionalServices, ''])
  const removeService = (i: number) => set('additionalServices', data.additionalServices.filter((_, idx) => idx !== i))

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col -m-4 lg:-m-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/documents" className="text-gray-400 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{data.clientName || 'Untitled proposal'}</p>
            <p className="text-[11px] text-gray-400">{data.refNumber} · Proposal</p>
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors">
            <Send className="w-3.5 h-3.5" /> Send
          </button>
          <button onClick={() => { setConverting(true); convertToAgreementAction(id) }} disabled={converting}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#1e3a5f] hover:bg-[#162d4a] text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-60">
            {converting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePen className="w-3.5 h-3.5" />} Convert to agreement
          </button>
        </div>
      </div>
      {showSend && <SendProposalModal id={id} onClose={() => setShowSend(false)} />}

      {/* Two-pane */}
      <div className="flex-1 flex min-h-0">
        {/* Form */}
        <div className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-5">
          <Section title="Client & cover">
            <Field label="Client name" value={data.clientName} onChange={v => set('clientName', v)} />
            <Field label="Site address" value={data.siteAddress} onChange={v => set('siteAddress', v)} />
            <Field label="Attention (contact)" value={data.attention} onChange={v => set('attention', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reference" value={data.refNumber} onChange={v => set('refNumber', v)} />
              <Field label="Date of issue" value={data.issueDate} onChange={v => set('issueDate', v)} placeholder="14 May 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date" value={data.startDate} onChange={v => set('startDate', v)} placeholder="1 July 2026" />
              <Field label="Valid for" value={data.validity} onChange={v => set('validity', v)} />
            </div>
            <Field label="Frequency" value={data.frequency} onChange={v => set('frequency', v)} />
            <Field label="Monthly investment" value={data.monthlyInvestment} onChange={v => set('monthlyInvestment', v)} placeholder="$5,400 / month" />
          </Section>

          <Section title="Pricing table">
            {data.pricingRows.map((r, i) => (
              <div key={i} className="rounded-lg border border-gray-150 bg-gray-50 p-2.5 space-y-2 relative">
                <button onClick={() => removePricing(i)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                <input value={r.service} onChange={e => updatePricing(i, { service: e.target.value })} placeholder="Service" className={inputCls} />
                <input value={r.detail} onChange={e => updatePricing(i, { detail: e.target.value })} placeholder="Detail line" className={inputCls} />
                <div className="grid grid-cols-3 gap-2">
                  <input value={r.frequency} onChange={e => updatePricing(i, { frequency: e.target.value })} placeholder="Frequency" className={inputCls} />
                  <input value={r.days} onChange={e => updatePricing(i, { days: e.target.value })} placeholder="Days" className={inputCls} />
                  <input value={r.rate} onChange={e => updatePricing(i, { rate: e.target.value })} placeholder="Rate" className={inputCls} />
                </div>
              </div>
            ))}
            <button onClick={addPricing} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] hover:underline"><Plus className="w-3.5 h-3.5" /> Add row</button>
          </Section>

          <Section title="Scope of services">
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

          <Section title="Additional services (on request)">
            {data.additionalServices.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input value={s} onChange={e => updateService(i, e.target.value)} placeholder="Service" className={inputCls} />
                <button onClick={() => removeService(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={addService} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] hover:underline"><Plus className="w-3.5 h-3.5" /> Add service</button>
          </Section>

          <Section title="Delta contact">
            <Field label="Name" value={data.contactName} onChange={v => set('contactName', v)} />
            <Field label="Role" value={data.contactRole} onChange={v => set('contactRole', v)} />
            <Field label="Phone" value={data.contactPhone} onChange={v => set('contactPhone', v)} />
            <Field label="Email" value={data.contactEmail} onChange={v => set('contactEmail', v)} />
          </Section>
        </div>

        {/* Live preview */}
        <div ref={previewWrap} className="flex-1 overflow-auto bg-[#E6E8EB] p-4">
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: 794, margin: '0 auto' }}>
            <ProposalDocument data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}
