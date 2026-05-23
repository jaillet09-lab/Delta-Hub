import { createClient } from '@/lib/supabase/server'

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
  fromDate: string
  toDate: string
  revenue: number
  expenses: number
  netProfit: number
}

export interface XeroInvoice {
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

export interface XeroBill {
  invoiceId: string
  invoiceNumber: string
  contact: string
  amountDue: number
  total: number
  dueDate: string | null
  date: string | null
  status: string
}

export interface XeroBankAccount {
  accountId: string
  name: string
  balance: number
  currencyCode: string
}

// ─── Token management ─────────────────────────────────────────────────────────

export async function getXeroTokens(): Promise<XeroTokens | null> {
  const supabase = createClient()
  const { data, error } = await (supabase as any)
    .from('xero_tokens')
    .select('*')
    .single()

  if (error || !data) return null

  const row = data as XeroTokenRow
  const expiresAt = new Date(row.expires_at)
  const now = new Date()
  const secondsUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000

  // Auto-refresh if within 5 minutes of expiry
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

    const supabase = createClient()
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

export async function xeroFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const tokens = await getXeroTokens()
  if (!tokens) {
    throw new Error('Xero not connected — no valid tokens found')
  }

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

// ─── P&L Report ───────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function getXeroPL(months = 3): Promise<XeroPLPeriod[]> {
  const now = new Date()
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0) // end of current month
  const fromDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1) // start of N months ago

  const params = new URLSearchParams({
    fromDate: formatDate(fromDate),
    toDate: formatDate(toDate),
    timeframe: 'MONTH',
    periods: String(months),
  })

  const res = await xeroFetch(`/Reports/ProfitAndLoss?${params}`)
  if (!res.ok) {
    throw new Error(`Xero P&L fetch failed: ${res.status} ${await res.text()}`)
  }

  const json = await res.json()
  const report = json?.Reports?.[0]
  if (!report) return []

  // Parse column headers to get period dates
  const columns: Array<{ value: string }> = report.Rows?.[0]?.Cells ?? []
  const periodCount = Math.max(0, columns.length - 1) // first col is label

  // Walk rows to extract Income and Expenses totals
  const periods: XeroPLPeriod[] = Array.from({ length: periodCount }, (_, i) => ({
    fromDate: '',
    toDate: '',
    revenue: 0,
    expenses: 0,
    netProfit: 0,
  }))

  // Set period labels from header row
  const headerRow = report.Rows?.find((r: any) => r.RowType === 'Header')
  if (headerRow) {
    headerRow.Cells?.slice(1).forEach((cell: any, i: number) => {
      if (periods[i]) periods[i].fromDate = cell.Value ?? ''
    })
  }

  function extractSectionTotals(rows: any[], sectionTitle: string): number[] {
    const totals: number[] = Array(periodCount).fill(0)
    for (const row of rows) {
      if (row.RowType === 'Section' && row.Title === sectionTitle) {
        const summaryRow = row.Rows?.find((r: any) => r.RowType === 'SummaryRow')
        if (summaryRow) {
          summaryRow.Cells?.slice(1).forEach((cell: any, i: number) => {
            totals[i] = parseFloat(cell.Value ?? '0') || 0
          })
        }
        break
      }
    }
    return totals
  }

  const allRows: any[] = report.Rows ?? []
  const revenues = extractSectionTotals(allRows, 'Income')
  const expenses = extractSectionTotals(allRows, 'Less Operating Expenses')

  // Also try alternate section names
  const altExpenses = extractSectionTotals(allRows, 'Expenses')
  const finalExpenses = expenses.map((v, i) => v || altExpenses[i])

  periods.forEach((p, i) => {
    p.revenue = revenues[i] ?? 0
    p.expenses = finalExpenses[i] ?? 0
    p.netProfit = p.revenue - p.expenses
  })

  return periods
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function getXeroInvoices(status = 'AUTHORISED,PAID'): Promise<XeroInvoice[]> {
  const params = new URLSearchParams({
    where: 'Type=="ACCREC"',
    order: 'DueDate DESC',
    page: '1',
  })

  // Append status filter if provided
  if (status) {
    params.set('Statuses', status)
  }

  const res = await xeroFetch(`/Invoices?${params}`)
  if (!res.ok) {
    throw new Error(`Xero invoices fetch failed: ${res.status}`)
  }

  const json = await res.json()
  const invoices: any[] = json?.Invoices ?? []

  return invoices.slice(0, 20).map((inv: any) => ({
    invoiceId: inv.InvoiceID,
    invoiceNumber: inv.InvoiceNumber ?? '',
    contact: inv.Contact?.Name ?? 'Unknown',
    amountDue: inv.AmountDue ?? 0,
    amountPaid: inv.AmountPaid ?? 0,
    total: inv.Total ?? 0,
    dueDate: inv.DueDateString ?? null,
    date: inv.DateString ?? null,
    status: inv.Status ?? 'UNKNOWN',
  }))
}

// ─── Bills (Accounts Payable) ─────────────────────────────────────────────────

export async function getXeroBills(): Promise<XeroBill[]> {
  const params = new URLSearchParams({
    where: 'Type=="ACCPAY"',
    order: 'DueDate DESC',
    Statuses: 'AUTHORISED,PAID',
    page: '1',
  })

  const res = await xeroFetch(`/Invoices?${params}`)
  if (!res.ok) {
    throw new Error(`Xero bills fetch failed: ${res.status}`)
  }

  const json = await res.json()
  const bills: any[] = json?.Invoices ?? []

  return bills.slice(0, 20).map((bill: any) => ({
    invoiceId: bill.InvoiceID,
    invoiceNumber: bill.InvoiceNumber ?? '',
    contact: bill.Contact?.Name ?? 'Unknown',
    amountDue: bill.AmountDue ?? 0,
    total: bill.Total ?? 0,
    dueDate: bill.DueDateString ?? null,
    date: bill.DateString ?? null,
    status: bill.Status ?? 'UNKNOWN',
  }))
}

// ─── Bank summary ─────────────────────────────────────────────────────────────

export async function getXeroBankSummary(): Promise<XeroBankAccount[]> {
  const res = await xeroFetch('/Accounts?where=Type=="BANK"&includeArchived=false')
  if (!res.ok) {
    throw new Error(`Xero accounts fetch failed: ${res.status}`)
  }

  const json = await res.json()
  const accounts: any[] = json?.Accounts ?? []

  return accounts.map((acc: any) => ({
    accountId: acc.AccountID,
    name: acc.Name ?? 'Unknown Account',
    balance: acc.ReportingCodeUpdatedDateUTC ? 0 : (acc.Balance ?? 0),
    currencyCode: acc.CurrencyCode ?? 'AUD',
  }))
}
