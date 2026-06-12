'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, TrendingUp, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { LeadForm } from '@/components/leads/LeadForm'
import { createLeadAction } from '@/actions/leads'
import { formatDate, formatAUD } from '@/lib/formatters'
import type { Lead } from '@/types/app'

const STAGES = [
  { key: 'lead',           label: 'New',            color: 'bg-slate-500' },
  { key: 'contacted',      label: 'Contacted',      color: 'bg-blue-600' },
  { key: 'quoted',         label: 'Quoted',         color: 'bg-amber-600' },
  { key: 'proposal_sent',  label: 'Proposal Sent',  color: 'bg-purple-600' },
  { key: 'agreement_sent', label: 'Agreement Sent', color: 'bg-indigo-600' },
]

const STATUS_LABELS: Record<string, string> = {
  lead:           'New Lead',
  contacted:      'Contacted',
  quoted:         'Quoted',
  proposal_sent:  'Proposal Sent',
  agreement_sent: 'Agreement Sent',
  won:            'Won',
  lost:           'Lost',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')

  async function loadLeads() {
    setLoading(true)
    try {
      const res = await fetch('/api/leads')
      if (res.ok) setLeads(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLeads() }, [])

  async function handleAdd(formData: FormData) {
    setAddError(null)
    const result = await createLeadAction(formData) as any
    if (result?.error) { setAddError(result.error); return }
    setShowAdd(false)
    await loadLeads()
  }

  const activeLeads   = leads.filter(l => l.status !== 'won' && l.status !== 'lost')
  const quotedValue   = leads.filter(l => l.status === 'quoted').reduce((s, l) => s + (l.quote_value || 0), 0)
  const wonLeads      = leads.filter(l => l.status === 'won')
  const conversionPct = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : null

  const filtered = leads.filter(l => {
    const matchSearch = !search
      || l.business_name.toLowerCase().includes(search.toLowerCase())
      || Boolean(l.contact_name?.toLowerCase().includes(search.toLowerCase()))
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? (l.status !== 'won' && l.status !== 'lost')
        : l.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pipeline</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeLeads.length} active · {wonLeads.length} won
          </p>
        </div>
        <Button onClick={() => { setAddError(null); setShowAdd(true) }}>
          <Plus className="w-4 h-4" /> New Lead
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'In Pipeline',  value: String(activeLeads.length), sub: 'active leads' },
          { label: 'Quoted Value', value: quotedValue > 0 ? formatAUD(quotedValue) : '—', sub: `${leads.filter(l => l.status === 'quoted').length} quoted` },
          { label: 'Won Total',    value: String(wonLeads.length), sub: 'all time' },
          { label: 'Conversion',   value: conversionPct != null ? `${conversionPct}%` : '—', sub: `${wonLeads.length} of ${leads.length}` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 transition-all duration-200 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#1e3a5f]/15" />
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em]">{kpi.label}</p>
            <p className="font-display text-[26px] font-extrabold text-gray-900 mt-2 tabular-nums tracking-tight">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline stage bars */}
      <div className="grid grid-cols-5 gap-2">
        {STAGES.map(stage => {
          const count = leads.filter(l => l.status === stage.key).length
          const isSelected = statusFilter === stage.key
          return (
            <button
              key={stage.key}
              onClick={() => setStatusFilter(isSelected ? 'active' : stage.key)}
              className={`rounded-xl p-3 text-left border transition-all duration-150 ${
                isSelected
                  ? 'border-[#1e3a5f] bg-[#1e3a5f] shadow-[0_4px_12px_rgba(30,58,95,0.3)]'
                  : 'border-gray-200/70 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <p className={`text-xs font-medium ${isSelected ? 'text-sky-200' : 'text-gray-500'}`}>{stage.label}</p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${isSelected ? 'text-white' : 'text-gray-900'}`}>{count}</p>
              <div
                className={`h-1 rounded-full mt-2 ${count > 0 ? stage.color : 'bg-gray-200'}`}
                style={{ width: `${Math.min(100, count * 20)}%` }}
              />
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2">
          {[
            { v: 'active', l: 'Active' },
            { v: 'all',    l: 'All' },
            { v: 'won',    l: 'Won' },
            { v: 'lost',   l: 'Lost' },
          ].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                statusFilter === v
                  ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                  : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No leads found</p>
            <button
              onClick={() => { setAddError(null); setShowAdd(true) }}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Add your first lead →
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Business</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 hidden sm:table-cell">Contact</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 hidden md:table-cell">Value</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 hidden lg:table-cell">Last Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {lead.business_name}
                    </Link>
                    {lead.suburb && (
                      <p className="text-xs text-gray-400">{lead.suburb}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <p className="text-sm text-gray-800">{lead.contact_name || '—'}</p>
                    <p className="text-xs text-gray-400">{lead.contact_email || ''}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge status={lead.status} label={STATUS_LABELS[lead.status] ?? lead.status} />
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-sm text-gray-800 tabular-nums">
                      {lead.quote_value ? formatAUD(lead.quote_value) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-sm text-gray-500">
                      {lead.last_contact_date ? formatDate(lead.last_contact_date) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-xs text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showAdd} onOpenChange={o => { if (!o) setShowAdd(false) }} title="New Lead">
        {addError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {addError}
          </div>
        )}
        <LeadForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}
