'use client'

import { useEffect, useState } from 'react'

interface PnlMonth {
  label: string          // "Sep 2026"
  income: number
  subcontractor: number  // Cost of Sales = the Four Seasons subbie
  grossProfit: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

// Parse a "MMM yyyy" Xero column label into a sortable timestamp.
const labelTime = (label: string) => {
  const t = Date.parse(`1 ${label}`)
  return Number.isFinite(t) ? t : 0
}

export function SubcontractorCostCard() {
  const [months, setMonths]       = useState<PnlMonth[] | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/xero/data?type=subcontractor')
      .then(r => {
        if (r.status === 401) { setConnected(false); return null }
        setConnected(true)
        return r.json()
      })
      .then(data => { if (data) setMonths(Array.isArray(data) ? data : []) })
      .catch(() => setConnected(false))
  }, [])

  // Not connected → the Xero widget below already shows a connect prompt.
  if (connected === false) return null
  if (connected === null || months === null) {
    return <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
  }

  const ordered = [...months]
    .filter(m => m.income || m.subcontractor)
    .sort((a, b) => labelTime(b.label) - labelTime(a.label))

  if (ordered.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-900">Real profit — after Four Seasons</p>
        <p className="text-xs text-gray-400 mt-1">No income or subcontractor figures in Xero yet.</p>
      </div>
    )
  }

  const latest = ordered[0]
  const margin = latest.income > 0 ? (latest.grossProfit / latest.income) * 100 : 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#13b5ea]" />
          <p className="text-sm font-semibold text-gray-900">Real profit — after Four Seasons</p>
        </div>
        <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
          Live from Xero · {latest.label}
        </span>
      </div>

      {/* Income − subcontractor = gross profit */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Income</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{fmt(latest.income)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Four Seasons</p>
          <p className="text-lg font-bold text-orange-600 tabular-nums">−{fmt(latest.subcontractor)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Real profit</p>
          <p className={`text-lg font-bold tabular-nums ${latest.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmt(latest.grossProfit)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{margin.toFixed(0)}% margin</p>
        </div>
      </div>

      {/* Recent months */}
      <div className="border-t border-gray-100">
        <div className="grid grid-cols-4 px-5 pt-3 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <span>Month</span>
          <span className="text-right">Income</span>
          <span className="text-right">Four Seasons</span>
          <span className="text-right">Profit</span>
        </div>
        <div className="divide-y divide-gray-50">
          {ordered.slice(0, 6).map(m => (
            <div key={m.label} className="grid grid-cols-4 px-5 py-2 text-sm tabular-nums">
              <span className="text-gray-700">{m.label}</span>
              <span className="text-right text-gray-700">{fmt(m.income)}</span>
              <span className="text-right text-orange-600">−{fmt(m.subcontractor)}</span>
              <span className={`text-right font-semibold ${m.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {fmt(m.grossProfit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">
        Income minus the Four Seasons subcontractor (Xero Cost of Sales), straight from your Xero P&amp;L.
        Overheads are excluded on purpose — this is the profit figure you trust.
      </p>
    </div>
  )
}
