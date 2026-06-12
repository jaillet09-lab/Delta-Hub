'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight } from 'lucide-react'
import { formatAUD } from '@/lib/formatters'
import { monthLabel } from '@/lib/calendar'

export interface PLRow {
  id: string
  client_id: string
  client_name: string
  month: string              // "YYYY-MM-01"
  invoice_id: string | null  // null = projected (no invoice uploaded yet)
  service_count: number | null
  income_ex_gst: number | null
  rate_per_visit: number | null
  cleaner_hours: number | null
  cleaner_rate_per_hour: number | null
  cleaner_cost_ex_gst: number | null
  cleaner_gst: number | null
  cleaner_cost_incl_gst: number | null
  profit: number | null
  margin_pct: number | null
  expected_hours: number | null
  expected_cost_ex_gst: number | null
  hours_variance: number | null
  cost_variance: number | null
}

interface Props {
  rows: PLRow[]
  month?: string   // filter to specific month
  showClient?: boolean
}

function MarginPill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-gray-400 text-xs">—</span>
  const color = pct >= 55 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : pct >= 35 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-600 bg-red-50 border-red-200'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {pct.toFixed(0)}%
    </span>
  )
}

function VarianceCell({ variance, isHours }: { variance: number | null; isHours?: boolean }) {
  if (variance == null) return <span className="text-gray-400 text-xs">—</span>
  const abs = Math.abs(variance)
  const over = variance > 0
  const display = isHours ? `${variance > 0 ? '+' : ''}${variance.toFixed(1)}h` : `${variance > 0 ? '+' : '-'}${formatAUD(abs)}`
  const color = over ? 'text-red-600' : variance < 0 ? 'text-emerald-600' : 'text-gray-400'
  const Icon = over ? TrendingUp : variance < 0 ? TrendingDown : Minus
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />{display}
    </span>
  )
}

export function MonthlyPLTable({ rows, month, showClient = true }: Props) {
  const filtered = month ? rows.filter(r => r.month === `${month}-01` || r.month.startsWith(month)) : rows

  if (filtered.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-gray-400">No P&L data yet</p>
        <p className="text-xs text-gray-400 mt-1">Upload a cleaner invoice to generate per-client P&L</p>
      </div>
    )
  }

  // Group by month
  const byMonth: Record<string, PLRow[]> = {}
  for (const r of filtered) {
    const key = r.month.substring(0, 7) // "YYYY-MM"
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(r)
  }
  const sortedMonths = Object.keys(byMonth).sort().reverse()

  return (
    <div className="space-y-6">
      {sortedMonths.map(mk => {
        const monthRows = byMonth[mk]
        const totalIncome   = monthRows.reduce((s, r) => s + (r.income_ex_gst ?? 0), 0)
        const totalCost     = monthRows.reduce((s, r) => s + (r.cleaner_cost_ex_gst ?? 0), 0)
        const totalProfit   = monthRows.reduce((s, r) => s + (r.profit ?? 0), 0)
        const totalMargin   = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : null

        return (
          <div key={mk} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Month header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">{monthLabel(mk + '-01')}</p>
              <div className="flex items-center gap-5 text-xs">
                <span className="text-gray-500">Revenue <span className="text-gray-800 font-semibold ml-1 tabular-nums">{formatAUD(totalIncome)}</span></span>
                <span className="text-gray-500">Cost <span className="text-gray-800 font-semibold ml-1 tabular-nums">{formatAUD(totalCost)}</span></span>
                <span className="text-gray-500">Profit <span className={`font-bold ml-1 tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatAUD(totalProfit)}</span></span>
                <MarginPill pct={totalMargin} />
              </div>
            </div>

            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200/50">
                  {showClient && <th className="text-left text-xs text-gray-400 font-medium px-5 py-2">Client</th>}
                  <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Visits</th>
                  <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Revenue</th>
                  <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Hours</th>
                  <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Cleaner Cost</th>
                  <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Profit</th>
                  <th className="text-center text-xs text-gray-400 font-medium px-4 py-2">Margin</th>
                  <th className="text-center text-xs text-gray-400 font-medium px-4 py-2">Hr Variance</th>
                  <th className="text-center text-xs text-gray-400 font-medium px-4 py-2">Cost Variance</th>
                  {showClient && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                    {showClient && (
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-800">{row.client_name}</p>
                        {row.rate_per_visit && (
                          <p className="text-xs text-gray-400">{formatAUD(row.rate_per_visit)}/visit</p>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">{row.service_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-800 tabular-nums">{row.income_ex_gst != null ? formatAUD(row.income_ex_gst) : '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">
                      {row.cleaner_hours != null ? `${row.cleaner_hours}h` : '—'}
                      {row.cleaner_rate_per_hour && (
                        <span className="text-xs text-gray-400 block">{formatAUD(row.cleaner_rate_per_hour)}/hr</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 tabular-nums">{row.cleaner_cost_ex_gst != null ? formatAUD(row.cleaner_cost_ex_gst) : '—'}</td>
                    <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${(row.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.profit != null ? formatAUD(row.profit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center"><MarginPill pct={row.margin_pct} /></td>
                    <td className="px-4 py-3 text-center"><VarianceCell variance={row.hours_variance} isHours /></td>
                    <td className="px-4 py-3 text-center"><VarianceCell variance={row.cost_variance} /></td>
                    {showClient && (
                      <td className="px-3 py-3">
                        <Link href={`/clients/${row.client_id}`}
                          className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
