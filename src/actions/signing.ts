'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { withAgreementDefaults, type AgreementData } from '@/lib/documents/agreement'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.deltacleaning.com.au'
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
  }).eq('id', id)
  if (error) return { error: error.message }

  const link = `${APP_URL}/sign/${code}`
  const res = await sendEmail(
    email,
    `Your Delta Cleaning service agreement — ready to sign`,
    inviteEmail(agreement, link, message),
  )
  if (!res.success) return { error: res.error ?? 'Could not send the email. Please try again.' }

  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true, link }
}

// ─── Client submits their signature from the public /sign/<token> page ─────────
export async function submitSignatureAction(code: string, typedName: string) {
  const name = (typedName ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2) return { error: 'Please type your full name to sign.' }

  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, status, signed_at, data, client_id')
    .eq('sign_code', code).maybeSingle()
  if (!doc) return { error: 'This signing link is not valid.' }
  if (doc.signed_at) return { success: true, alreadySigned: true, date: auDate(doc.signed_at) }

  const h = headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
  const signedAt = new Date().toISOString()

  const { error } = await db.from('proposal_documents').update({
    signed_name: name, signed_at: signedAt, signed_ip: ip, status: 'signed',
  }).eq('id', doc.id)
  if (error) return { error: error.message }

  // Notify the owner — push + email (best-effort; never block the signer on these).
  const agreement = withAgreementDefaults(doc.data)
  sendPushToRole('admin', {
    title: `${agreement.clientName} signed the agreement`,
    body:  `${name} · ${agreement.serviceFee}`,
    url:   `/documents/${doc.id}`,
  }).catch(() => {})
  sendEmail(OWNER_EMAIL, `Signed — ${agreement.clientName}`, signedOwnerEmail(agreement, name, signedAt, doc.id)).catch(() => {})

  revalidatePath('/documents'); revalidatePath(`/documents/${doc.id}`)
  if (doc.client_id) revalidatePath(`/clients/${doc.client_id}`)
  return { success: true, date: auDate(signedAt) }
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

// ─── Email templates ───────────────────────────────────────────────────────────

function inviteEmail(a: AgreementData, link: string, message?: string): string {
  const note = (message ?? '').trim()
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 18px;color:#0f172a;">
    <div style="background:#0b1320;border-radius:14px 14px 0 0;padding:26px 30px;text-align:center;">
      <img src="${WORDMARK}" alt="Delta Cleaning" style="height:26px;width:auto;" />
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:30px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#2563eb;margin:0 0 10px;">Service Agreement</p>
      <h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;color:#0f172a;">Hi ${a.clientName}, your agreement is ready to sign.</h1>
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
        ${note ? note.replace(/</g, '&lt;') + '<br/><br/>' : ''}
        We've prepared your commercial cleaning service agreement. You can read it in full and sign it securely online — it only takes a minute, no account or app needed.
      </p>
      <div style="background:#f8fafc;border:1px solid #eef2f6;border-radius:12px;padding:16px 18px;margin:0 0 22px;">
        <table style="width:100%;font-size:13px;color:#334155;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#94a3b8;">Site</td><td style="padding:4px 0;text-align:right;font-weight:600;">${a.premises}</td></tr>
          <tr><td style="padding:4px 0;color:#94a3b8;">Frequency</td><td style="padding:4px 0;text-align:right;font-weight:600;">${a.frequency}</td></tr>
          <tr><td style="padding:4px 0;color:#94a3b8;">Service fee</td><td style="padding:4px 0;text-align:right;font-weight:600;">${a.serviceFee}</td></tr>
        </table>
      </div>
      <a href="${link}" style="display:block;text-align:center;background:#0b1320;color:#fff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;padding:15px 22px;">Review &amp; sign your agreement →</a>
      <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center;">Or paste this link into your browser:<br/><span style="color:#64748b;word-break:break-all;">${link}</span></p>
      <div style="border-top:1px solid #f1f5f9;margin-top:24px;padding-top:18px;">
        <p style="font-size:13px;color:#475569;margin:0 0 4px;">Any questions before you sign? Just reply, or reach ${a.contactName} directly:</p>
        <p style="font-size:13px;color:#0f172a;font-weight:600;margin:0;">${a.contactPhone} · ${a.contactEmail}</p>
      </div>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:16px 0 0;text-align:center;">Sent by Delta Cleaning Pty Ltd · Brisbane, QLD · This link is unique to you.</p>
  </div>`
}

function signedOwnerEmail(a: AgreementData, name: string, signedAtIso: string, docId: string): string {
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
      <a href="${APP_URL}/documents/${docId}" style="display:inline-block;margin-top:18px;background:#0b1320;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">View the signed agreement →</a>
    </div>
  </div>`
}
