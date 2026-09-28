'use client'

import { useEffect, useState } from 'react'

interface SubBill {
  id: string
  invoiceNumber: string
  contact: string
  amount: number
  amountDue: number
  date: string | null
  dueDate: string | null
  status: string
  paid: boolean
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

const dueLabel = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''

interface MonthGroup { key: string; total: number; due: number; bills: SubBill[] }

export function SubcontractorCostCard({ mrr }: { mrr: number }) {
  const [bills, setBills]         = useState<SubBill[] | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/xero/data?type=subcontractor')
      .then(r => {
        if (r.status === 401) { setConnected(false); return null }
        setConnected(true)
        return r.json()
      })
      .then(data => { if (data) setBills(Array.isArray(data) ? data : []) })
      .catch(() => setConnected(false))
  }, [])

  // Not connected → the Xero widget below already shows a connect prompt.
  if (connected === false) return null

  if (connected === null || bills === null) {
    return <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
  }

  // Group bills by calendar month
  const groups = new Map<string, MonthGroup>()
  for (const b of bills) {
    if (!b.date) continue
    const key = b.date.slice(0, 7) // YYYY-MM
    const g = groups.get(key) ?? { key, total: 0, due: 0, bills: [] }
    g.total += b.amount
    g.due   += b.amountDue
    g.bills.push(b)
    groups.set(key, g)
  }
  const ordered = Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key))

  if (ordered.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-900">Subcontractor cost — Four Seasons</p>
        <p className="text-xs text-gray-400 mt-1">No Four Seasons bills found in Xero yet.</p>
      </div>
    )
  }

  const currentKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }).slice(0, 7)
  const current = groups.get(currentKey)
  const shown   = current ?? ordered[0]        // this month, else the latest we have
  const cost    = shown.total
  const net     = mrr - cost
  const unpaid  = shown.due
  const earliestDue = shown.bills
    .filter(b => b.amountDue > 0 && b.dueDate)
    .map(b => b.dueDate!)
    .sort()[0] ?? null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#13b5ea]" />
          <p className="text-sm font-semibold text-gray-900">Subcontractor cost — Four Seasons</p>
        </div>
        <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
          Live from Xero
        </span>
      </div>

      {/* Income − subcontractor = net */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Income (MRR)</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{fmt(mrr)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
            Four Seasons · {monthLabel(shown.key)}
          </p>
          <p className="text-lg font-bold text-orange-600 tabular-nums">−{fmt(cost)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">After subcontractor</p>
          <p className={`text-lg font-bold tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmt(net)}
          </p>
        </div>
      </div>

      {unpaid > 0 && (
        <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
          <span className="text-xs font-medium text-amber-700">
            Unpaid · {fmt(unpaid)} outstanding{earliestDue ? ` · due ${dueLabel(earliestDue)}` : ''}
          </span>
        </div>
      )}

      {/* Recent months */}
      <div className="border-t border-gray-100">
        <p className="px-5 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recent months</p>
        <div className="divide-y divide-gray-50">
          {ordered.slice(0, 6).map(g => {
            const paid = g.due === 0
            return (
              <div key={g.key} className="flex items-center justify-between px-5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${paid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-sm text-gray-700">{monthLabel(g.key)}</span>
                  <span className="text-[10px] text-gray-400">
                    {g.bills.length} bill{g.bills.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-800 tabular-nums">{fmt(g.total)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {paid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">
        Your only tracked business cost — pulled live from Xero. Income is your contracted monthly revenue.
      </p>
    </div>
  )
}
