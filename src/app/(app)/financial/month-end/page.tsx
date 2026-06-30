export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatAUD } from '@/lib/formatters'
import { monthLabel } from '@/lib/calendar'
import { PrintButton } from '@/components/financial/PrintButton'
import { ArrowLeft } from 'lucide-react'

function nextMonth(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

export default async function MonthEndReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createClient() as any

  // Available months (most recent first)
  const { data: monthsRaw } = await supabase
    .from('client_monthly_financials').select('month').order('month', { ascending: false })
  const months: string[] = Array.from(new Set((monthsRaw ?? []).map((r: any) => r.month)))

  const requested = searchParams.month ? `${searchParams.month}-01`.slice(0, 10) : null
  const month = (requested && months.includes(requested)) ? requested : (months[0] ?? null)

  if (!month) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <p className="text-gray-500">No financial data yet — upload invoices on the Financial page to build month-end reports.</p>
        <Link href="/financial" className="text-[#1e3a5f] text-sm font-semibold mt-3 inline-block">← Back to Financial</Link>
      </div>
    )
  }

  const mStart = month
  const mEnd = nextMonth(month)

  // Per-client financials for the month
  const { data: rowsRaw } = await supabase
    .from('client_monthly_financials')
    .select('client_id, income_ex_gst, cleaner_cost_ex_gst, cleaner_hours, profit, margin_pct, service_count, invoice_id, clients(business_name)')
    .eq('month', month)
  const rows = (rowsRaw ?? []) as any[]

  // Jobs actually completed in the month (from submissions)
  const { count: jobsDone } = await supabase
    .from('job_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('completed_at', mStart + 'T00:00:00')
    .lt('completed_at', mEnd + 'T00:00:00')

  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const income = sum('income_ex_gst')
  const cost   = sum('cleaner_cost_ex_gst')
  const profit = sum('profit')
  const hours  = sum('cleaner_hours')
  const visits = sum('service_count')
  const margin = income > 0 ? (profit / income) * 100 : null
  const anyProjected = rows.some((r) => !r.invoice_id)

  const byIncome = [...rows].sort((a, b) => (Number(b.income_ex_gst) || 0) - (Number(a.income_ex_gst) || 0))
  const label = monthLabel(month)

  const KPI = ({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: string }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm relative overflow-hidden p-4">
      {accent && <div className={`absolute top-0 left-0 w-full h-0.5 ${accent}`} />}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{k}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{v}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <style>{`@media print { nav, aside, header, .no-print { display: none !important; } body { background: #fff; } }`}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 no-print">
        <Link href="/financial" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Financial
        </Link>
        <PrintButton />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Month-End Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">{label}{anyProjected ? ' · includes projected estimates' : ''}</p>
        </div>
      </div>

      {/* Month picker */}
      {months.length > 1 && (
        <div className="flex flex-wrap gap-1.5 no-print">
          {months.slice(0, 12).map((m) => (
            <Link key={m} href={`/financial/month-end?month=${m.slice(0, 7)}`}
              className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${
                m === month ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {monthLabel(m)}
            </Link>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI k="Revenue (ex GST)" v={formatAUD(income)} accent="bg-blue-500" />
        <KPI k="Labour cost" v={formatAUD(cost)} accent="bg-red-400" />
        <KPI k="Profit" v={formatAUD(profit)} accent={profit >= 0 ? 'bg-emerald-500' : 'bg-red-400'} />
        <KPI k="Gross margin" v={margin != null ? `${margin.toFixed(0)}%` : '—'}
          accent={margin == null ? undefined : margin >= 55 ? 'bg-emerald-500' : margin >= 35 ? 'bg-amber-500' : 'bg-red-400'} />
        <KPI k="Clients billed" v={String(rows.length)} sub={`${visits} visits`} />
        <KPI k="Jobs completed" v={String(jobsDone ?? 0)} sub={`${hours || 0} cleaner hrs`} />
      </div>

      {/* Per-client breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">By client · {label}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="pb-2 pr-4 font-medium">Client</th>
                <th className="pb-2 pr-4 font-medium text-right">Visits</th>
                <th className="pb-2 pr-4 font-medium text-right">Revenue</th>
                <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                <th className="pb-2 pr-4 font-medium text-right">Profit</th>
                <th className="pb-2 font-medium text-center">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byIncome.map((r) => {
                const m = r.margin_pct != null ? Number(r.margin_pct) : null
                const mColor = m == null ? 'text-gray-400' : m >= 55 ? 'text-emerald-600' : m >= 35 ? 'text-amber-600' : 'text-red-600'
                const pColor = (Number(r.profit) || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                return (
                  <tr key={r.client_id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">
                      {r.clients?.business_name ?? '—'}
                      {!r.invoice_id && <span className="ml-1.5 text-[10px] text-gray-300">est.</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">{r.service_count ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-800 tabular-nums font-medium">{r.income_ex_gst != null ? formatAUD(r.income_ex_gst) : '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">{r.cleaner_cost_ex_gst != null ? formatAUD(r.cleaner_cost_ex_gst) : '—'}</td>
                    <td className={`py-2.5 pr-4 text-right tabular-nums font-semibold ${pColor}`}>{r.profit != null ? formatAUD(r.profit) : '—'}</td>
                    <td className="py-2.5 text-center"><span className={`text-xs font-semibold ${mColor}`}>{m != null ? `${m.toFixed(0)}%` : '—'}</span></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                <td className="py-2.5 pr-4">Total</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{visits}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{formatAUD(income)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{formatAUD(cost)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{formatAUD(profit)}</td>
                <td className="py-2.5 text-center text-xs">{margin != null ? `${margin.toFixed(0)}%` : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        Delta Cleaning · generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} · figures exclude GST
      </p>
    </div>
  )
}
