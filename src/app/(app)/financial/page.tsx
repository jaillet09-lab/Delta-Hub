'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatAUD, formatDate } from '@/lib/formatters'
import { monthLabel } from '@/lib/calendar'
import { deleteInvoiceAction, saveRecurringExpenseAction, saveExpenseAction, generateExpectedMonthAction, reprocessAllInvoicesAction, reprocessProjectedMonthsAction } from '@/actions/invoices'
import { deleteFinancialRecordAction } from '@/actions/financial'
import { InvoiceUploadModal } from '@/components/financial/InvoiceUploadModal'
import { MonthlyPLTable, type PLRow } from '@/components/financial/MonthlyPLTable'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import {
  Upload, Receipt, DollarSign, BarChart3, TrendingUp,
  Plus, Trash2, RefreshCw, AlertCircle,
} from 'lucide-react'
import type { Client } from '@/types/app'

const TABS = [
  { id: 'overview', label: 'Overview',  icon: BarChart3 },
  { id: 'pl',       label: 'P&L',       icon: TrendingUp },
  { id: 'invoices', label: 'Invoices',  icon: Upload },
  { id: 'expenses', label: 'Expenses',  icon: Receipt },
] as const
type Tab = typeof TABS[number]['id']

const RECURRING_OPTIONS = [
  'Insurance', 'Google Workspace', 'Xero', 'Phone', 'Fuel', 'Admin', 'Marketing', 'Other',
]

function KPITile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden p-5">
      {accent && <div className={`absolute top-0 left-0 w-full h-0.5 ${accent}`} />}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-2">{sub}</p>}
    </div>
  )
}

// Custom tooltip for the trend chart
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-xl text-xs">
      <p className="text-gray-700 font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 mb-1">
          <span className="flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-gray-900 tabular-nums">{formatAUD(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── main page ──────────────────────────────────────────────────────────── */

export default function FinancialPage() {
  const [tab,         setTab]         = useState<Tab>('overview')
  const [clients,     setClients]     = useState<Client[]>([])
  const [invoices,    setInvoices]    = useState<any[]>([])
  const [plRows,      setPlRows]      = useState<PLRow[]>([])
  const [expenses,    setExpenses]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showUpload,   setShowUpload]   = useState(false)
  const [showExpense,  setShowExpense]  = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)

  async function load(autoGenerate = false) {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    try {
      const [cRes, invRes, plRes, expRes] = await Promise.all([
        supabase.from('clients').select('*').order('business_name'),
        (supabase as any).from('invoices').select('*, invoice_line_items(*)').order('billing_month', { ascending: false }),
        (supabase as any).from('client_monthly_financials').select('*, clients(business_name)').order('month', { ascending: false }),
        (supabase as any).from('financial_records').select('*').eq('type', 'expense').order('record_date', { ascending: false }),
      ])
      setClients(cRes.data || [])
      setInvoices(invRes.data || [])

      const rows = (plRes.data || []).map((r: any) => ({
        ...r,
        client_name: r.clients?.business_name ?? 'Unknown',
      }))
      setPlRows(rows)
      setExpenses(expRes.data || [])

      // Auto-generate expected P&L for current month if no data exists yet
      const now2 = new Date()
      const ck = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`
      const hasThisMonth = rows.some((r: any) => r.month?.startsWith(ck))
      if (!hasThisMonth && !autoGenerate) {
        // Generate expected rows from client rates, then reload once
        await generateExpectedMonthAction(ck)
        load(true)
        return
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  /* ── derived numbers ─────────────────────────────────────────────────────── */
  const activeClients = clients.filter(c => c.active)
  const mrr = activeClients.reduce((s, c) => s + (c.monthly_value || 0), 0)

  // Current calendar month
  const now = new Date()
  const currentMk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const latestMonth = plRows[0]?.month?.substring(0, 7) ?? null
  const latestRows  = latestMonth ? plRows.filter(r => r.month?.startsWith(latestMonth)) : []
  const latestRevenue = latestRows.reduce((s, r) => s + (r.income_ex_gst ?? 0), 0)
  const latestCost    = latestRows.reduce((s, r) => s + (r.cleaner_cost_ex_gst ?? 0), 0)
  const latestProfit  = latestRows.reduce((s, r) => s + (r.profit ?? 0), 0)
  const latestMargin  = latestRevenue > 0 ? (latestProfit / latestRevenue) * 100 : null

  // Has the current month's invoice been uploaded (real data)?
  // invoice_id being null means it's auto-generated projected data
  const hasCurrentMonthInvoice = plRows.some(r => r.month?.startsWith(currentMk) && r.invoice_id != null)

  // Current month rows (projected or real)
  const currentRows = plRows.filter(r => r.month?.startsWith(currentMk))
  const currentRevenue = currentRows.reduce((s, r) => s + (r.income_ex_gst ?? 0), 0)
  const currentCost    = currentRows.reduce((s, r) => s + (r.cleaner_cost_ex_gst ?? 0), 0)
  const currentProfit  = currentRows.reduce((s, r) => s + (r.profit ?? 0), 0)
  const currentMargin  = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : null

  const displayRevenue = currentRevenue > 0 ? currentRevenue : mrr
  const displayProfit  = currentRevenue > 0 ? currentProfit  : null
  const displayMargin  = currentRevenue > 0 ? currentMargin  : null
  const displayMonthName = monthLabel(currentMk + '-01')

  // Monthly expense total = recurring expenses (always included) + one-off expenses this month
  const monthlyExpenses = expenses
    .filter(e => {
      if (e.is_recurring) return true
      const d = new Date(e.record_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s: number, e: any) => s + e.amount, 0)

  const netProfit = (displayProfit ?? 0) - monthlyExpenses

  /* ── trend chart data ────────────────────────────────────────────────────── */
  const trendData = (() => {
    const byMonth: Record<string, { income: number; cost: number }> = {}
    for (const r of plRows) {
      const mk = r.month?.substring(0, 7)
      if (!mk) continue
      if (!byMonth[mk]) byMonth[mk] = { income: 0, cost: 0 }
      byMonth[mk].income += r.income_ex_gst ?? 0
      byMonth[mk].cost   += r.cleaner_cost_ex_gst ?? 0
    }
    // Ensure current month always appears (data should be in DB now via auto-generate)
    if (!byMonth[currentMk]) byMonth[currentMk] = { income: mrr, cost: 0 }
    // Add expenses per month
    const expByMonth: Record<string, number> = {}
    for (const e of expenses) {
      const mk = e.record_date?.substring(0, 7)
      if (!mk) continue
      expByMonth[mk] = (expByMonth[mk] ?? 0) + e.amount
    }
    // Merge, sort ascending
    const allMonths = Array.from(new Set([...Object.keys(byMonth), ...Object.keys(expByMonth)])).sort()
    return allMonths.map(mk => ({
      month: monthLabel(mk + '-01'),
      Income:         Math.round((byMonth[mk]?.income ?? 0) * 100) / 100,
      'Cleaner Cost': Math.round((byMonth[mk]?.cost ?? 0) * 100) / 100,
      Expenses:       Math.round((expByMonth[mk] ?? 0) * 100) / 100,
    }))
  })()

  /* ── handlers ───────────────────────────────────────────────────────────── */
  async function handleDeleteInvoice(id: string) {
    if (!confirm('Delete this invoice and its P&L data?')) return
    const res = await deleteInvoiceAction(id) as any
    if (res?.error) setError(res.error)
    else load()
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    await deleteFinancialRecordAction(id)
    load()
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPITile
          label="Active Clients"
          value={String(activeClients.length)}
          sub={`MRR ${formatAUD(mrr)}`}
        />
        <KPITile
          label={`${displayMonthName} Revenue`}
          value={formatAUD(displayRevenue)}
          sub={hasCurrentMonthInvoice ? 'from uploaded invoice' : '★ projected from client rates'}
          accent="bg-blue-500"
        />
        <KPITile
          label={`${displayMonthName} Profit`}
          value={displayProfit != null ? formatAUD(displayProfit) : '—'}
          sub={displayProfit != null
            ? (monthlyExpenses > 0 ? `Net ${formatAUD(netProfit)} after expenses` : (hasCurrentMonthInvoice ? undefined : '★ projected'))
            : 'Upload invoice to calculate'}
          accent={displayProfit == null ? undefined : displayProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
        />
        <KPITile
          label="Gross Margin"
          value={displayMargin != null ? `${displayMargin.toFixed(0)}%` : '—'}
          sub={displayMargin != null
            ? (hasCurrentMonthInvoice
                ? (displayMargin >= 55 ? 'Healthy ✓' : displayMargin >= 35 ? 'Watch' : 'Below target')
                : '★ projected estimate')
            : 'Upload invoice to calculate'}
          accent={displayMargin == null ? undefined : displayMargin >= 55 ? 'bg-emerald-500' : displayMargin >= 35 ? 'bg-amber-500' : 'bg-red-500'}
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-0">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-5">

              {/* Trend chart */}
              {trendData.length >= 2 ? (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Revenue Trend</p>
                  <p className="text-xs text-gray-500 mb-5">Income · Cleaner Cost · Expenses by month</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Income"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#3b82f6' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Cleaner Cost"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#f97316' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={{ r: 3, fill: '#ef4444' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : trendData.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">No invoice data yet</p>
                  <p className="text-xs text-gray-500 mt-1">Upload your cleaner's invoice to see accurate P&L</p>
                  <Button className="mt-4" onClick={() => { setTab('invoices'); setShowUpload(true) }}>
                    <Upload className="w-4 h-4" /> Upload First Invoice
                  </Button>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <p className="text-xs text-gray-500 text-center">Upload more invoices to see the trend chart (need at least 2 months)</p>
                </div>
              )}

              {/* Latest month P&L table */}
              {latestRows.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {latestMonth ? monthLabel(latestMonth + '-01') : 'Latest Month'} — Client P&L
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Calendar-accurate</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setTab('pl')}>
                      View all months →
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <MonthlyPLTable rows={latestRows} showClient />
                  </div>
                </div>
              )}

              {/* Contract revenue breakdown */}
              {activeClients.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">Contract Revenue</p>
                    <p className="text-xs text-gray-500 mt-0.5">Based on contracted rates</p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-2">Client</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">Rate/Visit</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">Frequency</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">MRR</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">ARR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeClients.sort((a, b) => (b.monthly_value || 0) - (a.monthly_value || 0)).map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-gray-800">{c.business_name}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 tabular-nums">{c.rate_per_visit ? formatAUD(c.rate_per_visit) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500 capitalize">{c.frequency?.replace('_', '-') ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-800 tabular-nums">{c.monthly_value ? formatAUD(c.monthly_value) : '—'}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-500 tabular-nums">{c.annual_value ? formatAUD(c.annual_value) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 text-sm font-semibold text-gray-800">Total</td>
                        <td colSpan={2} />
                        <td className="px-4 py-3 text-right text-sm font-bold text-blue-600 tabular-nums">{formatAUD(mrr)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-500 tabular-nums">{formatAUD(mrr * 12)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── P&L TAB ───────────────────────────────────────────────────── */}
          {tab === 'pl' && (
            <div>
              {plRows.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
                  <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">No P&L data yet</p>
                  <p className="text-xs text-gray-500 mt-1">Upload an invoice to generate per-client P&L</p>
                  <Button className="mt-4" onClick={() => { setTab('invoices'); setShowUpload(true) }}>
                    <Upload className="w-4 h-4" /> Upload Invoice
                  </Button>
                </div>
              ) : (
                <MonthlyPLTable rows={plRows} showClient />
              )}
            </div>
          )}

          {/* ── INVOICES TAB ──────────────────────────────────────────────── */}
          {tab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} uploaded</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setRecalculating(true)
                      // Fix real invoice rows + projected (no-invoice) rows in parallel
                      await Promise.all([
                        reprocessAllInvoicesAction(),
                        reprocessProjectedMonthsAction(),
                      ])
                      await load()
                      setRecalculating(false)
                    }}
                    disabled={recalculating}
                    title="Recalculate all P&L rows (invoices + projected months)"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
                    {recalculating ? 'Recalculating…' : 'Recalculate P&L'}
                  </button>
                  <Button onClick={() => setShowUpload(true)}>
                    <Upload className="w-4 h-4" /> Upload Invoice
                  </Button>
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">No invoices yet</p>
                  <p className="text-xs text-gray-500 mt-1">Upload your cleaner's PDF invoice to automatically calculate P&L per client</p>
                  <Button className="mt-4" onClick={() => setShowUpload(true)}>
                    <Upload className="w-4 h-4" /> Upload First Invoice
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv: any) => {
                    const lines: any[] = inv.invoice_line_items || []
                    const matched = lines.filter((l: any) => l.client_id).length
                    return (
                      <div key={inv.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {inv.invoice_number ?? 'Invoice'} — {monthLabel(inv.billing_month)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {inv.invoice_date ? formatDate(inv.invoice_date) : 'No date'} ·{' '}
                              {matched}/{lines.length} lines matched ·{' '}
                              <span className={`capitalize ${inv.status === 'processed' ? 'text-emerald-400' : 'text-amber-400'}`}>{inv.status}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            {inv.total_ex_gst && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Invoice Total</p>
                                <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatAUD(inv.total_ex_gst)}</p>
                              </div>
                            )}
                            <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {lines.length > 0 && (
                          <table className="w-full">
                            <tbody className="divide-y divide-gray-100">
                              {lines.map((line: any) => {
                                const client = clients.find(c => c.id === line.client_id)
                                return (
                                  <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-2.5">
                                      <p className="text-sm text-gray-700">{line.client_name_raw ?? `Line ${line.line_number}`}</p>
                                      {client
                                        ? <p className="text-xs text-emerald-400 mt-0.5">→ {client.business_name}</p>
                                        : <p className="text-xs text-amber-400 mt-0.5">Unmatched</p>
                                      }
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-xs text-gray-500">{line.hours ? `${line.hours}h` : '—'}</td>
                                    <td className="px-4 py-2.5 text-right text-xs text-gray-500">{line.rate_per_hour ? `${formatAUD(line.rate_per_hour)}/hr` : '—'}</td>
                                    <td className="px-4 py-2.5 text-right text-sm text-gray-700 tabular-nums">{line.cost_ex_gst ? formatAUD(line.cost_ex_gst) : '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── EXPENSES TAB ─────────────────────────────────────────────── */}
          {tab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Business expenses — one-off or recurring monthly</p>
                  <p className="text-xs text-gray-500 mt-0.5">Monthly total: {formatAUD(monthlyExpenses)}</p>
                </div>
                <Button onClick={() => setShowExpense(true)}>
                  <Plus className="w-4 h-4" /> Add Expense
                </Button>
              </div>

              {expenses.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
                  <Receipt className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No expenses yet</p>
                  <p className="text-xs text-gray-500 mt-1">Add Insurance, Xero, Google Workspace etc.</p>
                  <Button className="mt-4" onClick={() => setShowExpense(true)}>
                    <Plus className="w-4 h-4" /> Add Expense
                  </Button>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-2.5">Description</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Category</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Date</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Amount</th>
                        <th className="w-10 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expenses.map((exp: any) => (
                        <tr key={exp.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-800">{exp.description ?? exp.category}</span>
                              {exp.is_recurring && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">
                                  Monthly
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{exp.category}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">
                            {exp.is_recurring ? '—' : formatDate(exp.record_date)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-red-400 tabular-nums">{formatAUD(exp.amount)}</td>
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 rounded text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 text-sm font-semibold text-gray-800">Monthly total</td>
                        <td colSpan={2} />
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-400 tabular-nums">{formatAUD(monthlyExpenses)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <InvoiceUploadModal
        open={showUpload}
        onOpenChange={setShowUpload}
        clients={clients}
        onSuccess={load}
      />

      <Modal open={showExpense} onOpenChange={setShowExpense} title="Add Recurring Expense">
        <AddExpenseForm onClose={() => { setShowExpense(false); load() }} />
      </Modal>
    </div>
  )
}

/* ─── Simple expense form ────────────────────────────────────────────────── */

function AddExpenseForm({ onClose }: { onClose: () => void }) {
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const cls = 'w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('is_recurring', String(isRecurring))
    // Recurring expenses don't need a specific date — use today as a reference
    if (isRecurring && !fd.get('record_date')) {
      fd.set('record_date', new Date().toISOString().split('T')[0])
    }
    const res = await saveExpenseAction(fd) as any
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {/* Recurring toggle */}
      <button
        type="button"
        onClick={() => setIsRecurring(p => !p)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
          isRecurring
            ? 'border-blue-500/40 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}
      >
        <div className="text-left">
          <p className="text-sm font-medium">Recurring monthly</p>
          <p className="text-xs mt-0.5 opacity-70">
            {isRecurring ? 'Counted every month automatically' : 'One-off expense on a specific date'}
          </p>
        </div>
        <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${isRecurring ? 'bg-blue-500' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isRecurring ? 'left-5' : 'left-0.5'}`} />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Amount ($) *</label>
          <input name="amount" type="number" step="0.01" min="0" required placeholder="0.00" className={cls} />
        </div>
        {!isRecurring && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Date *</label>
            <input name="record_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className={cls} />
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1.5">Category *</label>
        <select name="category" required className={cls + ' cursor-pointer'}>
          <option value="">Select…</option>
          {RECURRING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1.5">Description</label>
        <input name="description" placeholder="e.g. QBE Business Insurance" className={cls} />
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Saving…' : 'Add Expense'}</Button>
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
      </div>
    </form>
  )
}
