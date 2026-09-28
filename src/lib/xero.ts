import { createAdminClient } from '@/lib/supabase/admin'

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const TOKEN_REFRESH_BUFFER_SECONDS = 300 // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface XeroTokenRow {
  id: string
  tenant_id: string
  tenant_name: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  created_at: string
  updated_at: string
}

export interface XeroTokens {
  tenantId: string
  tenantName: string | null
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface XeroPLPeriod {
  label: string      // e.g. "Mar 2026"
  fromDate: string
  toDate: string
  revenue: number
  expenses: number
  netProfit: number
}

export interface XeroTransaction {
  id: string
  type: 'INCOME' | 'EXPENSE'
  contact: string
  description: string
  amount: number
  date: string | null
  dueDate: string | null
  status: string
  invoiceNumber: string
}

export interface XeroBankAccount {
  accountId: string
  name: string
  balance: number
  currencyCode: string
}

// ─── Token management ─────────────────────────────────────────────────────────

export async function getXeroTokens(): Promise<XeroTokens | null> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('xero_tokens')
    .select('*')
    .single()

  if (error || !data) return null

  const row = data as XeroTokenRow
  const expiresAt = new Date(row.expires_at)
  const now = new Date()
  const secondsUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000

  if (secondsUntilExpiry < TOKEN_REFRESH_BUFFER_SECONDS) {
    return refreshXeroTokens(row)
  }

  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt,
  }
}

async function refreshXeroTokens(row: XeroTokenRow): Promise<XeroTokens | null> {
  const clientId = process.env.XERO_CLIENT_ID!
  const clientSecret = process.env.XERO_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const res = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
      }),
    })

    if (!res.ok) {
      console.error('Xero token refresh failed:', res.status, await res.text())
      return null
    }

    const tokenData = await res.json()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    const supabase = createAdminClient()
    await (supabase as any)
      .from('xero_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? row.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    return {
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? row.refresh_token,
      expiresAt,
    }
  } catch (err) {
    console.error('Xero token refresh error:', err)
    return null
  }
}

// ─── Authenticated fetch ───────────────────────────────────────────────────────

export async function xeroFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const tokens = await getXeroTokens()
  if (!tokens) throw new Error('Xero not connected — no valid tokens found')

  const url = path.startsWith('http') ? path : `${XERO_API_BASE}${path}`

  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Xero-Tenant-Id': tokens.tenantId,
      'Accept': 'application/json',
      ...(options.headers ?? {}),
    },
  })
}

// ─── All transactions (invoices + bills) for approval review ──────────────────

export async function getXeroAllTransactions(): Promise<XeroTransaction[]> {
  const [incomeRes, expenseRes] = await Promise.all([
    xeroFetch('/Invoices?where=Type%3D%3D%22ACCREC%22&Statuses=AUTHORISED,PAID&order=Date+DESC&page=1'),
    xeroFetch('/Invoices?where=Type%3D%3D%22ACCPAY%22&Statuses=AUTHORISED,PAID&order=Date+DESC&page=1'),
  ])

  const [incomeJson, expenseJson] = await Promise.all([
    incomeRes.ok ? incomeRes.json() : { Invoices: [] },
    expenseRes.ok ? expenseRes.json() : { Invoices: [] },
  ])

  const income: XeroTransaction[] = (incomeJson.Invoices ?? []).map((inv: any) => ({
    id: inv.InvoiceID,
    type: 'INCOME' as const,
    contact: inv.Contact?.Name ?? 'Unknown',
    description: inv.Reference ?? inv.InvoiceNumber ?? '',
    amount: inv.Total ?? 0,
    date: inv.DateString ?? null,
    dueDate: inv.DueDateString ?? null,
    status: inv.Status ?? '',
    invoiceNumber: inv.InvoiceNumber ?? '',
  }))

  const expenses: XeroTransaction[] = (expenseJson.Invoices ?? []).map((inv: any) => ({
    id: inv.InvoiceID,
    type: 'EXPENSE' as const,
    contact: inv.Contact?.Name ?? 'Unknown',
    description: inv.Reference ?? inv.InvoiceNumber ?? '',
    amount: inv.Total ?? 0,
    date: inv.DateString ?? null,
    dueDate: inv.DueDateString ?? null,
    status: inv.Status ?? '',
    invoiceNumber: inv.InvoiceNumber ?? '',
  }))

  return [...income, ...expenses].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '')
  )
}

// ─── Subcontractor bills (the monthly Four Seasons / subbie invoice) ───────────

// The subcontractor invoices land in Xero under this supplier name (the owner
// calls them "Four Seasons"; Xero records them as "Seasons Cleaning Australia").
// Override with settings key `subcontractor_supplier` if the name ever changes.
export const DEFAULT_SUBCONTRACTOR_MATCH = 'seasons cleaning'

export interface XeroSubBill {
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

export async function getSubcontractorBills(match?: string): Promise<XeroSubBill[]> {
  let needle = (match || '').trim().toLowerCase()
  if (!needle) {
    // Allow the owner to configure the supplier name without a code change.
    try {
      const supabase = createAdminClient()
      const { data } = await (supabase as any)
        .from('settings').select('value').eq('key', 'subcontractor_supplier').maybeSingle()
      const v = data?.value
      needle = (typeof v === 'string' ? v : '').trim().toLowerCase()
    } catch { /* fall through to default */ }
  }
  if (!needle) needle = DEFAULT_SUBCONTRACTOR_MATCH

  // Most recent 100 payable bills (page 1, newest first) — covers recent months.
  const res = await xeroFetch('/Invoices?where=Type%3D%3D%22ACCPAY%22&Statuses=AUTHORISED,PAID&order=Date+DESC&page=1')
  if (!res.ok) throw new Error(`Xero bills fetch failed: ${res.status}`)

  const json = await res.json()
  return (json.Invoices ?? [])
    .filter((inv: any) => (inv.Contact?.Name ?? '').toLowerCase().includes(needle))
    .map((inv: any): XeroSubBill => ({
      id: inv.InvoiceID,
      invoiceNumber: inv.InvoiceNumber ?? '',
      contact: inv.Contact?.Name ?? '',
      amount: inv.Total ?? 0,
      amountDue: inv.AmountDue ?? 0,
      date: inv.DateString ?? null,
      dueDate: inv.DueDateString ?? null,
      status: inv.Status ?? '',
      paid: inv.Status === 'PAID' || ((inv.AmountDue ?? 0) === 0 && (inv.Total ?? 0) > 0),
    }))
}

// ─── P&L derived from approved transactions only ──────────────────────────────

export async function getApprovedPL(months = 3): Promise<XeroPLPeriod[]> {
  const supabase = createAdminClient()

  // Get all approved transaction IDs
  const { data: approved } = await (supabase as any)
    .from('xero_approved_transactions')
    .select('xero_id, type, amount, date')

  if (!approved || approved.length === 0) return []

  // Build month buckets for the last N months
  const now = new Date()
  const periods: XeroPLPeriod[] = []

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const label = start.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })

    const inPeriod = approved.filter((t: any) => {
      if (!t.date) return false
      const d = new Date(t.date)
      return d >= start && d <= end
    })

    const revenue  = inPeriod.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + (t.amount ?? 0), 0)
    const expenses = inPeriod.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + (t.amount ?? 0), 0)

    periods.push({
      label,
      fromDate: start.toISOString().split('T')[0],
      toDate:   end.toISOString().split('T')[0],
      revenue,
      expenses,
      netProfit: revenue - expenses,
    })
  }

  return periods
}

// ─── Bank summary ─────────────────────────────────────────────────────────────

export async function getXeroBankSummary(): Promise<XeroBankAccount[]> {
  const res = await xeroFetch('/Accounts?where=Type=="BANK"&includeArchived=false')
  if (!res.ok) throw new Error(`Xero accounts fetch failed: ${res.status}`)

  const json = await res.json()
  const accounts: any[] = json?.Accounts ?? []

  return accounts.map((acc: any) => ({
    accountId: acc.AccountID,
    name: acc.Name ?? 'Unknown Account',
    balance: acc.Balance ?? 0,
    currencyCode: acc.CurrencyCode ?? 'AUD',
  }))
}
