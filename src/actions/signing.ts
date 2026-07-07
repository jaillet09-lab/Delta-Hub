'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { withAgreementDefaults, type AgreementData } from '@/lib/documents/agreement'

// The client-facing signing link MUST use the branded public domain — never a
// bare *.vercel.app alias (which may 404 or sit behind Vercel auth). Pinned so a
// misconfigured NEXT_PUBLIC_APP_URL can't break every client's link.
const APP_URL = 'https://portal.deltacleaning.com.au'
const OWNER_EMAIL = 'hello@deltacleaning.com.au'
const WORDMARK = `${APP_URL}/proposal-assets/wordmark-white.png`

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Unambiguous lowercase alphabet (no 0/o/1/l/i) for the random suffix.
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

/** Display date like "3 July 2026" in Brisbane time. */
function auDate(iso?: string): string {
  return new Date(iso ?? Date.now()).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  })
}

/** Friendly, unguessable link code, e.g. "northpoint-commercial-k7m2qp". */
function makeSignCode(clientName: string): string {
  const slug = (clientName || 'agreement')
    .toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 24).replace(/-$/, '')
  let rand = ''
  for (let i = 0; i < 6; i++) rand += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return `${slug || 'agreement'}-${rand}`
}

/** Generate a sign_code that isn't already taken (collisions are near-impossible; retry to be safe). */
async function uniqueSignCode(db: any, clientName: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeSignCode(clientName)
    const { data: clash } = await db.from('proposal_documents').select('id').eq('sign_code', code).maybeSingle()
    if (!clash) return code
  }
  return `${makeSignCode(clientName)}-${Date.now().toString(36)}`
}

// ─── Issue the agreement for signature: mint a unique link + email the client ──
export async function sendForSignatureAction(id: string, toEmail: string, message?: string) {
  const email = (toEmail ?? '').trim()
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, sign_code, data')
    .eq('id', id).single()
  if (!doc) return { error: 'Document not found.' }
  if (doc.kind !== 'agreement') return { error: 'Only service agreements can be sent for signature.' }

  const agreement = withAgreementDefaults(doc.data)
  // Reuse an existing code so a re-send keeps the same link.
  const code: string = doc.sign_code ?? await uniqueSignCode(db, agreement.clientName)

  const { error } = await db.from('proposal_documents').update({
    sign_code:    code,
    signer_email: email,
    status:       'out_for_signature',
    sent_at:      new Date().toISOString(),
    // The agreement is dated the day it's issued.
    data:         { ...(doc.data ?? {}), agreementDate: auDate() },
  }).eq('id', id)
  if (error) return { error: error.message }

  const link = `${APP_URL}/sign/${code}`
  const res = await sendEmail(
    email,
    `Your Delta Cleaning service agreement is ready to sign`,
    inviteEmail(agreement, link, message),
  )
  if (!res.success) return { error: res.error ?? 'Could not send the email. Please try again.' }

  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true, link }
}

// Best-effort parsers for turning agreement particulars into client fields on sign.
function parseMoney(s?: string): number | null {
  if (!s) return null
  const n = parseFloat(String(s).replace(/,/g, '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}
function parseDateLoose(s?: string): string | null {
  const v = (s ?? '').trim()
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}
function parseAddress(premises?: string): { address: string | null; suburb: string | null; state: string | null; postcode: string | null } {
  const p = (premises ?? '').trim()
  if (!p || /multiple sites/i.test(p)) return { address: null, suburb: null, state: null, postcode: null }
  const m = p.match(/^(.*?),\s*([A-Za-z .'-]+?)\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+(\d{4})\s*$/i)
  if (m) return { address: m[1].trim(), suburb: m[2].trim(), state: m[3].toUpperCase(), postcode: m[4] }
  const m2 = p.match(/^(.*?)\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+(\d{4})\s*$/i)
  if (m2) return { address: m2[1].trim(), suburb: null, state: m2[2].toUpperCase(), postcode: m2[3] }
  return { address: p, suburb: null, state: null, postcode: null }
}

// ─── Client submits their signature (+ optional onboarding details) ────────────
export interface SignerDetails {
  abn?: string
  billingEmail?: string
  poNumber?: string
  siteContactName?: string
  siteContactPhone?: string
  notes?: string
}

export async function submitSignatureAction(code: string, typedName: string, details?: SignerDetails) {
  const name = (typedName ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { error: 'Please type your full name to sign.' }

  const clean = (v?: string) => (v ?? '').trim() || null
  const d = {
    abn: clean(details?.abn), billingEmail: clean(details?.billingEmail), poNumber: clean(details?.poNumber),
    siteContactName: clean(details?.siteContactName), siteContactPhone: clean(details?.siteContactPhone),
    notes: clean(details?.notes),
  }

  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, status, signed_at, data, client_id, signer_email')
    .eq('sign_code', code).maybeSingle()
  if (!doc) return { error: 'This signing link is not valid.' }
  if (doc.signed_at) return { success: true, alreadySigned: true, date: auDate(doc.signed_at) }

  const h = headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  const signedAt = new Date().toISOString()

  // The ABN the client typed goes onto the contract itself.
  const newData = d.abn ? { ...(doc.data ?? {}), clientABN: d.abn } : doc.data

  const { error } = await db.from('proposal_documents').update({
    signed_name: name, signed_at: signedAt, signed_ip: ip, status: 'signed',
    onboarding: d, data: newData,
  }).eq('id', doc.id)
  if (error) return { error: error.message }

  const agreement = withAgreementDefaults(newData)

  // Onboarding-on-sign: if the agreement isn't linked to a client yet, create the
  // client profile from the agreement (or link to an existing client of the same
  // name). Anything we can't read reliably is left blank for the owner to fill.
  let clientId: string | null = doc.client_id
  let createdNewClient = false
  if (!clientId) {
    const { data: existing } = await db.from('clients')
      .select('id, abn, billing_email, po_number, site_contact_name, site_contact_phone')
      .ilike('business_name', agreement.clientName).limit(1).maybeSingle()
    if (existing?.id) {
      clientId = existing.id
      // Fill only the fields the existing client is missing — never clobber.
      await db.from('clients').update({
        abn:                existing.abn                ?? d.abn,
        billing_email:      existing.billing_email      ?? d.billingEmail,
        po_number:          existing.po_number          ?? d.poNumber,
        site_contact_name:  existing.site_contact_name  ?? d.siteContactName,
        site_contact_phone: existing.site_contact_phone ?? d.siteContactPhone,
      }).eq('id', clientId)
    } else {
      const addr = parseAddress(agreement.premises)
      const monthly = parseMoney(agreement.serviceFee)
      const { data: newClient } = await db.from('clients').insert({
        business_name: agreement.clientName,
        address: addr.address, suburb: addr.suburb, state: addr.state, postcode: addr.postcode,
        contact_name: name, contact_email: doc.signer_email || null,
        monthly_value: monthly,
        annual_value: monthly != null ? Math.round(monthly * 12 * 100) / 100 : null,
        start_date: parseDateLoose(agreement.commencementDate),
        abn: d.abn, billing_email: d.billingEmail, po_number: d.poNumber,
        site_contact_name: d.siteContactName, site_contact_phone: d.siteContactPhone,
        notes: d.notes,
        active: true, is_multi_site: false, service_type: [],
      }).select('id').single()
      clientId = newClient?.id ?? null
      createdNewClient = !!clientId
    }
    if (clientId) await db.from('proposal_documents').update({ client_id: clientId }).eq('id', doc.id)
  }

  // Notify the owner — push + email (best-effort; never block the signer on these).
  const ownerUrl = clientId ? `/clients/${clientId}` : `/documents/${doc.id}`
  sendPushToRole('admin', {
    title: `${agreement.clientName} signed the agreement`,
    body:  createdNewClient ? 'New client profile created — review it' : `${name} · ${agreement.serviceFee}`,
    url:   ownerUrl,
  }).catch(() => {})
  sendEmail(OWNER_EMAIL, `Signed — ${agreement.clientName}`, signedOwnerEmail(agreement, name, signedAt, doc.id, createdNewClient ? clientId : null)).catch(() => {})

  revalidatePath('/documents'); revalidatePath(`/documents/${doc.id}`); revalidatePath('/clients')
  if (clientId) revalidatePath(`/clients/${clientId}`)
  return { success: true, date: auDate(signedAt) }
}

// ─── Onboarding: the client submits a few details AFTER signing ────────────────
// The ABN is stamped onto the (already-signed) contract, and all details fill the
// linked client's empty fields (never clobbering what's already there).
export async function submitOnboardingAction(code: string, details: SignerDetails) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents')
    .select('id, data, client_id').eq('sign_code', code).maybeSingle()
  if (!doc) return { error: 'This link is not valid.' }

  const clean = (v?: string) => (v ?? '').trim() || null
  const d = {
    abn: clean(details.abn), billingEmail: clean(details.billingEmail), poNumber: clean(details.poNumber),
    siteContactName: clean(details.siteContactName), siteContactPhone: clean(details.siteContactPhone), notes: clean(details.notes),
  }
  const newData = d.abn ? { ...(doc.data ?? {}), clientABN: d.abn } : doc.data
  await db.from('proposal_documents').update({ onboarding: d, data: newData }).eq('id', doc.id)

  if (doc.client_id) {
    const { data: c } = await db.from('clients')
      .select('abn, billing_email, po_number, site_contact_name, site_contact_phone, notes')
      .eq('id', doc.client_id).maybeSingle()
    if (c) {
      await db.from('clients').update({
        abn:                c.abn                ?? d.abn,
        billing_email:      c.billing_email      ?? d.billingEmail,
        po_number:          c.po_number          ?? d.poNumber,
        site_contact_name:  c.site_contact_name  ?? d.siteContactName,
        site_contact_phone: c.site_contact_phone ?? d.siteContactPhone,
        notes:              c.notes              ?? d.notes,
      }).eq('id', doc.client_id)
    }
    revalidatePath(`/clients/${doc.client_id}`)
  }
  revalidatePath('/documents'); revalidatePath(`/documents/${doc.id}`)
  return { success: true }
}

// ─── Ensure a signing link exists (backs the editor's "Copy signing link") ─────
// Idempotent: mints a sign_code once so the /sign/<code> link is ready to copy,
// without emailing or changing the document's status.
export async function ensureSignCode(id: string): Promise<string | null> {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, sign_code, data')
    .eq('id', id).maybeSingle()
  if (!doc || doc.kind !== 'agreement') return null
  if (doc.sign_code) return doc.sign_code
  const agreement = withAgreementDefaults(doc.data)
  const code = await uniqueSignCode(db, agreement.clientName)
  await db.from('proposal_documents').update({ sign_code: code }).eq('id', id)
  return code
}

// Stamp the agreement with today's date when it's issued via the copy-link path.
export async function stampIssueDateAction(id: string): Promise<{ date: string } | { error: string }> {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('data, status').eq('id', id).maybeSingle()
  if (!doc) return { error: 'Document not found.' }
  const date = auDate()
  const patch: any = { data: { ...(doc.data ?? {}), agreementDate: date } }
  if (doc.status === 'draft') patch.status = 'out_for_signature'
  await db.from('proposal_documents').update(patch).eq('id', id)
  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { date }
}

// ─── Email templates ───────────────────────────────────────────────────────────

function inviteEmail(a: AgreementData, link: string, message?: string): string {
  const note = (message ?? '').trim()
  const first = a.clientName?.trim() || 'there'
  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr>
          <td style="padding:12px 0;color:#94a3b8;font-size:13px;border-top:1px solid #f1f5f9;">${label}</td>
          <td style="padding:12px 0;text-align:right;font-weight:600;color:#0f172a;font-size:13px;border-top:1px solid #f1f5f9;">${value}</td>
        </tr>`
      : ''
  const summary = [row('Site', a.premises), row('Frequency', a.frequency), row('Service fee', a.serviceFee)].join('')
  return `
  <div style="background:#eef1f5;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.10);">
      <div style="background:#0b1320;padding:30px 30px 26px;text-align:center;">
        <img src="${WORDMARK}" alt="Delta Cleaning" style="height:26px;width:auto;" />
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#2563eb,#60a5fa);line-height:4px;font-size:0;">&nbsp;</div>
      <div style="padding:34px 34px 30px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#2563eb;margin:0 0 12px;">Service Agreement${a.agreementRef ? ` &middot; ${a.agreementRef}` : ''}</p>
        <h1 style="font-size:25px;line-height:1.22;margin:0 0 12px;color:#0f172a;font-weight:800;letter-spacing:-.01em;">Hi ${first}, you&rsquo;re ready to sign.</h1>
        <p style="font-size:14.5px;line-height:1.65;color:#475569;margin:0 0 ${note ? '18px' : '26px'};">
          We&rsquo;ve prepared your commercial cleaning service agreement. Give it a read, and when you&rsquo;re happy, sign securely online &mdash; it takes about a minute, with no account or app to download.
        </p>
        ${note ? `<div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:8px;padding:13px 16px;margin:0 0 26px;font-size:14px;color:#334155;line-height:1.55;">${note.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</div>` : ''}
        ${summary ? `<div style="border:1px solid #eef2f6;border-radius:14px;padding:2px 18px 10px;margin:0 0 28px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:16px 0 2px;">Summary</p>
          <table style="width:100%;border-collapse:collapse;">${summary}</table>
        </div>` : ''}
        <a href="${link}" style="display:block;text-align:center;background:#0b1320;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;padding:18px 24px;">Review &amp; sign &rarr;</a>
        <p style="text-align:center;font-size:12px;color:#94a3b8;margin:14px 0 0;">&#128274;&nbsp; Secure &middot; unique to you &middot; no account needed</p>
        <p style="text-align:center;font-size:11.5px;color:#cbd5e1;margin:10px 0 0;">Button not working? Paste this: <span style="color:#94a3b8;word-break:break-all;">${link}</span></p>
        <div style="border-top:1px solid #f1f5f9;margin-top:28px;padding-top:22px;">
          <p style="font-size:13.5px;color:#475569;margin:0 0 6px;line-height:1.5;">Questions before you sign? Reply to this email, or reach ${a.contactName} directly:</p>
          <p style="font-size:13.5px;color:#0f172a;font-weight:600;margin:0;">${a.contactPhone} &nbsp;&middot;&nbsp; ${a.contactEmail}</p>
        </div>
      </div>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:18px auto 0;text-align:center;max-width:560px;line-height:1.7;">
      Delta Cleaning Pty Ltd &middot; ABN 83 303 026 478 &middot; Brisbane QLD<br/>
      This signing link is unique to you &mdash; please don&rsquo;t forward it.
    </p>
  </div>`
}

function signedOwnerEmail(a: AgreementData, name: string, signedAtIso: string, docId: string, newClientId?: string | null): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 18px;color:#0f172a;">
    <div style="background:#0b1320;border-radius:12px 12px 0 0;padding:22px 26px;">
      <p style="margin:0;color:#86efac;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Delta Cleaning · Signed</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">${a.clientName} signed the agreement</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:26px;">
      <table style="width:100%;font-size:13.5px;color:#334155;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Signed by</td><td style="padding:6px 0;text-align:right;font-weight:600;">${name}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">When</td><td style="padding:6px 0;text-align:right;font-weight:600;">${auDate(signedAtIso)}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Service fee</td><td style="padding:6px 0;text-align:right;font-weight:600;">${a.serviceFee}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Site</td><td style="padding:6px 0;text-align:right;font-weight:600;">${a.premises}</td></tr>
      </table>
      ${newClientId ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-top:18px;font-size:13px;color:#166534;line-height:1.5;">
        <strong>New client profile created</strong> from this agreement. A few fields (cleaner cost, exact schedule, scope) need finishing — open the profile to complete it.
      </div>
      <a href="${APP_URL}/clients/${newClientId}" style="display:inline-block;margin-top:14px;background:#0b1320;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">Open the client profile →</a>`
      : `<a href="${APP_URL}/documents/${docId}" style="display:inline-block;margin-top:18px;background:#0b1320;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">View the signed agreement →</a>`}
    </div>
  </div>`
}
