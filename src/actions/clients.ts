'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientSchema } from '@/lib/validations/client.schema'
import { calculateMonthlyValue, calculateAnnualValue } from '@/lib/billing'
import { sendPushToRole } from '@/lib/push'
import type { FrequencyType, ServiceType } from '@/types/app'

export async function createClientAction(formData: FormData) {
  const supabase = createClient()

  const serviceTypes = formData.getAll('service_type') as ServiceType[]
  const serviceDays  = formData.getAll('service_days')  as string[]

  const raw = {
    business_name: formData.get('business_name'),
    contact_name: formData.get('contact_name'),
    contact_email: formData.get('contact_email'),
    contact_phone: formData.get('contact_phone'),
    address: formData.get('address'),
    suburb: formData.get('suburb'),
    state: formData.get('state') || 'QLD',
    postcode: formData.get('postcode'),
    service_type: serviceTypes,
    frequency: formData.get('frequency'),
    rate_per_visit: formData.get('rate_per_visit'),
    start_date: formData.get('start_date'),
    active: true,
    notes: formData.get('notes'),
    days_per_week: formData.get('days_per_week') || undefined,
    scope_of_work: formData.get('scope_of_work'),
    access_details: formData.get('access_details'),
    assigned_cleaner_id: formData.get('assigned_cleaner_id'),
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
  const monthly_value = rate_per_visit
    ? calculateMonthlyValue(rate_per_visit, frequency as FrequencyType)
    : null
  const annual_value = monthly_value ? calculateAnnualValue(monthly_value) : null

  const db = supabase as any
  const { data, error } = await db
    .from('clients')
    .insert({
      ...rest,
      frequency,
      rate_per_visit: rate_per_visit || null,
      monthly_value,
      annual_value,
      start_date: rest.start_date || null,
      contact_name: rest.contact_name || null,
      contact_email: rest.contact_email || null,
      contact_phone: rest.contact_phone || null,
      address: rest.address || null,
      suburb: rest.suburb || null,
      postcode: rest.postcode || null,
      notes: rest.notes || null,
      cleaner_hourly_rate:    cleanerHourlyRate,
      cleaner_hours_per_visit: cleanerHoursPerVisit,
      contract_expiry_date:   contractExpiryDate,
      service_days:           serviceDays,
      days_per_week:           days_per_week ?? null,
      scope_of_work:           scope_of_work || null,
      access_details:          access_details || null,
      assigned_cleaner_id:     assigned_cleaner_id || null,
      additional_services:     additionalServices,
    })
    .select('id')
    .single()

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

  const serviceTypes = formData.getAll('service_type') as ServiceType[]
  const serviceDaysUpd = formData.getAll('service_days') as string[]

  const raw = {
    business_name: formData.get('business_name'),
    contact_name: formData.get('contact_name'),
    contact_email: formData.get('contact_email'),
    contact_phone: formData.get('contact_phone'),
    address: formData.get('address'),
    suburb: formData.get('suburb'),
    state: formData.get('state') || 'QLD',
    postcode: formData.get('postcode'),
    service_type: serviceTypes,
    frequency: formData.get('frequency'),
    rate_per_visit: formData.get('rate_per_visit'),
    start_date: formData.get('start_date'),
    active: formData.get('active') === 'true',
    notes: formData.get('notes'),
    contract_expiry_date: formData.get('contract_expiry_date'),
    days_per_week: formData.get('days_per_week') || undefined,
    scope_of_work: formData.get('scope_of_work'),
    access_details: formData.get('access_details'),
    assigned_cleaner_id: formData.get('assigned_cleaner_id'),
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
  const monthly_value = rate_per_visit
    ? calculateMonthlyValue(rate_per_visit, frequency as FrequencyType)
    : null
  const annual_value = monthly_value ? calculateAnnualValue(monthly_value) : null

  const db2 = supabase as any
  const { error } = await db2
    .from('clients')
    .update({
      ...rest,
      frequency,
      rate_per_visit: rate_per_visit || null,
      monthly_value,
      annual_value,
      start_date: rest.start_date || null,
      contact_name: rest.contact_name || null,
      contact_email: rest.contact_email || null,
      contact_phone: rest.contact_phone || null,
      address: rest.address || null,
      suburb: rest.suburb || null,
      postcode: rest.postcode || null,
      notes: rest.notes || null,
      cleaner_hourly_rate:     cleanerHourlyRateUpd,
      cleaner_hours_per_visit: cleanerHoursPerVisitUpd,
      contract_expiry_date:    contractExpiryDateUpd,
      service_days:            serviceDaysUpd,
      days_per_week:           dpw ?? null,
      scope_of_work:           sow || null,
      access_details:          ad || null,
      assigned_cleaner_id:     aci || null,
      additional_services:     additionalServicesUpd,
    })
    .eq('id', id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}`)
}

export async function toggleClientActiveAction(id: string, active: boolean) {
  const supabase = createClient()
  await supabase.from('clients').update({ active }).eq('id', id)
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
}

export async function updateClientNotesAction(id: string, notes: string) {
  const supabase = createClient()
  await supabase.from('clients').update({ notes }).eq('id', id)
  revalidatePath(`/clients/${id}`)
}
