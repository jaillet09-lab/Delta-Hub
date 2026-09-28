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

// ─── Monthly P&L from Xero (Income − Cost of Sales = Gross Profit) ─────────────

// The owner's real profit is Income minus the subcontractor (Four Seasons), which
// Xero books to "Cost of Sales". Overhead expenses are excluded on purpose — the
// owner's bank/Xero mix personal spending, so Cost of Sales is the only cost he
// trusts. These figures come straight from Xero's own P&L report.

export interface XeroPnlMonth {
  label: string        // e.g. "Sep 2026"
  income: number       // Total Income (Sales)
  subcontractor: number // Total Cost of Sales (the Four Seasons subbie)
  grossProfit: number  // Income − Cost of Sales
}

export async function getPnlMonthly(months = 6): Promise<XeroPnlMonth[]> {
  const res = await xeroFetch(`/Reports/ProfitAndLoss?periods=${months}&timeframe=MONTH`)
  if (!res.ok) throw new Error(`Xero P&L fetch failed: ${res.status}`)

  const report = (await res.json())?.Reports?.[0]
  if (!report) return []

  const num = (s: any) => {
    const n = parseFloat(String(s ?? '').replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  let labels: string[] = []
  const series: Record<'income' | 'cogs' | 'gross', number[]> = { income: [], cogs: [], gross: [] }

  const walk = (rows: any[]) => {
    for (const row of rows ?? []) {
      if (row.RowType === 'Header' && Array.isArray(row.Cells)) {
        labels = row.Cells.slice(1).map((c: any) => String(c?.Value ?? '').trim())
      }
      if ((row.RowType === 'SummaryRow' || row.RowType === 'Row') && Array.isArray(row.Cells)) {
        const title = String(row.Cells[0]?.Value ?? '').trim().toLowerCase()
        const vals  = row.Cells.slice(1).map((c: any) => num(c?.Value))
        if (/^total (operating |trading )?income$/.test(title)) series.income = vals
        else if (title === 'total cost of sales') series.cogs = vals
        else if (title === 'gross profit') series.gross = vals
      }
      if (Array.isArray(row.Rows)) walk(row.Rows)
    }
  }
  walk(report.Rows)

  return labels.map((label, i) => {
    const income = series.income[i] ?? 0
    const cogs   = series.cogs[i]   ?? 0
    const gross  = series.gross[i]  ?? income - cogs
    return { label, income, subcontractor: cogs, grossProfit: gross }
  })
}

// Actual money paid to the Four Seasons subcontractor, per month — so the figure
// matches the invoices the owner pays (they pay by card; Xero records each as a
// SPEND bank transaction to the "Seasons Cleaning" contact). Keyed by "MMM yyyy"
// to line up with the P&L month labels. Configurable via settings.subcontractor_supplier.
export async function getSubcontractorSpend(months = 6): Promise<Record<string, number>> {
  let needle = 'season'
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('settings').select('value').eq('key', 'subcontractor_supplier').maybeSingle()
    const v = data?.value
    if (typeof v === 'string' && v.trim()) needle = v.trim().toLowerCase()
  } catch { /* keep default */ }

  const since = new Date()
  since.setMonth(since.getMonth() - (months + 1))
  const where = `Type=="SPEND" AND Date>=DateTime(${since.getFullYear()},${since.getMonth() + 1},1)`
  const order = 'Date DESC'

  const out: Record<string, number> = {}
  for (let page = 1; page <= 6; page++) {
    const res = await xeroFetch(`/BankTransactions?where=${encodeURIComponent(where)}&order=${encodeURIComponent(order)}&page=${page}`)
    if (!res.ok) break
    const txns: any[] = (await res.json())?.BankTransactions ?? []
    if (txns.length === 0) break
    for (const t of txns) {
      if (!(t.Contact?.Name ?? '').toLowerCase().includes(needle)) continue
      const ds = t.DateString || t.Date
      if (!ds) continue
      const label = new Date(ds).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      out[label] = (out[label] ?? 0) + (t.Total ?? 0)
    }
    if (txns.length < 100) break
  }
  return out
}

// Monthly P&L with the subcontractor line replaced by the actual Four Seasons
// spend (falls back to total Cost of Sales for any month with no matched spend).
export async function getSubcontractorPnl(months = 6): Promise<XeroPnlMonth[]> {
  const [pnl, spend] = await Promise.all([getPnlMonthly(months), getSubcontractorSpend(months)])
  return pnl.map((m) => {
    const fourSeasons = spend[m.label] ?? m.subcontractor
    return { label: m.label, income: m.income, subcontractor: fourSeasons, grossProfit: m.income - fourSeasons }
  })
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
