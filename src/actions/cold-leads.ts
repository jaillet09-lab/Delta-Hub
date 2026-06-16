'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

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
  intro_email_sent_at: string | null
  intro_email_message_id: string | null
  intro_email_subject: string | null
  follow_up_email_sent_at: string | null
  intro_sms_sent_at: string | null
  comms: CommsEntry[]
  notes: string | null
  created_at: string
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

export async function importColdLeadsAction(csvText: string) {
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { error: 'Could not find any rows. Paste the CSV including the header row.' }

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const col = {
    business: detectColumn(headers, ['business', 'company', 'name of business', 'organisation', 'organization']),
    contact:  detectColumn(headers, ['contact', 'owner', 'first name', 'full name', 'person']),
    phone:    detectColumn(headers, ['phone', 'mobile', 'number', 'tel']),
    email:    detectColumn(headers, ['email', 'e-mail']),
    suburb:   detectColumn(headers, ['suburb', 'city', 'location', 'area', 'address']),
    industry: detectColumn(headers, ['industry', 'category', 'type', 'niche']),
  }
  // If no obvious business column, fall back to a generic "name" column
  if (col.business === -1) col.business = detectColumn(headers, ['name'])
  if (col.business === -1) return { error: `Couldn't find a business name column. Found columns: ${headers.join(', ')}` }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() || null : null)

  const leads = rows.slice(1)
    .map(r => ({
      business_name: get(r, col.business),
      contact_name:  get(r, col.contact),
      phone:         get(r, col.phone),
      email:         get(r, col.email),
      suburb:        get(r, col.suburb),
      industry:      get(r, col.industry),
    }))
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

  const { data: lead } = await db.from('cold_leads').select('call_count').eq('id', id).single()
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
  if (note !== undefined) update.follow_up_note = note || null

  const { error } = await db.from('cold_leads').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calls')
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
// These are only sent after you've actually spoken with the lead and they've
// asked for something in writing. Plain, human copy — no marketing fluff.

const SIGNATURE = `
  <p style="margin-top: 24px;">
    Jackson<br/>
    Delta Cleaning · Brisbane<br/>
    <a href="mailto:hello@deltacleaning.com.au" style="color: #1e3a5f;">hello@deltacleaning.com.au</a>
  </p>`

const EMAIL_WRAP = (inner: string) =>
  `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.65; max-width: 560px;">${inner}${SIGNATURE}</div>`

// The imported "suburb" field often holds a full street address. Only echo it
// back when it's a clean locality, otherwise keep it generic.
function localityPhrase(suburb: string | null): string {
  if (!suburb) return ' in Brisbane'
  const s = suburb.trim()
  if (/\d/.test(s) || s.includes(',')) return ' in Brisbane'
  return ` around ${s}`
}

// Low-level threaded sender. Sets a Message-ID we control so a later follow-up
// can reference it (In-Reply-To / References) and land in the same email thread.
async function sendThreadedEmail(opts: {
  to: string
  subject: string
  html: string
  messageId?: string
  inReplyTo?: string
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'Email is not configured.' }

  const headers: Record<string, string> = {}
  if (opts.messageId) headers['Message-ID'] = opts.messageId
  if (opts.inReplyTo) {
    headers['In-Reply-To'] = opts.inReplyTo
    headers['References']  = opts.inReplyTo
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const res = await resend.emails.send({
      from: 'Jackson at Delta Cleaning <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      headers: Object.keys(headers).length ? headers : undefined,
    })
    if (res.error) return { success: false, error: res.error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Email failed to send' }
  }
}

export async function sendIntroEmailAction(id: string) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.has_spoken) return { error: 'Only send this once you’ve spoken with them on the phone.' }

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const locality = localityPhrase(lead.suburb)

  // A Message-ID we own, so the follow-up can thread under this email
  const messageId = `<intro-${id}-${Date.now()}@deltacleaning.com.au>`
  const subject = `Delta Cleaning — ${lead.business_name}`

  const bodyText =
    `${greeting}\n\n` +
    `Great to chat just now — thanks for taking my call. As promised, here's a quick note from Delta Cleaning.\n\n` +
    `We look after commercial cleaning for businesses${locality} — offices, clinics, retail and shared spaces.\n\n` +
    `Whenever suits, I'd be glad to come past, walk the site with you and put a fixed monthly price on it. The walk-through is free, takes about fifteen minutes, and there's no obligation.\n\n` +
    `Just reply here and we'll lock in a time that works for you.\n\n— Jackson, Delta Cleaning`

  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>Great to chat just now — thanks for taking my call. As promised, here’s a quick note from Delta Cleaning.</p>
  <p>We look after commercial cleaning for businesses${locality} — offices, clinics, retail and shared spaces.</p>
  <p>Whenever suits, I’d be glad to come past, walk the site with you and put a fixed monthly price on it. The walk-through is free, takes about fifteen minutes, and there’s no obligation.</p>
  <p>Just reply here and we’ll lock in a time that works for you.</p>`)

  const result = await sendThreadedEmail({ to: lead.email, subject, html, messageId })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  const comms: CommsEntry[] = [...(lead.comms ?? []), { kind: 'email', at: now, subject, body: bodyText }]
  await db.from('cold_leads').update({
    intro_email_sent_at: now,
    intro_email_message_id: messageId,
    intro_email_subject: subject,
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

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  // "Re:" + the original subject + the original Message-ID = same Gmail thread
  const subject = lead.intro_email_subject.startsWith('Re: ')
    ? lead.intro_email_subject
    : `Re: ${lead.intro_email_subject}`

  const bodyText =
    `${greeting}\n\n` +
    `Just following up on my note below — I know things get busy.\n\n` +
    `The offer still stands: a free 15-minute walk-through and a fixed monthly price, no obligation. If you'd like me to come past, just reply with a day that suits and I'll make it work.\n\n— Jackson, Delta Cleaning`

  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>Just following up on my note below — I know things get busy.</p>
  <p>The offer still stands: a free 15-minute walk-through and a fixed monthly price, no obligation. If you’d like me to come past, just reply with a day that suits and I’ll make it work.</p>`)

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
