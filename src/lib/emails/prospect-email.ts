// Shared "prospect email" builders — the post-conversation capability-statement
// intro email and its light follow-up. Used by both the cold-call deck and the
// pipeline lead profile so the copy and sending behaviour stay identical.
// Plain module (not a server action file) so it can export helpers + constants.

import 'server-only'
import { DELTA_EMAIL_SIGNATURE } from '@/lib/emails/proposal-email-body'

const SIGNATURE = `
  <p style="margin-top: 24px;">
    Best Regards<br/>
    Jackson Jaillet<br/>
    Founder &amp; Director, Delta Cleaning<br/>
    <a href="tel:+61412844238" style="color: #1e3a5f;">0412 844 238</a><br/>
    <a href="https://www.deltacleaning.com.au" style="color: #1e3a5f;">www.deltacleaning.com.au</a>
  </p>`

// Plain-text sign-off (for the logged/preview copy), same content as SIGNATURE.
const SIGNATURE_TEXT = `\n\n${DELTA_EMAIL_SIGNATURE}`

export const EMAIL_WRAP = (inner: string) =>
  `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.65; max-width: 560px;">${inner}${SIGNATURE}</div>`

// The imported "suburb" field often holds a full street address. Only echo it
// back when it's a clean locality, otherwise keep it generic.
export function localityPhrase(suburb: string | null): string {
  if (!suburb) return ' in Brisbane'
  const s = suburb.trim()
  if (/\d/.test(s) || s.includes(',')) return ' in Brisbane'
  return ` around ${s}`
}

// Low-level threaded sender. Sets a Message-ID we control so a later follow-up
// can reference it (In-Reply-To / References) and land in the same email thread.
export async function sendThreadedEmail(opts: {
  to: string
  subject: string
  html: string
  messageId?: string
  inReplyTo?: string
  attachments?: { filename: string; content: Buffer }[]
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
      attachments: opts.attachments,
    })
    if (res.error) return { success: false, error: res.error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Email failed to send' }
  }
}

// Render the capability statement PDF as an attachment (best-effort — callers
// should still send if this returns undefined).
export async function buildCapabilityAttachment(): Promise<{ filename: string; content: Buffer }[] | undefined> {
  try {
    const React = (await import('react')).default
    const { renderDocumentPdf } = await import('@/lib/documents/pdf')
    const { CapabilityDocument } = await import('@/components/documents/render/CapabilityDocument')
    const { DEFAULT_CAPABILITY } = await import('@/lib/documents/capability')
    const pdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY as any }))
    return [{ filename: 'Delta Cleaning Capability Statement.pdf', content: pdf }]
  } catch {
    return undefined
  }
}

export interface Prospect { businessName: string; contactName: string | null; suburb: string | null }

// The intro email — subject, HTML body, plain-text body, all from one source.
export function introEmailContent(p: Prospect) {
  const firstName = (p.contactName || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const locality = localityPhrase(p.suburb)
  const subject = `Delta Cleaning capability statement for ${p.businessName}`
  const bodyText =
    `${greeting}\n\n` +
    `Thanks for taking my call earlier, great to chat. As promised, I've attached Delta Cleaning's capability statement so you can see exactly what we do.\n\n` +
    `We look after commercial cleaning for businesses${locality}: offices, clinics, retail and shared spaces, with reliable teams, fixed monthly pricing and no lock-in.\n\n` +
    `Have a look when you get a moment. If you think we can help in any way, feel free to call me directly on 0412 844 238, or just reply here and I'll set up a quick, free site visit.` +
    SIGNATURE_TEXT
  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>Thanks for taking my call earlier, great to chat. As promised, I've attached Delta Cleaning's capability statement so you can see exactly what we do.</p>
  <p>We look after commercial cleaning for businesses${locality}: offices, clinics, retail and shared spaces, with reliable teams, fixed monthly pricing and no lock-in.</p>
  <p>Have a look when you get a moment. If you think we can help in any way, feel free to call me directly on <a href="tel:+61412844238">0412 844 238</a>, or just reply here and I'll set up a quick, free site visit.</p>`)
  return { subject, html, bodyText }
}

// The light follow-up — threads under the intro's subject.
export function followUpEmailContent(p: Prospect, introSubject: string) {
  const firstName = (p.contactName || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const subject = introSubject.startsWith('Re: ') ? introSubject : `Re: ${introSubject}`
  const bodyText =
    `${greeting}\n\n` +
    `Just following up on my note below. I know things get busy.\n\n` +
    `The offer still stands: a free site visit of about fifteen minutes and a fixed monthly price, with no obligation. If you would like me to come past, just reply with a day that suits and I will make it work.` +
    SIGNATURE_TEXT
  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>Just following up on my note below. I know things get busy.</p>
  <p>The offer still stands: a free site visit of about fifteen minutes and a fixed monthly price, with no obligation. If you would like me to come past, just reply with a day that suits and I will make it work.</p>`)
  return { subject, html, bodyText }
}
