'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientSchema } from '@/lib/validations/client.schema'
import { calculateMonthlyValue, calculateAnnualValue, visitsPerMonth } from '@/lib/billing'
import { sendPushToRole } from '@/lib/push'
import type { FrequencyType, ServiceType } from '@/types/app'

function parseSites(raw: string | null): any[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function calcSiteMonthlyValue(site: any): number {
  const rate = parseFloat(site.rate_per_visit) || 0
  if (!rate || !site.frequency) return 0
  const dpw = parseInt(site.days_per_week) || 1
  return calculateMonthlyValue(rate, site.frequency as FrequencyType, dpw)
}

export async function createClientAction(formData: FormData) {
  const supabase = createClient()

  const isMultiSite = formData.get('is_multi_site') === 'true'
  const sitesData   = isMultiSite ? parseSites(formData.get('sites') as string | null) : []

  const serviceTypes = formData.getAll('service_type') as ServiceType[]
  const serviceDays  = formData.getAll('service_days')  as string[]

  // formData.get() returns null for fields absent from DOM (e.g. hidden for multi-site).
  // Zod optional() accepts undefined but not null — convert all nulls to undefined.
  const fget = (k: string) => (formData.get(k) as string | null) ?? undefined

  const raw = {
    business_name: fget('business_name'),
    contact_name: fget('contact_name'),
    contact_email: fget('contact_email'),
    contact_phone: fget('contact_phone'),
    address: fget('address'),
    suburb: fget('suburb'),
    state: fget('state') || 'QLD',
    postcode: fget('postcode'),
    service_type: serviceTypes,
    frequency: fget('frequency') || undefined,
    rate_per_visit: fget('rate_per_visit'),
    start_date: fget('start_date'),
    active: true,
    notes: fget('notes'),
    days_per_week: fget('days_per_week') || undefined,
    scope_of_work: fget('scope_of_work'),
    access_details: fget('access_details'),
    assigned_cleaner_id: fget('assigned_cleaner_id') || undefined,
  }

  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const cleanerHourlyRate    = parseFloat(formData.get('cleaner_hourly_rate')    as string) || null
  const cleanerHoursPerVisit = parseFloat(formData.get('cleaner_hours_per_visit') as string) || null
  const contractExpiryDate   = (formData.get('contract_expiry_date') as string)  || null
  const additionalServicesRaw = (formData.get('additional_services') as string) || '[]'
  let additionalServices: any[] = []
  try { additionalServices = JSON.parse(additionalServicesRaw) } catch {}

  const { frequency, rate_per_visit, days_per_week, scope_of_work, access_details, assigned_cleaner_id, ...rest } = parsed.data

  // For multi-site, sum monthly value across all sites
  const multiSiteMonthly = isMultiSite && sitesData.length > 0
    ? sitesData.reduce((sum: number, s: any) => sum + calcSiteMonthlyValue(s), 0)
    : null

  const singleDpw = Number(days_per_week) || 1
  const monthly_value = isMultiSite
    ? (multiSiteMonthly || null)
    : rate_per_visit && frequency
      ? calculateMonthlyValue(rate_per_visit, frequency as FrequencyType, singleDpw)
      : null
  const annual_value = monthly_value ? calculateAnnualValue(monthly_value) : null

  // For multi-site, aggregate labour cost from all sites (days/week aware)
  let multiSiteMonthlyLabour: number | null = null
  if (isMultiSite && sitesData.length > 0) {
    let total = 0
    for (const site of sitesData) {
      const rate  = parseFloat(site.cleaner_hourly_rate)    || 0
      const hours = parseFloat(site.cleaner_hours_per_visit) || 0
      const freq  = site.frequency as FrequencyType
      const dpw   = parseInt(site.days_per_week) || 1
      if (rate && hours && freq) {
        total += rate * hours * visitsPerMonth(freq, dpw)
      }
    }
    if (total > 0) multiSiteMonthlyLabour = Math.round(total * 100) / 100
  }

  // Single-site labour from the cleaner rate × hours × visits/month
  const singleSiteLabour = (!isMultiSite && cleanerHourlyRate && cleanerHoursPerVisit && frequency && rate_per_visit)
    ? Math.round(cleanerHourlyRate * cleanerHoursPerVisit * visitsPerMonth(frequency as FrequencyType, singleDpw) * 100) / 100
    : null

  const monthly_labour_cost = isMultiSite ? multiSiteMonthlyLabour : singleSiteLabour
  const monthly_profit = (monthly_value !== null && monthly_labour_cost !== null)
    ? Math.round((monthly_value - monthly_labour_cost) * 100) / 100
    : null
  const margin_pct = (monthly_value && monthly_value > 0 && monthly_profit !== null)
    ? Math.round((monthly_profit / monthly_value) * 1000) / 10
    : null

  const db = supabase as any
  const { data, error } = await db
    .from('clients')
    .insert({
      ...rest,
      is_multi_site:   isMultiSite,
      frequency:       isMultiSite ? null : (frequency ?? null),
      rate_per_visit:  isMultiSite ? null : (rate_per_visit || null),
      monthly_value,
      annual_value,
      start_date: rest.start_date || null,
      contact_name: rest.contact_name || null,
      contact_email: rest.contact_email || null,
      contact_phone: rest.contact_phone || null,
      // Multi-site clients hold NO client-level address — it lives on each site.
      address:  isMultiSite ? null : (rest.address  || null),
      suburb:   isMultiSite ? null : (rest.suburb   || null),
      state:    isMultiSite ? null : (rest.state    || 'QLD'),
      postcode: isMultiSite ? null : (rest.postcode || null),
      notes: rest.notes || null,
      cleaner_hourly_rate:    isMultiSite ? null : cleanerHourlyRate,
      cleaner_hours_per_visit: isMultiSite ? null : cleanerHoursPerVisit,
      contract_expiry_date:   contractExpiryDate,
      service_days:           isMultiSite ? [] : serviceDays,
      days_per_week:          isMultiSite ? null : (days_per_week ?? null),
      scope_of_work:          isMultiSite ? null : (scope_of_work || null),
      access_details:         isMultiSite ? null : (access_details || null),
      assigned_cleaner_id:    isMultiSite ? null : (assigned_cleaner_id || null),
      additional_services:    additionalServices,
      monthly_labour_cost,
      monthly_profit,
      margin_pct,
    })
    .select('id')
    .single()

  // Insert sites after client is created
  if (!error && isMultiSite && sitesData.length > 0 && data?.id) {
    const siteInserts = sitesData.map((site: any, idx: number) => ({
      client_id:               data.id,
      site_name:               site.site_name || `Site ${idx + 1}`,
      address:                 site.address   || null,
      suburb:                  site.suburb    || null,
      state:                   site.state     || 'QLD',
      postcode:                site.postcode  || null,
      scope_of_work:           site.scope_of_work || null,
      frequency:               site.frequency || null,
      service_days:            Array.isArray(site.service_days) ? site.service_days : [],
      days_per_week:           parseInt(site.days_per_week)     || null,
      access_details:          site.access_details              || null,
      assigned_cleaner_id:     site.assigned_cleaner_id         || null,
      rate_per_visit:          parseFloat(site.rate_per_visit)  || null,
      cleaner_hourly_rate:     parseFloat(site.cleaner_hourly_rate) || null,
      cleaner_hours_per_visit: parseFloat(site.cleaner_hours_per_visit) || null,
      notes:                   site.notes     || null,
      sort_order:              idx,
    }))
    await db.from('client_sites').insert(siteInserts)
  }

  if (error) {
    return { error: { _form: [error.message] } }
  }

  // Optional: create portal login in the same step
  const portalEmail    = (formData.get('portal_email')    as string | null)?.trim()
  const portalPassword = (formData.get('portal_password') as string | null)?.trim()

  if (portalEmail && portalPassword && data?.id) {
    const adminClient = createAdminClient()
    const fullName = (parsed.data.contact_name as string | null | undefined) || parsed.data.business_name

    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email:         portalEmail,
      password:      portalPassword,
      email_confirm: true,
      user_metadata: { role: 'client', full_name: fullName },
    })

    if (!authErr && authData.user) {
      await (adminClient as any).from('profiles').insert({
        user_id:          authData.user.id,
        role:             'client',
        full_name:        fullName,
        email:            portalEmail,
        linked_client_id: data.id,
      })
    }
    // Non-fatal: if portal creation fails, client record is still saved
  }

  // Push notification to all managers
  sendPushToRole('manager', {
    title: `New Client — ${parsed.data.business_name}`,
    body:  'A new client has been onboarded and is ready for cleaner assignment.',
    url:   `/clients/${data.id}`,
  }).catch(() => {})

  revalidatePath('/clients')
  redirect(`/clients/${data.id}`)
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = createClient()

  const isMultiSite    = formData.get('is_multi_site') === 'true'
  const sitesData      = isMultiSite ? parseSites(formData.get('sites') as string | null) : []
  const serviceTypes   = formData.getAll('service_type') as ServiceType[]
  const serviceDaysUpd = formData.getAll('service_days') as string[]

  const fget = (k: string) => (formData.get(k) as string | null) ?? undefined

  const raw = {
    business_name: fget('business_name'),
    contact_name: fget('contact_name'),
    contact_email: fget('contact_email'),
    contact_phone: fget('contact_phone'),
    address: fget('address'),
    suburb: fget('suburb'),
    state: fget('state') || 'QLD',
    postcode: fget('postcode'),
    service_type: serviceTypes,
    frequency: fget('frequency') || undefined,
    rate_per_visit: fget('rate_per_visit'),
    start_date: fget('start_date'),
    active: formData.get('active') === 'true',
    notes: fget('notes'),
    contract_expiry_date: fget('contract_expiry_date'),
    days_per_week: fget('days_per_week') || undefined,
    scope_of_work: fget('scope_of_work'),
    access_details: fget('access_details'),
    assigned_cleaner_id: fget('assigned_cleaner_id') || undefined,
  }

  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const cleanerHourlyRateUpd    = parseFloat(formData.get('cleaner_hourly_rate')    as string) || null
  const cleanerHoursPerVisitUpd = parseFloat(formData.get('cleaner_hours_per_visit') as string) || null
  const contractExpiryDateUpd   = (formData.get('contract_expiry_date') as string)  || null
  const additionalServicesUpdRaw = (formData.get('additional_services') as string) || '[]'
  let additionalServicesUpd: any[] = []
  try { additionalServicesUpd = JSON.parse(additionalServicesUpdRaw) } catch {}

  const { frequency, rate_per_visit, days_per_week: dpw, scope_of_work: sow, access_details: ad, assigned_cleaner_id: aci, ...rest } = parsed.data

  const multiSiteMonthlyUpd = isMultiSite && sitesData.length > 0
    ? sitesData.reduce((sum: number, s: any) => sum + calcSiteMonthlyValue(s), 0)
    : null

  const singleDpwUpd = Number(dpw) || 1
  const monthly_value = isMultiSite
    ? (multiSiteMonthlyUpd || null)
    : rate_per_visit && frequency
      ? calculateMonthlyValue(rate_per_visit, frequency as FrequencyType, singleDpwUpd)
      : null
  const annual_value = monthly_value ? calculateAnnualValue(monthly_value) : null

  // For multi-site, aggregate labour cost from all sites (days/week aware)
  let multiSiteMonthlyLabourUpd: number | null = null
  if (isMultiSite && sitesData.length > 0) {
    let total = 0
    for (const site of sitesData) {
      const rate  = parseFloat(site.cleaner_hourly_rate)    || 0
      const hours = parseFloat(site.cleaner_hours_per_visit) || 0
      const freq  = site.frequency as FrequencyType
      const sdpw  = parseInt(site.days_per_week) || 1
      if (rate && hours && freq) {
        total += rate * hours * visitsPerMonth(freq, sdpw)
      }
    }
    if (total > 0) multiSiteMonthlyLabourUpd = Math.round(total * 100) / 100
  }

  const singleSiteLabourUpd = (!isMultiSite && cleanerHourlyRateUpd && cleanerHoursPerVisitUpd && frequency && rate_per_visit)
    ? Math.round(cleanerHourlyRateUpd * cleanerHoursPerVisitUpd * visitsPerMonth(frequency as FrequencyType, singleDpwUpd) * 100) / 100
    : null

  const monthly_labour_cost_upd = isMultiSite ? multiSiteMonthlyLabourUpd : singleSiteLabourUpd
  const monthly_profit_upd = (monthly_value !== null && monthly_labour_cost_upd !== null)
    ? Math.round((monthly_value - monthly_labour_cost_upd) * 100) / 100
    : null
  const margin_pct_upd = (monthly_value && monthly_value > 0 && monthly_profit_upd !== null)
    ? Math.round((monthly_profit_upd / monthly_value) * 1000) / 10
    : null

  const db2 = supabase as any
  const { error } = await db2
    .from('clients')
    .update({
      ...rest,
      is_multi_site:   isMultiSite,
      frequency:       isMultiSite ? null : (frequency ?? null),
      rate_per_visit:  isMultiSite ? null : (rate_per_visit || null),
      monthly_value,
      annual_value,
      start_date: rest.start_date || null,
      contact_name: rest.contact_name || null,
      contact_email: rest.contact_email || null,
      contact_phone: rest.contact_phone || null,
      // Multi-site clients hold NO client-level address — it lives on each site.
      address:  isMultiSite ? null : (rest.address  || null),
      suburb:   isMultiSite ? null : (rest.suburb   || null),
      state:    isMultiSite ? null : (rest.state    || 'QLD'),
      postcode: isMultiSite ? null : (rest.postcode || null),
      notes: rest.notes || null,
      cleaner_hourly_rate:     isMultiSite ? null : cleanerHourlyRateUpd,
      cleaner_hours_per_visit: isMultiSite ? null : cleanerHoursPerVisitUpd,
      contract_expiry_date:    contractExpiryDateUpd,
      service_days:            isMultiSite ? [] : serviceDaysUpd,
      days_per_week:           isMultiSite ? null : (dpw ?? null),
      scope_of_work:           isMultiSite ? null : (sow || null),
      access_details:          isMultiSite ? null : (ad || null),
      assigned_cleaner_id:     isMultiSite ? null : (aci || null),
      additional_services:     additionalServicesUpd,
      monthly_labour_cost:     monthly_labour_cost_upd,
      monthly_profit:          monthly_profit_upd,
      margin_pct:              margin_pct_upd,
    })
    .eq('id', id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  // Sync sites: delete old, insert new
  if (isMultiSite) {
    await db2.from('client_sites').delete().eq('client_id', id)
    if (sitesData.length > 0) {
      const siteUpdates = sitesData.map((site: any, idx: number) => ({
        client_id:               id,
        site_name:               site.site_name || `Site ${idx + 1}`,
        address:                 site.address   || null,
        suburb:                  site.suburb    || null,
        state:                   site.state     || 'QLD',
        postcode:                site.postcode  || null,
        scope_of_work:           site.scope_of_work || null,
        frequency:               site.frequency || null,
        service_days:            Array.isArray(site.service_days) ? site.service_days : [],
        days_per_week:           parseInt(site.days_per_week)     || null,
        access_details:          site.access_details              || null,
        assigned_cleaner_id:     site.assigned_cleaner_id         || null,
        rate_per_visit:          parseFloat(site.rate_per_visit)  || null,
        cleaner_hourly_rate:     parseFloat(site.cleaner_hourly_rate) || null,
        cleaner_hours_per_visit: parseFloat(site.cleaner_hours_per_visit) || null,
        notes:                   site.notes     || null,
        sort_order:              idx,
      }))
      await db2.from('client_sites').insert(siteUpdates)
    }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}`)
}

// Stable, top-level form action for the edit page. Reads the client id from a
// hidden form field instead of a captured closure, so its action ID stays
// consistent across deploys (no "missing server action" after a redeploy).
export async function updateClientFromFormAction(formData: FormData) {
  const id = formData.get('__client_id') as string | null
  if (!id) return { error: { _form: ['Could not determine which client to save. Please reload and try again.'] } }
  return updateClientAction(id, formData)
}

// Off-board (or reactivate) a client. Uses the service-role client and never
// throws — it returns an { error } so the UI can show a message instead of
// hitting the app-wide error boundary. Deactivating also disables the client's
// portal login and (optionally) sends a thank-you + feedback email.
export async function setClientActiveAction(
  id: string,
  active: boolean,
  opts?: { sendEmail?: boolean },
): Promise<{ success?: boolean; error?: string; emailSent?: boolean }> {
  const admin = createAdminClient() as any
  try {
    const { error: upErr } = await admin.from('clients').update({ active }).eq('id', id)
    if (upErr) return { error: `Could not update the client: ${upErr.message}` }

    // Disable (or re-enable) the client's portal login(s). Best-effort — a portal
    // account may not exist, and this must never block the status change.
    try {
      const { data: profs } = await admin.from('profiles').select('user_id').eq('linked_client_id', id).eq('role', 'client')
      for (const p of profs ?? []) {
        if (!p.user_id) continue
        await admin.auth.admin.updateUserById(p.user_id, { ban_duration: active ? 'none' : '876000h' })
      }
    } catch { /* portal disable is best-effort */ }

    let emailSent = false
    if (!active && opts?.sendEmail) {
      const res = await sendClientOffboardEmail(admin, id)
      emailSent = !!res.success
    }

    revalidatePath('/clients')
    revalidatePath(`/clients/${id}`)
    return { success: true, emailSent }
  } catch (e: any) {
    return { error: e?.message || 'Something went wrong updating the client. Please try again.' }
  }
}

// Thank-you + feedback email sent when a client is off-boarded (if the box is ticked).
async function sendClientOffboardEmail(admin: any, clientId: string): Promise<{ success?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'Email is not configured.' }

  const { data: client } = await admin.from('clients').select('business_name, contact_name, contact_email').eq('id', clientId).single()
  if (!client?.contact_email) return { error: 'No email on file for this client.' }

  // A short exit-survey link (service, value, reason for leaving) so they can tell us how we did.
  const { data: tokenRow } = await admin.from('survey_tokens').insert({ client_id: clientId, kind: 'exit' }).select('token').single()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au'
  const feedbackUrl = tokenRow ? `${baseUrl}/survey/${tokenRow.token}` : null
  const firstName = (client.contact_name || '').split(' ')[0] || 'there'

  const html = `<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.65;background:#fff;">
<div style="max-width:540px;padding:40px 24px;">
<p>Hi ${firstName},</p>
<p>Thank you for having us look after ${client.business_name}. It's genuinely been a pleasure, and we're grateful for the time you trusted Delta Cleaning with your site.</p>
<p>If anything ever changes, or you'd like us back, you can reach me directly any time, we'd welcome the chance to work with you again.</p>
${feedbackUrl ? `<p>Before you go, if you have a spare minute, we'd really value your honest feedback on how we did, it helps us keep improving:</p>
<p><a href="${feedbackUrl}" style="color:#1e3a5f;">Share a little feedback here</a></p>` : ''}
<p>Wishing you and ${client.business_name} all the best.</p>
<p style="margin-top:24px;">Best Regards<br/>
Jackson Jaillet<br/>
<span style="color:#555;font-size:14px;">Founder &amp; Director, Delta Cleaning</span><br/>
<span style="color:#555;font-size:14px;">0412 844 238</span><br/>
<a href="https://www.deltacleaning.com.au" style="color:#555;font-size:14px;text-decoration:none;">www.deltacleaning.com.au</a></p>
</div>
</body></html>`

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
      to: client.contact_email,
      reply_to: 'hello@deltacleaning.com.au',
      bcc: 'hello@deltacleaning.com.au',
      subject: `Thank you from Delta Cleaning`,
      html,
    })
    if (error) return { error: (error as any).message }
    return { success: true }
  } catch (e: any) {
    return { error: e?.message || 'Failed to send the email.' }
  }
}

export async function updateClientNotesAction(id: string, notes: string) {
  const supabase = createClient()
  await supabase.from('clients').update({ notes }).eq('id', id)
  revalidatePath(`/clients/${id}`)
}
