'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { introEmailContent, followUpEmailContent, buildCapabilityAttachment, sendThreadedEmail } from '@/lib/emails/prospect-email'

export interface CommsEntry {
  kind: 'email' | 'follow_up_email' | 'sms'
  at: string          // ISO timestamp
  subject?: string
  body: string        // plain text of what was actually sent
}

export interface ColdLead {
  id: string
  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  suburb: string | null
  industry: string | null
  status: 'new' | 'called' | 'follow_up' | 'walkthrough' | 'converted' | 'not_interested'
  call_count: number
  last_called_at: string | null
  next_follow_up: string | null
  follow_up_note: string | null
  next_attempt: string | null
  has_spoken: boolean
  lead_id: string | null
  intro_email_sent_at: string | null
  intro_email_message_id: string | null
  intro_email_subject: string | null
  follow_up_email_sent_at: string | null
  follow_up_opt_in: boolean
  intro_sms_sent_at: string | null
  comms: CommsEntry[]
  call_log: CallLogEntry[]
  notes: string | null
  created_at: string
}

export interface CallLogEntry {
  at: string                 // ISO timestamp
  outcome: string            // no_answer | spoke | follow_up | walkthrough | not_interested
  note: string | null        // optional plain-English summary of the call
}

// How many days to wait before the next attempt after a no-answer — widens as
// attempts pile up so you don't burn a lead out.
function retryDays(callCount: number): number {
  if (callCount <= 1) return 1
  if (callCount === 2) return 2
  if (callCount === 3) return 4
  return 7
}

function addDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}

// ─── Import ──────────────────────────────────────────────────────────────────
// Accepts raw CSV text (exported from the purchased Google Sheet).
// Header detection is fuzzy so column names don't have to match exactly.

function detectColumn(headers: string[], candidates: string[]): number {
  for (const cand of candidates) {
    const i = headers.findIndex(h => h.includes(cand))
    if (i !== -1) return i
  }
  return -1
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(f => f.trim() !== '')) rows.push(row)
  return rows
}

export interface ColumnMap {
  business: number; contact: number; phone: number; email: number; suburb: number; industry: number
}

// Best-guess column mapping. Deliberately avoids picking an address column as
// the business name (a "Business Address" header would otherwise win).
function guessColumns(headers: string[]): ColumnMap {
  const has = (h: string, ...subs: string[]) => subs.some(s => h.includes(s))
  let business = headers.findIndex(h => has(h, 'business', 'company', 'organisation', 'organization', 'trading name') && !h.includes('address'))
  if (business === -1) business = headers.findIndex(h => h === 'name' || h.endsWith(' name') && !h.includes('contact') && !h.includes('first') && !h.includes('last'))
  return {
    business,
    contact:  detectColumn(headers, ['contact', 'owner', 'first name', 'full name', 'person', 'director', 'manager']),
    phone:    detectColumn(headers, ['phone', 'mobile', 'number', 'tel']),
    email:    detectColumn(headers, ['email', 'e-mail']),
    suburb:   detectColumn(headers, ['suburb', 'city', 'locality', 'area']),
    industry: detectColumn(headers, ['industry', 'category', 'type', 'niche', 'sector']),
  }
}

// Some lead lists put a street address in the "Company" cell. Detect that so we
// can fall back to a real company name derived from the website/email domain.
function looksLikeAddress(s: string | null): boolean {
  // Addresses in these lists always have commas plus either a leading street
  // number or a postcode. Requiring a comma avoids false hits on names like
  // "St James College" or "3M".
  if (!s || !s.includes(',')) return false
  return /^\s*\d/.test(s) || /\b\d{4,5}\b/.test(s)
}

function domainFrom(value: string | null): string | null {
  if (!value) return null
  let h = value.trim().toLowerCase()
  const at = h.indexOf('@')
  if (at >= 0) h = h.slice(at + 1)
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const parts = h.split('.').filter(Boolean)
  return parts.length >= 2 ? parts[0] : null
}

function companyFromDomain(sld: string | null): string | null {
  if (!sld) return null
  return sld.length <= 4 ? sld.toUpperCase() : sld.charAt(0).toUpperCase() + sld.slice(1)
}

// Step 1: parse and return columns + a guess so the user can confirm the mapping
export async function previewColdLeadsCsvAction(csvText: string) {
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { error: 'Could not find any rows. Make sure the header row is included.' }
  const headers = rows[0].map(h => h.trim())
  const guess = guessColumns(headers.map(h => h.toLowerCase()))
  return { success: true as const, headers, guess, rowCount: rows.length - 1, sample: rows.slice(1, 4) }
}

// Step 2: import using an explicit mapping. A missing mapping means the call
// came from an out-of-date (cached) version of the app — refuse it so stale
// code can't silently import mis-mapped data, and prompt the user to update.
export async function importColdLeadsAction(csvText: string, mapping?: ColumnMap) {
  if (!mapping) {
    return { error: 'Your app needs to update. Fully close Delta (swipe it away in the app switcher) and reopen it, then import again — you’ll get a step to match your columns.' }
  }

  const rows = parseCsv(csvText)
  if (rows.length < 2) return { error: 'Could not find any rows. Paste the CSV including the header row.' }

  const col = mapping
  if (col.business < 0) return { error: 'Choose which column holds the business name.' }

  // Find a website/url column so we can recover a real company name when the
  // mapped business cell turns out to be a street address (common in JLL-style
  // exports where "Company" holds the office address).
  const headers = rows[0].map(h => h.trim().toLowerCase())
  const websiteCol = detectColumn(headers, ['website', 'url', 'domain', 'web'])

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() || null : null)

  const leads = rows.slice(1)
    .map(r => {
      let business = get(r, col.business)
      const email = get(r, col.email)
      if (looksLikeAddress(business)) {
        const derived = companyFromDomain(domainFrom(get(r, websiteCol)) || domainFrom(email))
        if (derived) business = derived
      }
      return {
        business_name: business,
        contact_name:  get(r, col.contact),
        phone:         get(r, col.phone),
        email,
        suburb:        get(r, col.suburb),
        industry:      get(r, col.industry),
      }
    })
    .filter(l => l.business_name)

  if (leads.length === 0) return { error: 'No usable rows found under the header.' }

  const db = createAdminClient() as any

  // Skip duplicates already in the deck (same business name + phone)
  const { data: existing } = await db.from('cold_leads').select('business_name, phone')
  const seen = new Set((existing ?? []).map((e: any) => `${(e.business_name || '').toLowerCase()}::${e.phone || ''}`))
  const fresh = leads.filter(l => !seen.has(`${l.business_name!.toLowerCase()}::${l.phone || ''}`))

  if (fresh.length === 0) return { error: 'All of these leads are already in your deck.' }

  const { error } = await db.from('cold_leads').insert(fresh)
  if (error) return { error: error.message }

  revalidatePath('/calls')
  return { success: true, imported: fresh.length, skipped: leads.length - fresh.length }
}

// ─── Call logging ────────────────────────────────────────────────────────────

export async function logCallAction(
  id: string,
  outcome: 'no_answer' | 'spoke' | 'follow_up' | 'walkthrough' | 'not_interested',
  followUpDate?: string,
  note?: string
) {
  const db = createAdminClient() as any

  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }

  const statusMap: Record<string, string> = {
    no_answer:      'called',
    spoke:          'called',
    follow_up:      'follow_up',
    walkthrough:    'walkthrough',
    not_interested: 'not_interested',
  }

  // Reaching a person — these outcomes unlock the intro email / text
  const spokenOutcomes = ['spoke', 'follow_up', 'walkthrough']
  const newCount = lead.call_count + 1

  const update: Record<string, any> = {
    call_count: newCount,
    last_called_at: new Date().toISOString(),
    status: statusMap[outcome],
  }
  if (spokenOutcomes.includes(outcome)) update.has_spoken = true

  // No answer → auto-schedule the next attempt so the system tells you when to
  // try again. Any other outcome clears the retry timer.
  if (outcome === 'no_answer') {
    update.next_attempt = addDays(retryDays(newCount))
  } else {
    update.next_attempt = null
  }

  if (followUpDate) update.next_follow_up = followUpDate
  // follow_up_note drives the "follow-up due" banner — only set it for the dated outcomes.
  if ((outcome === 'follow_up' || outcome === 'walkthrough') && note !== undefined) {
    update.follow_up_note = note || null
  }

  // Append a timestamped summary entry to the call log (every outcome).
  update.call_log = [
    ...(Array.isArray(lead.call_log) ? lead.call_log : []),
    { at: new Date().toISOString(), outcome, note: note?.trim() || null },
  ]

  // Booking a walk-through means this is a real opportunity — push it into the
  // sales pipeline so cold calls and Leads stay in sync. Idempotent: only once.
  if (outcome === 'walkthrough' && !lead.lead_id) {
    const timeline = [{
      id: crypto.randomUUID(),
      type: 'status_change' as const,
      message: 'Created from a cold call (walkthrough booked)',
      timestamp: new Date().toISOString(),
    }]
    const { data: newLead } = await db.from('leads').insert({
      business_name: lead.business_name,
      contact_name:  lead.contact_name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      suburb:        lead.suburb,
      state:         'QLD',
      source:        'Cold call',
      notes:         lead.notes,
      status:        'contacted',
      timeline,
    }).select('id').single()
    if (newLead?.id) update.lead_id = newLead.id
  }

  const { error } = await db.from('cold_leads').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calls')
  revalidatePath('/leads')
  return { success: true }
}

export async function setFollowUpAction(id: string, date: string | null, note?: string) {
  const db = createAdminClient() as any
  const update: Record<string, any> = { next_follow_up: date }
  if (note !== undefined) update.follow_up_note = note || null
  if (date) update.status = 'follow_up'
  const { error } = await db.from('cold_leads').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/calls')
  return { success: true }
}

export async function updateColdLeadAction(id: string, fields: Partial<Pick<ColdLead, 'status' | 'notes' | 'phone' | 'email' | 'contact_name'>>) {
  const db = createAdminClient() as any
  const { error } = await db.from('cold_leads').update(fields).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/calls')
  return { success: true }
}

export async function deleteColdLeadAction(id: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('cold_leads').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/calls')
  return { success: true }
}

// ─── Email (post-conversation) ───────────────────────────────────────────────
// Only sent after you have actually spoken with the lead and they have asked
// for something in writing. Plain, human copy. No dashes anywhere in the copy
// or subject lines (deliberate house style for these messages).

// The intro / follow-up email copy, signature and threaded sender all live in
// the shared @/lib/emails/prospect-email module so the cold-call deck and the
// pipeline leads send the exact same thing (and can never drift apart again).

export async function sendIntroEmailAction(id: string, scheduleFollowUp = false) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.has_spoken) return { error: 'Only send this once you’ve spoken with them on the phone.' }

  const { subject, html, bodyText } = introEmailContent({
    businessName: lead.business_name, contactName: lead.contact_name, suburb: lead.suburb,
  })

  // A Message-ID we own, so the follow-up can thread under this email
  const messageId = `<intro-${id}-${Date.now()}@deltacleaning.com.au>`
  // Attach the capability statement (best-effort — still send if the PDF service is down)
  const attachments = await buildCapabilityAttachment()

  const result = await sendThreadedEmail({ to: lead.email, subject, html, messageId, attachments })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  const comms: CommsEntry[] = [...(lead.comms ?? []), { kind: 'email', at: now, subject, body: bodyText }]
  await db.from('cold_leads').update({
    intro_email_sent_at: now,
    intro_email_message_id: messageId,
    intro_email_subject: subject,
    follow_up_opt_in: !!scheduleFollowUp,
    comms,
  }).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}

export async function sendFollowUpEmailAction(id: string) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.intro_email_message_id || !lead.intro_email_subject) {
    return { error: 'Send the first email before following up.' }
  }

  const { subject, html, bodyText } = followUpEmailContent({
    businessName: lead.business_name, contactName: lead.contact_name, suburb: lead.suburb,
  }, lead.intro_email_subject)

  const result = await sendThreadedEmail({
    to: lead.email,
    subject,
    html,
    inReplyTo: lead.intro_email_message_id,
  })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  const comms: CommsEntry[] = [...(lead.comms ?? []), { kind: 'follow_up_email', at: now, subject, body: bodyText }]
  await db.from('cold_leads').update({ follow_up_email_sent_at: now, comms }).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}

// ─── Email previews (no send) — power the "review before sending" step ────────
// Mirror the exact subject + body the send actions produce, so what you see is
// what goes out. Returns the plain-text body for display.

export async function previewIntroEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.has_spoken) return { error: 'Only send this once you’ve spoken with them on the phone.' }

  const { subject, bodyText } = introEmailContent({
    businessName: lead.business_name, contactName: lead.contact_name, suburb: lead.suburb,
  })
  return { to: lead.email, subject, body: `${bodyText}\n\n📎 Capability statement (PDF) attached` }
}

export async function previewFollowUpEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.intro_email_message_id || !lead.intro_email_subject) return { error: 'Send the first email before following up.' }

  const { subject, bodyText } = followUpEmailContent({
    businessName: lead.business_name, contactName: lead.contact_name, suburb: lead.suburb,
  }, lead.intro_email_subject)
  return { to: lead.email, subject, body: bodyText }
}

export async function markIntroSmsSentAction(id: string, body?: string) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('comms').eq('id', id).single()
  const now = new Date().toISOString()
  const update: Record<string, any> = { intro_sms_sent_at: now }
  if (body) {
    update.comms = [...((lead?.comms as CommsEntry[]) ?? []), { kind: 'sms', at: now, body }]
  }
  await db.from('cold_leads').update(update).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}
