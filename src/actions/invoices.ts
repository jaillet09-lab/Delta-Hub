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

// ─── Income helpers ───────────────────────────────────────────────────────────

/**
 * Calculate income for a single-site client.
 * clampToMonth: if the client's start_date is after the billing month,
 * use the billing month start instead (invoice = proof of service that month).
 */
function calcSingleSiteIncome(
  client: any,
  year: number,
  month: number,
  clampToMonth = false,
): { income_ex_gst: number; count: number; rate_per_visit: number } {
  const billingMonthStart = new Date(year, month - 1, 1)
  const billingMonthEnd   = new Date(year, month, 0)           // last day of billing month
  const rawStart  = client.start_date ? new Date(client.start_date) : new Date()
  // Only clamp when the client's start_date is entirely in a FUTURE month vs the billing month.
  // If start_date is within or before the billing month, respect it as-is.
  const startDate = clampToMonth && rawStart > billingMonthEnd ? billingMonthStart : rawStart
  const serviceDays: string[] = Array.isArray(client.service_days) ? client.service_days : []
  const ratePerVisit = client.rate_per_visit ?? 0
  const v = calculateMonthlyVisits(year, month, client.frequency ?? 'monthly', serviceDays, startDate, ratePerVisit)
  return { income_ex_gst: v.income_ex_gst, count: v.count, rate_per_visit: ratePerVisit }
}

/**
 * Calculate income for a multi-site client by summing across all its sites.
 * Always clamps to billing month start (multi-site clients don't track start_date per site).
 */
function calcMultiSiteIncome(
  sites: any[],
  year: number,
  month: number,
  monthlyValueFallback: number,
): { income_ex_gst: number; count: number; rate_per_visit: number } {
  if (!sites || sites.length === 0) {
    return { income_ex_gst: monthlyValueFallback, count: 0, rate_per_visit: 0 }
  }
  const billingMonthStart = new Date(year, month - 1, 1)
  let totalIncome = 0
  let totalCount  = 0
  for (const site of sites) {
    const serviceDays: string[] = Array.isArray(site.service_days) ? site.service_days : []
    const v = calculateMonthlyVisits(
      year, month,
      site.frequency ?? 'monthly',
      serviceDays,
      billingMonthStart,
      site.rate_per_visit ?? 0,
    )
    totalIncome += v.income_ex_gst
    totalCount  += v.count
  }
  return { income_ex_gst: round(totalIncome), count: totalCount, rate_per_visit: 0 }
}

/** Fetch sites for a set of multi-site client IDs. Returns map: client_id → sites[] */
async function fetchSitesMap(supabase: any, clientIds: string[]): Promise<Record<string, any[]>> {
  if (!clientIds.length) return {}
  const { data: sites } = await supabase
    .from('client_sites')
    .select('client_id, rate_per_visit, frequency, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
    .in('client_id', clientIds)
  const map: Record<string, any[]> = {}
  for (const s of sites ?? []) {
    if (!map[s.client_id]) map[s.client_id] = []
    map[s.client_id].push(s)
  }
  return map
}

// ─── Save confirmed invoice + lines ──────────────────────────────────────────

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
      .select('id, business_name, is_multi_site, monthly_value, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
      .in('id', matchedClientIds)

    if (clients && clients.length > 0) {
      // Pre-fetch sites for any multi-site clients
      const multiSiteIds = clients.filter((c: any) => c.is_multi_site).map((c: any) => c.id as string)
      const sitesMap = await fetchSitesMap(supabase as any, multiSiteIds)

      const plInserts = []

      for (const client of clients) {
        // Find the invoice line for this client
        const line = input.lines.find(l => l.client_id === client.id)
        if (!line) continue

        // Income: sum across sites for multi-site, calendar visits for single-site
        const inc = client.is_multi_site
          ? calcMultiSiteIncome(sitesMap[client.id] ?? [], year, month, client.monthly_value ?? 0)
          : calcSingleSiteIncome(client, year, month, true /* clamp to billing month */)

        // Costs (ex GST)
        const cleanerCostEx   = line.cost_ex_gst ?? 0
        const cleanerGST      = line.gst ?? 0
        const cleanerCostIncl = line.cost_incl_gst ?? 0

        // P&L
        const profit    = round(inc.income_ex_gst - cleanerCostEx)
        const marginPct = inc.income_ex_gst > 0
          ? round((profit / inc.income_ex_gst) * 100)
          : null

        // Variance vs expected (from client profile)
        // For multi-site, aggregate expected across sites
        let expectedHours: number | null  = null
        let expectedCostEx: number | null = null
        if (client.is_multi_site) {
          const sites = sitesMap[client.id] ?? []
          if (sites.length > 0) {
            let eh = 0; let ec = 0; let hasData = false
            for (const site of sites) {
              const v = calculateMonthlyVisits(year, month, site.frequency ?? 'monthly',
                Array.isArray(site.service_days) ? site.service_days : [],
                new Date(year, month - 1, 1), site.rate_per_visit ?? 0)
              if (site.cleaner_hours_per_visit != null) {
                eh += round(site.cleaner_hours_per_visit * v.count)
                hasData = true
              }
              if (site.cleaner_hourly_rate && site.cleaner_hours_per_visit != null) {
                ec += round(site.cleaner_hours_per_visit * v.count * site.cleaner_hourly_rate)
              }
            }
            if (hasData) { expectedHours = round(eh); expectedCostEx = round(ec) }
          }
        } else {
          expectedHours  = client.cleaner_hours_per_visit != null
            ? round((client.cleaner_hours_per_visit ?? 0) * inc.count)
            : null
          expectedCostEx = expectedHours !== null && client.cleaner_hourly_rate
            ? round(expectedHours * client.cleaner_hourly_rate)
            : null
        }

        const hoursVariance = line.hours != null && expectedHours != null
          ? round(line.hours - expectedHours)
          : null
        const costVariance  = expectedCostEx != null
          ? round(cleanerCostEx - expectedCostEx)
          : null

        plInserts.push({
          client_id:             client.id,
          month:                 billingMonthDate,
          invoice_id:            invoice.id,
          service_count:         inc.count,
          income_ex_gst:         inc.income_ex_gst,
          rate_per_visit:        inc.rate_per_visit,
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

    const { data: lines } = await (supabase as any)
      .from('invoice_line_items')
      .select('client_id, hours, rate_per_hour, cost_ex_gst, gst, cost_incl_gst')
      .eq('invoice_id', inv.id)
      .not('client_id', 'is', null)

    if (!lines?.length) continue

    const clientIds = Array.from(new Set(lines.map((l: any) => l.client_id as string)))

    const { data: clients } = await (supabase as any)
      .from('clients')
      .select('id, is_multi_site, monthly_value, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
      .in('id', clientIds)

    if (!clients?.length) continue

    // Pre-fetch sites for multi-site clients
    const multiSiteIds = clients.filter((c: any) => c.is_multi_site).map((c: any) => c.id as string)
    const sitesMap = await fetchSitesMap(supabase as any, multiSiteIds)

    const plUpdates = []

    for (const client of clients) {
      const clientLines   = lines.filter((l: any) => l.client_id === client.id)
      const totalHours    = clientLines.reduce((s: number, l: any) => s + (l.hours ?? 0), 0)
      const totalCostEx   = clientLines.reduce((s: number, l: any) => s + (l.cost_ex_gst ?? 0), 0)
      const totalGST      = clientLines.reduce((s: number, l: any) => s + (l.gst ?? 0), 0)
      const totalCostIncl = clientLines.reduce((s: number, l: any) => s + (l.cost_incl_gst ?? 0), 0)
      const ratePerHour   = clientLines[0]?.rate_per_hour ?? null

      const inc = client.is_multi_site
        ? calcMultiSiteIncome(sitesMap[client.id] ?? [], year, month, client.monthly_value ?? 0)
        : calcSingleSiteIncome(client, year, month, true)

      const profit    = round(inc.income_ex_gst - totalCostEx)
      const marginPct = inc.income_ex_gst > 0
        ? round((profit / inc.income_ex_gst) * 100)
        : null

      let expectedHours: number | null  = null
      let expectedCostEx: number | null = null
      if (client.is_multi_site) {
        const sites = sitesMap[client.id] ?? []
        if (sites.length > 0) {
          let eh = 0; let ec = 0; let hasData = false
          for (const site of sites) {
            const v = calculateMonthlyVisits(year, month, site.frequency ?? 'monthly',
              Array.isArray(site.service_days) ? site.service_days : [],
              new Date(year, month - 1, 1), site.rate_per_visit ?? 0)
            if (site.cleaner_hours_per_visit != null) {
              eh += round(site.cleaner_hours_per_visit * v.count); hasData = true
            }
            if (site.cleaner_hourly_rate && site.cleaner_hours_per_visit != null) {
              ec += round(site.cleaner_hours_per_visit * v.count * site.cleaner_hourly_rate)
            }
          }
          if (hasData) { expectedHours = round(eh); expectedCostEx = round(ec) }
        }
      } else {
        expectedHours  = client.cleaner_hours_per_visit != null
          ? round((client.cleaner_hours_per_visit ?? 0) * inc.count)
          : null
        expectedCostEx = expectedHours != null && client.cleaner_hourly_rate
          ? round(expectedHours * client.cleaner_hourly_rate)
          : null
      }

      const hoursVariance = totalHours > 0 && expectedHours != null
        ? round(totalHours - expectedHours)
        : null
      const costVariance  = expectedCostEx != null
        ? round(totalCostEx - expectedCostEx)
        : null

      plUpdates.push({
        client_id:             client.id,
        month:                 billingMonthDate,
        invoice_id:            inv.id,
        service_count:         inc.count,
        income_ex_gst:         inc.income_ex_gst,
        rate_per_visit:        inc.rate_per_visit,
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
  const { data: inv } = await (supabase as any)
    .from('invoices').select('billing_month').eq('id', id).single()

  const { error } = await (supabase as any).from('invoices').delete().eq('id', id)
  if (error) return { error: error.message }

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

export async function generateExpectedMonthAction(monthStr: string) {
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

  if (existing && existing.length > 0) return { skipped: true }

  const { data: clients, error: clientErr } = await (supabase as any)
    .from('clients')
    .select('id, is_multi_site, monthly_value, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
    .eq('active', true)

  if (clientErr || !clients?.length) return { skipped: true }

  // Pre-fetch sites for multi-site clients
  const multiSiteIds = clients.filter((c: any) => c.is_multi_site).map((c: any) => c.id as string)
  const sitesMap = await fetchSitesMap(supabase as any, multiSiteIds)

  const rows = []
  for (const client of clients) {
    const inc = client.is_multi_site
      ? calcMultiSiteIncome(sitesMap[client.id] ?? [], year, month, client.monthly_value ?? 0)
      : calcSingleSiteIncome(client, year, month, false /* respect start_date for projections */)

    // Expected cost: for multi-site, aggregate from sites
    let expectedHours: number | null  = null
    let expectedCostEx: number | null = null
    if (client.is_multi_site) {
      const sites = sitesMap[client.id] ?? []
      if (sites.length > 0) {
        let eh = 0; let ec = 0; let hasData = false
        for (const site of sites) {
          const v = calculateMonthlyVisits(year, month, site.frequency ?? 'monthly',
            Array.isArray(site.service_days) ? site.service_days : [],
            new Date(year, month - 1, 1), site.rate_per_visit ?? 0)
          if (site.cleaner_hours_per_visit != null) {
            eh += round(site.cleaner_hours_per_visit * v.count); hasData = true
          }
          if (site.cleaner_hourly_rate && site.cleaner_hours_per_visit != null) {
            ec += round(site.cleaner_hours_per_visit * v.count * site.cleaner_hourly_rate)
          }
        }
        if (hasData) { expectedHours = round(eh); expectedCostEx = round(ec) }
      }
    } else {
      expectedHours  = client.cleaner_hours_per_visit != null
        ? round(client.cleaner_hours_per_visit * inc.count)
        : null
      expectedCostEx = expectedHours != null && client.cleaner_hourly_rate
        ? round(expectedHours * client.cleaner_hourly_rate)
        : null
    }

    rows.push({
      client_id:            client.id,
      month:                billingMonthDate,
      invoice_id:           null,
      service_count:        inc.count,
      income_ex_gst:        inc.income_ex_gst,
      rate_per_visit:       inc.rate_per_visit,
      cleaner_cost_ex_gst:  expectedCostEx ?? 0,
      profit:               round(inc.income_ex_gst - (expectedCostEx ?? 0)),
      margin_pct:           inc.income_ex_gst > 0
        ? round(((inc.income_ex_gst - (expectedCostEx ?? 0)) / inc.income_ex_gst) * 100)
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

// ─── Reprocess projected (no-invoice) P&L rows ───────────────────────────────

export async function reprocessProjectedMonthsAction() {
  const supabase = createClient()

  const { data: projectedRows } = await (supabase as any)
    .from('client_monthly_financials')
    .select('client_id, month')
    .is('invoice_id', null)

  if (!projectedRows?.length) return { fixed: 0 }

  const clientIds = Array.from(new Set(projectedRows.map((r: any) => r.client_id as string)))

  const { data: clients } = await (supabase as any)
    .from('clients')
    .select('id, is_multi_site, monthly_value, rate_per_visit, frequency, start_date, service_days, cleaner_hourly_rate, cleaner_hours_per_visit')
    .in('id', clientIds)

  if (!clients?.length) return { fixed: 0 }

  const multiSiteIds = clients.filter((c: any) => c.is_multi_site).map((c: any) => c.id as string)
  const sitesMap = await fetchSitesMap(supabase as any, multiSiteIds)

  const clientMap: Record<string, any> = {}
  for (const c of clients) clientMap[c.id] = c

  const updates: any[] = []

  for (const row of projectedRows) {
    const client = clientMap[row.client_id]
    if (!client) continue

    const monthDate = row.month as string
    const [yearStr, monthStr] = monthDate.split('-')
    const year  = parseInt(yearStr)
    const month = parseInt(monthStr)

    const inc = client.is_multi_site
      ? calcMultiSiteIncome(sitesMap[client.id] ?? [], year, month, client.monthly_value ?? 0)
      : calcSingleSiteIncome(client, year, month, false)

    let expectedHours: number | null  = null
    let expectedCostEx: number | null = null
    if (client.is_multi_site) {
      const sites = sitesMap[client.id] ?? []
      if (sites.length > 0) {
        let eh = 0; let ec = 0; let hasData = false
        for (const site of sites) {
          const v = calculateMonthlyVisits(year, month, site.frequency ?? 'monthly',
            Array.isArray(site.service_days) ? site.service_days : [],
            new Date(year, month - 1, 1), site.rate_per_visit ?? 0)
          if (site.cleaner_hours_per_visit != null) {
            eh += round(site.cleaner_hours_per_visit * v.count); hasData = true
          }
          if (site.cleaner_hourly_rate && site.cleaner_hours_per_visit != null) {
            ec += round(site.cleaner_hours_per_visit * v.count * site.cleaner_hourly_rate)
          }
        }
        if (hasData) { expectedHours = round(eh); expectedCostEx = round(ec) }
      }
    } else {
      expectedHours  = client.cleaner_hours_per_visit != null
        ? round(client.cleaner_hours_per_visit * inc.count)
        : null
      expectedCostEx = expectedHours != null && client.cleaner_hourly_rate
        ? round(expectedHours * client.cleaner_hourly_rate)
        : null
    }

    updates.push({
      client_id:            client.id,
      month:                monthDate,
      invoice_id:           null,
      service_count:        inc.count,
      income_ex_gst:        inc.income_ex_gst,
      rate_per_visit:       inc.rate_per_visit,
      cleaner_cost_ex_gst:  expectedCostEx ?? 0,
      profit:               round(inc.income_ex_gst - (expectedCostEx ?? 0)),
      margin_pct:           inc.income_ex_gst > 0
        ? round(((inc.income_ex_gst - (expectedCostEx ?? 0)) / inc.income_ex_gst) * 100)
        : null,
      expected_hours:       expectedHours,
      expected_cost_ex_gst: expectedCostEx,
    })
  }

  if (updates.length > 0) {
    await (supabase as any)
      .from('client_monthly_financials')
      .upsert(updates, { onConflict: 'client_id,month' })
  }

  revalidatePath('/financial')
  return { fixed: updates.length }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
