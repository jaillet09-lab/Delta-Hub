'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLPeriod {
  fromDate: string
  toDate: string
  revenue: number
  expenses: number
  netProfit: number
}

interface Invoice {
  invoiceId: string
  invoiceNumber: string
  contact: string
  amountDue: number
  amountPaid: number
  total: number
  dueDate: string | null
  date: string | null
  status: string
}

interface BankAccount {
  accountId: string
  name: string
  balance: number
  currencyCode: string
}

interface Bill {
  invoiceId: string
  invoiceNumber: string
  contact: string
  amountDue: number
  total: number
  dueDate: string | null
  date: string | null
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function trendArrow(current: number, prior: number) {
  if (prior === 0) return null
  const pct = ((current - prior) / Math.abs(prior)) * 100
  const positive = pct >= 0
  return {
    pct: Math.abs(pct).toFixed(0),
    up: positive,
    label: `${positive ? '+' : '-'}${Math.abs(pct).toFixed(0)}% vs prior`,
  }
}

function monthLabel(dateStr: string): string {
  if (!dateStr) return ''
  try {
    // dateStr could be "2024-01-01" or "January 2024" etc.
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
  } catch {
    return dateStr
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PLCard({
  label,
  current,
  prior,
  accent,
}: {
  label: string
  current: number
  prior: number | null
  accent: string
}) {
  const trend = prior != null ? trendArrow(current, prior) : null
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>{formatAUD(current)}</p>
      {trend && (
        <p className={`text-xs font-medium ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.label}
        </p>
      )}
    </div>
  )
}

function InvoiceBadge({ status, dueDate }: { status: string; dueDate: string | null }) {
  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        Paid
      </span>
    )
  }
  if (isOverdue(dueDate)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
        Overdue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
      Pending
    </span>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function XeroFinanceWidget() {
  const searchParams = useSearchParams()

  const [connected, setConnected] = useState<boolean | null>(null) // null = loading
  const [tenantName, setTenantName] = useState<string | null>(null)

  const [pl, setPL] = useState<PLPeriod[] | null>(null)
  const [plLoading, setPlLoading] = useState(false)
  const [plError, setPlError] = useState<string | null>(null)

  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [invLoading, setInvLoading] = useState(false)

  const [bills, setBills] = useState<Bill[] | null>(null)
  const [billsLoading, setBillsLoading] = useState(false)

  const [bankAccounts, setBankAccounts] = useState<BankAccount[] | null>(null)
  const [bankLoading, setBankLoading] = useState(false)

  const [disconnecting, setDisconnecting] = useState(false)

  // ── Connection check via P&L probe ──────────────────────────────────────────
  const checkConnection = useCallback(async () => {
    setConnected(null)
    setPlLoading(true)
    setPlError(null)
    try {
      const res = await fetch('/api/xero/data?type=pl&months=3')
      if (res.status === 401) {
        setConnected(false)
        setPlLoading(false)
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.error === 'xero_not_connected') {
          setConnected(false)
          setPlLoading(false)
          return
        }
        setPlError('Failed to load P&L data')
        setConnected(true)
        setPlLoading(false)
        return
      }
      const json = await res.json()
      setConnected(true)
      setPL(json.data ?? [])
    } catch {
      setConnected(false)
    } finally {
      setPlLoading(false)
    }
  }, [])

  const loadInvoices = useCallback(async () => {
    setInvLoading(true)
    try {
      const res = await fetch('/api/xero/data?type=invoices')
      if (!res.ok) return
      const json = await res.json()
      setInvoices(json.data ?? [])
    } finally {
      setInvLoading(false)
    }
  }, [])

  const loadBills = useCallback(async () => {
    setBillsLoading(true)
    try {
      const res = await fetch('/api/xero/data?type=bills')
      if (!res.ok) return
      const json = await res.json()
      setBills(json.data ?? [])
    } finally {
      setBillsLoading(false)
    }
  }, [])

  const loadBank = useCallback(async () => {
    setBankLoading(true)
    try {
      const res = await fetch('/api/xero/data?type=summary')
      if (!res.ok) return
      const json = await res.json()
      setBankAccounts(json.data ?? [])
    } finally {
      setBankLoading(false)
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  // Eagerly load all data when connected
  useEffect(() => {
    if (connected) {
      loadInvoices()
      loadBills()
      loadBank()
    }
  }, [connected, loadInvoices, loadBills, loadBank])

  // Also check for URL params (post-OAuth redirect)
  useEffect(() => {
    const xeroParam = searchParams.get('xero')
    if (xeroParam === 'connected') {
      checkConnection()
    }
  }, [searchParams, checkConnection])

  async function handleDisconnect() {
    if (!confirm('Disconnect Xero? You can reconnect at any time.')) return
    setDisconnecting(true)
    try {
      await fetch('/api/xero/disconnect', { method: 'POST' })
      setConnected(false)
      setPL(null)
      setInvoices(null)
      setBills(null)
      setBankAccounts(null)
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Top expense categories derived from bills ──────────────────────────────
  const expenseCategories: Array<{ name: string; amount: number }> = (() => {
    if (!bills) return []
    const map = new Map<string, number>()
    for (const b of bills) {
      map.set(b.contact, (map.get(b.contact) ?? 0) + b.total)
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  })()

  const maxExpense = expenseCategories[0]?.amount ?? 1

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Xero logo mark */}
          <div className="w-8 h-8 rounded-lg bg-[#1ab4d7] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.243 13.914L8.1 13.257a.498.498 0 010-.706l2.657-2.657a.499.499 0 01.706.706L9.512 12.55l1.951 1.951a.499.499 0 01-.706.413zm4.394-2.656l-2.657 2.656a.499.499 0 01-.706-.706l1.951-1.951-1.951-1.951a.499.499 0 01.706-.706l2.657 2.657a.5.5 0 010 .001z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Xero Finance</p>
            {connected === true && tenantName && (
              <p className="text-xs text-gray-400">{tenantName}</p>
            )}
            {connected === true && !tenantName && (
              <p className="text-xs text-emerald-500 font-medium">Connected</p>
            )}
          </div>
        </div>

        {connected === true && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>

      {/* ── Not connected ──────────────────────────────────────────────────── */}
      {connected === false && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-300 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.243 13.914L8.1 13.257a.498.498 0 010-.706l2.657-2.657a.499.499 0 01.706.706L9.512 12.55l1.951 1.951a.499.499 0 01-.706.413zm4.394-2.656l-2.657 2.656a.499.499 0 01-.706-.706l1.951-1.951-1.951-1.951a.499.499 0 01.706-.706l2.657 2.657a.5.5 0 010 .001z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Connect your Xero account</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              View real-time P&amp;L, invoices, bills, and bank balances directly from your accounting software.
            </p>
          </div>
          <a
            href="/api/xero/connect"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#162d4a] transition-colors"
          >
            Connect Xero
          </a>
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────────────────── */}
      {connected === null && (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* ── Connected: dashboard ───────────────────────────────────────────── */}
      {connected === true && (
        <div className="space-y-5">

          {/* P&L summary */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Profit &amp; Loss — Last 3 Months
            </p>
            {plLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : plError ? (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-4 py-3 border border-red-100">{plError}</p>
            ) : pl && pl.length > 0 ? (
              <>
                {/* Period breakdown table */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Expenses</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pl.map((p, i) => (
                        <tr key={i} className={i === pl.length - 1 ? 'bg-gray-50' : ''}>
                          <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">
                            {p.fromDate ? monthLabel(p.fromDate) : `Month ${i + 1}`}
                          </td>
                          <td className="px-4 py-2.5 text-sm font-semibold text-gray-700 tabular-nums text-right">
                            {formatAUD(p.revenue)}
                          </td>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-500 tabular-nums text-right">
                            {formatAUD(p.expenses)}
                          </td>
                          <td className={`px-4 py-2.5 text-sm font-bold tabular-nums text-right ${
                            p.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {formatAUD(p.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* KPI cards for latest month */}
                {pl.length >= 1 && (() => {
                  const latest = pl[pl.length - 1]
                  const prior = pl.length >= 2 ? pl[pl.length - 2] : null
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <PLCard label="Revenue" current={latest.revenue} prior={prior?.revenue ?? null} accent="text-[#1e3a5f]" />
                      <PLCard label="Expenses" current={latest.expenses} prior={prior?.expenses ?? null} accent="text-gray-700" />
                      <PLCard
                        label="Net Profit"
                        current={latest.netProfit}
                        prior={prior?.netProfit ?? null}
                        accent={latest.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}
                      />
                    </div>
                  )
                })()}
              </>
            ) : (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3 border border-dashed border-gray-200">
                No P&amp;L data available for this period.
              </p>
            )}
          </div>

          {/* Invoices + Bank side-by-side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Recent invoices */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">Recent Invoices</p>
                <span className="text-xs text-gray-400">Last 5</span>
              </div>
              {invLoading ? (
                <div className="divide-y divide-gray-50">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : invoices && invoices.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {invoices.slice(0, 5).map(inv => (
                    <div key={inv.invoiceId} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{inv.contact}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {inv.dueDate ? `Due ${formatDate(inv.dueDate)}` : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-800 tabular-nums">
                          {formatAUD(inv.total)}
                        </span>
                        <InvoiceBadge status={inv.status} dueDate={inv.dueDate} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-xs text-gray-400">No invoices found.</p>
              )}
            </div>

            {/* Bank accounts */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Cash Position</p>
              </div>
              {bankLoading ? (
                <div className="divide-y divide-gray-50">
                  {[0, 1].map(i => (
                    <div key={i} className="px-4 py-4 flex items-center justify-between">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : bankAccounts && bankAccounts.length > 0 ? (
                <>
                  <div className="divide-y divide-gray-50">
                    {bankAccounts.map(acc => (
                      <div key={acc.accountId} className="px-4 py-3.5 flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-600 truncate">{acc.name}</p>
                        <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                          acc.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                        }`}>
                          {formatAUD(acc.balance)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {bankAccounts.length > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between">
                      <p className="text-xs font-semibold text-gray-500">Total</p>
                      <p className="text-sm font-bold tabular-nums text-[#1e3a5f]">
                        {formatAUD(bankAccounts.reduce((s, a) => s + a.balance, 0))}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="px-4 py-6 text-center text-xs text-gray-400">No bank accounts found.</p>
              )}
            </div>
          </div>

          {/* Top expense categories */}
          {(billsLoading || expenseCategories.length > 0) && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Top Expense Categories</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {billsLoading ? (
                  [0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))
                ) : expenseCategories.map((cat, i) => {
                  const widthPct = maxExpense > 0 ? (cat.amount / maxExpense) * 100 : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium truncate max-w-[60%]">{cat.name}</span>
                        <span className="text-gray-800 font-bold tabular-nums">{formatAUD(cat.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
