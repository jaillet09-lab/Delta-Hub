'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculateMonthlyVisits, monthKey, splitGST } from '@/lib/calendar'

// ─── Save confirmed invoice + lines ───────────────────────────────────────────

export interface ConfirmedLine {
  line_number: number
  description: string | null
  client_name_raw: string | null
  client_id: string | null          // null = unmatched
  hours: number | null
  rate_per_hour: number | null
  cost_ex_gst: number | null
  gst: number | null
  cost_incl_gst: number | null
  match_status: 'matched' | 'unmatched' | 'manual'
}

export interface SaveInvoiceInput {
  invoice_number: string | null
  invoice_date: string | null
  billing_month: string              // "YYYY-MM"
  lines: ConfirmedLine[]
  total_ex_gst: number | null
  total_gst: number | null
  total_incl_gst: number | null
  notes?: string | null
}

export async function saveInvoiceAction(input: SaveInvoiceInput) {
  const supabase = createClient()

  // billing_month → first-of-month date
  const billingMonthDate = `${input.billing_month}-01`
  const [yearStr, monthStr] = input.billing_month.split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)

  // ── 1. Create invoice record ──────────────────────────────────────────────
  const { data: invoice, error: invErr } = await (supabase as any)
    .from('invoices')
    .insert({
      invoice_number:  input.invoice_number,
      invoice_date:    input.invoice_date,
      billing_month:   billingMonthDate,
      total_ex_gst:    input.total_ex_gst,
      total_gst:       input.total_gst,
      total_incl_gst:  input.total_incl_gst,
      notes:           input.notes ?? null,
      status:          'processed',
    })
    .select()
    .single()

  if (invErr) return { error: invErr.message }

  // ── 2. Create line items ──────────────────────────────────────────────────
  const lineInserts = input.lines.map(l => ({
    invoice_id:      invoice.id,
    line_number:     l.line_number,
    description:     l.description,
    client_name_raw: l.client_name_raw,
    client_id:       l.client_id ?? null,
    hours:           l.hours,
    rate_per_hour:   l.rate_per_hour,
    cost_ex_gst:     l.cost_ex_gst,
    gst:             l.gst,
    cost_incl_gst:   l.cost_incl_gst,
    match_status:    l.match_status,
  }))

  const { error: lineErr } = await (supabase as any)
    .from('invoice_line_items')
    .insert(lineInserts)

  if (lineErr) return { error: lineErr.message }

  // ── 3. Fetch matched clients to calculate P&L ─────────────────────────────
  const matchedClientIds = Array.from(new Set(
    input.lines.filter(l => l.client_id).map(l => l.client_id!)
  ))

  if (matchedClientIds.length > 0) {
    const { data: clients } = await (supabase as any)
      .from('clients')
      .select('id, business_name, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
      .in('id', matchedClientIds)

    if (clients && clients.length > 0) {
      const plInserts = []

      for (const client of clients) {
        // Find the invoice line for this client
        const line = input.lines.find(l => l.client_id === client.id)
        if (!line) continue

        // Calendar-accurate revenue
        const startDate = client.start_date ? new Date(client.start_date) : new Date()
        const serviceDays: string[] = Array.isArray(client.service_days) ? client.service_days : []
        const ratePerVisit = client.rate_per_visit ?? 0

        const visits = calculateMonthlyVisits(year, month, client.frequency ?? 'monthly', serviceDays, startDate, ratePerVisit)

        // Costs (ex GST)
        const cleanerCostEx   = line.cost_ex_gst ?? 0
        const cleanerGST      = line.gst ?? 0
        const cleanerCostIncl = line.cost_incl_gst ?? 0

        // P&L
        const profit    = round(visits.income_ex_gst - cleanerCostEx)
        const marginPct = visits.income_ex_gst > 0
          ? round((profit / visits.income_ex_gst) * 100)
          : null

        // Variance vs expected (from client profile)
        const expectedHours   = (client.cleaner_hours_per_visit ?? null) !== null
          ? round((client.cleaner_hours_per_visit ?? 0) * visits.count)
          : null
        const expectedCostEx  = expectedHours !== null && client.cleaner_hourly_rate
          ? round(expectedHours * client.cleaner_hourly_rate)
          : null
        const hoursVariance   = line.hours != null && expectedHours != null
          ? round(line.hours - expectedHours)
          : null
        const costVariance    = expectedCostEx != null
          ? round(cleanerCostEx - expectedCostEx)
          : null

        plInserts.push({
          client_id:             client.id,
          month:                 billingMonthDate,
          invoice_id:            invoice.id,
          service_count:         visits.count,
          income_ex_gst:         visits.income_ex_gst,
          rate_per_visit:        ratePerVisit,
          cleaner_hours:         line.hours,
          cleaner_rate_per_hour: line.rate_per_hour,
          cleaner_cost_ex_gst:   cleanerCostEx,
          cleaner_gst:           cleanerGST,
          cleaner_cost_incl_gst: cleanerCostIncl,
          profit,
          margin_pct:            marginPct,
          expected_hours:        expectedHours,
          expected_cost_ex_gst:  expectedCostEx,
          hours_variance:        hoursVariance,
          cost_variance:         costVariance,
        })
      }

      if (plInserts.length > 0) {
        // Upsert: if same client+month already exists, replace it
        await (supabase as any)
          .from('client_monthly_financials')
          .upsert(plInserts, { onConflict: 'client_id,month' })
      }
    }
  }

  revalidatePath('/financial')
  revalidatePath('/clients')
  return { success: true, invoiceId: invoice.id }
}

// ─── Reprocess P&L for all saved invoices (fixes stale/broken records) ───────

export async function reprocessAllInvoicesAction() {
  const supabase = createClient()

  // Get all invoices with their matched line items + client data
  const { data: invoices } = await (supabase as any)
    .from('invoices')
    .select('id, billing_month')

  if (!invoices?.length) return { fixed: 0 }

  let totalFixed = 0

  for (const inv of invoices) {
    const billingMonthDate = inv.billing_month as string   // "YYYY-MM-01"
    const [yearStr, monthStr] = billingMonthDate.split('-')
    const year  = parseInt(yearStr)
    const month = parseInt(monthStr)

    // Get matched lines for this invoice
    const { data: lines } = await (supabase as any)
      .from('invoice_line_items')
      .select('client_id, hours, rate_per_hour, cost_ex_gst, gst, cost_incl_gst')
      .eq('invoice_id', inv.id)
      .not('client_id', 'is', null)

    if (!lines?.length) continue

    const clientIds = Array.from(new Set(lines.map((l: any) => l.client_id)))

    const { data: clients } = await (supabase as any)
      .from('clients')
      .select('id, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
      .in('id', clientIds)

    if (!clients?.length) continue

    const plUpdates = []

    for (const client of clients) {
      // Sum all lines for this client in this invoice
      const clientLines = lines.filter((l: any) => l.client_id === client.id)
      const totalHours      = clientLines.reduce((s: number, l: any) => s + (l.hours ?? 0), 0)
      const totalCostEx     = clientLines.reduce((s: number, l: any) => s + (l.cost_ex_gst ?? 0), 0)
      const totalGST        = clientLines.reduce((s: number, l: any) => s + (l.gst ?? 0), 0)
      const totalCostIncl   = clientLines.reduce((s: number, l: any) => s + (l.cost_incl_gst ?? 0), 0)
      const ratePerHour     = clientLines[0]?.rate_per_hour ?? null

      const startDate   = client.start_date ? new Date(client.start_date) : new Date()
      const serviceDays: string[] = Array.isArray(client.service_days) ? client.service_days : []
      const ratePerVisit = client.rate_per_visit ?? 0

      const visits = calculateMonthlyVisits(year, month, client.frequency ?? 'monthly', serviceDays, startDate, ratePerVisit)

      const profit    = round(visits.income_ex_gst - totalCostEx)
      const marginPct = visits.income_ex_gst > 0
        ? round((profit / visits.income_ex_gst) * 100)
        : null

      const expectedHours  = client.cleaner_hours_per_visit != null
        ? round((client.cleaner_hours_per_visit ?? 0) * visits.count)
        : null
      const expectedCostEx = expectedHours != null && client.cleaner_hourly_rate
        ? round(expectedHours * client.cleaner_hourly_rate)
        : null
      const hoursVariance  = totalHours > 0 && expectedHours != null
        ? round(totalHours - expectedHours)
        : null
      const costVariance   = expectedCostEx != null
        ? round(totalCostEx - expectedCostEx)
        : null

      plUpdates.push({
        client_id:             client.id,
        month:                 billingMonthDate,
        invoice_id:            inv.id,
        service_count:         visits.count,
        income_ex_gst:         visits.income_ex_gst,
        rate_per_visit:        ratePerVisit,
        cleaner_hours:         totalHours || null,
        cleaner_rate_per_hour: ratePerHour,
        cleaner_cost_ex_gst:   totalCostEx,
        cleaner_gst:           totalGST,
        cleaner_cost_incl_gst: totalCostIncl,
        profit,
        margin_pct:            marginPct,
        expected_hours:        expectedHours,
        expected_cost_ex_gst:  expectedCostEx,
        hours_variance:        hoursVariance,
        cost_variance:         costVariance,
      })
    }

    if (plUpdates.length > 0) {
      await (supabase as any)
        .from('client_monthly_financials')
        .upsert(plUpdates, { onConflict: 'client_id,month' })
      totalFixed += plUpdates.length
    }
  }

  revalidatePath('/financial')
  return { fixed: totalFixed }
}

// ─── Delete invoice + cascade ─────────────────────────────────────────────────

export async function deleteInvoiceAction(id: string) {
  const supabase = createClient()
  // Get the billing month first so we can clean up client_monthly_financials
  const { data: inv } = await (supabase as any)
    .from('invoices').select('billing_month').eq('id', id).single()

  const { error } = await (supabase as any).from('invoices').delete().eq('id', id)
  if (error) return { error: error.message }

  // Clean up orphaned monthly financials for this invoice
  if (inv?.billing_month) {
    await (supabase as any)
      .from('client_monthly_financials')
      .delete()
      .eq('invoice_id', id)
  }

  revalidatePath('/financial')
  return { success: true }
}

// ─── Update a single invoice line's client match ──────────────────────────────

export async function updateLineMatchAction(lineId: string, clientId: string | null) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('invoice_line_items')
    .update({
      client_id:    clientId,
      match_status: clientId ? 'manual' : 'unmatched',
    })
    .eq('id', lineId)

  if (error) return { error: error.message }
  revalidatePath('/financial')
  return { success: true }
}

// ─── Recurring expenses (simplified) ─────────────────────────────────────────

export async function saveExpenseAction(formData: FormData) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('financial_records')
    .insert({
      record_date:   formData.get('record_date') as string,
      amount:        parseFloat(formData.get('amount') as string),
      type:          'expense',
      category:      formData.get('category') as string,
      description:   formData.get('description') as string || null,
      is_recurring:  formData.get('is_recurring') === 'true',
    })

  if (error) return { error: error.message }
  revalidatePath('/financial')
  return { success: true }
}

// keep old name as alias so nothing else breaks
export const saveRecurringExpenseAction = saveExpenseAction

export async function deleteFinancialRecord(id: string) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('financial_records').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/financial')
  return { success: true }
}

// ─── Auto-generate expected P&L for current month from client rates ───────────
// Called automatically when no invoice has been uploaded for the current month.
// Uses the same calculateMonthlyVisits logic as real invoices so numbers match.
// invoice_id stays null → signals "projected, not yet confirmed by invoice".
// When a real invoice is uploaded, the upsert on (client_id, month) replaces these.

export async function generateExpectedMonthAction(monthStr: string) {
  // monthStr = 'YYYY-MM'
  const supabase = createClient()
  const [yearStr, mStr] = monthStr.split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(mStr)
  const billingMonthDate = `${monthStr}-01`

  // Only generate if no real invoice data exists for this month
  const { data: existing } = await (supabase as any)
    .from('client_monthly_financials')
    .select('invoice_id')
    .eq('month', billingMonthDate)
    .not('invoice_id', 'is', null)
    .limit(1)

  if (existing && existing.length > 0) {
    // Real invoice data exists — leave it alone
    return { skipped: true }
  }

  // Get all active clients
  const { data: clients, error: clientErr } = await (supabase as any)
    .from('clients')
    .select('id, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit, monthly_value')
    .eq('active', true)

  if (clientErr || !clients?.length) return { skipped: true }

  const rows = []
  for (const client of clients) {
    const startDate   = client.start_date ? new Date(client.start_date) : new Date()
    const serviceDays: string[] = Array.isArray(client.service_days) ? client.service_days : []
    const ratePerVisit = client.rate_per_visit ?? 0

    const visits = calculateMonthlyVisits(year, month, client.frequency ?? 'monthly', serviceDays, startDate, ratePerVisit)

    const expectedHours  = client.cleaner_hours_per_visit != null
      ? round(client.cleaner_hours_per_visit * visits.count)
      : null
    const expectedCostEx = expectedHours != null && client.cleaner_hourly_rate
      ? round(expectedHours * client.cleaner_hourly_rate)
      : null

    rows.push({
      client_id:            client.id,
      month:                billingMonthDate,
      invoice_id:           null,           // null = projected, not from real invoice
      service_count:        visits.count,
      income_ex_gst:        visits.income_ex_gst,
      rate_per_visit:       ratePerVisit,
      cleaner_cost_ex_gst:  expectedCostEx ?? 0,
      profit:               round(visits.income_ex_gst - (expectedCostEx ?? 0)),
      margin_pct:           visits.income_ex_gst > 0
        ? round(((visits.income_ex_gst - (expectedCostEx ?? 0)) / visits.income_ex_gst) * 100)
        : null,
      expected_hours:       expectedHours,
      expected_cost_ex_gst: expectedCostEx,
    })
  }

  if (rows.length > 0) {
    await (supabase as any)
      .from('client_monthly_financials')
      .upsert(rows, { onConflict: 'client_id,month' })
  }

  revalidatePath('/financial')
  return { generated: rows.length }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
