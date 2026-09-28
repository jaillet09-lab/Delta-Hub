import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendThreadedEmail, buildCapabilityAttachment } from '@/lib/emails/prospect-email'

export const runtime = 'nodejs'
export const maxDuration = 60

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

// Plain text → simple, safe HTML (escape, auto-link, paragraphs, <br/>).
function bodyTextToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const linkify = (s: string) => {
    let out = s.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+|portal\.deltacleaning\.com\.au\/[^\s<]+)/g, (m) => {
      const href = m.startsWith('http') ? m : `https://${m}`
      return `<a href="${href}" style="color:#1e3a5f;">${m.replace(/^https?:\/\//, '')}</a>`
    })
    out = out.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, (m) => `<a href="mailto:${m}" style="color:#1e3a5f;">${m}</a>`)
    return out
  }
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  const inner = blocks.map((b) => `<p>${linkify(esc(b)).replace(/\n/g, '<br/>')}</p>`).join('\n')
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.65;max-width:560px;">${inner}</div>`
}

// Send the drafted follow-up email + capability statement (PDF), always from
// hello@deltacleaning.com.au. Threads under the lead's existing email thread when
// there is one; otherwise it starts the thread and saves the Message-ID so future
// emails reply into the same conversation. Idempotent: only fires while
// follow_up_status is 'pending', then flips to 'sent'.
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { callId } = await req.json().catch(() => ({} as any))
  const db = createAdminClient() as any

  const { data: call } = await db.from('calls').select('*').eq('id', callId).maybeSingle()
  if (!call) return NextResponse.json({ ok: true, skipped: 'no call' })
  if (call.follow_up_status !== 'pending') return NextResponse.json({ ok: true, skipped: 'not pending' })
  if (!call.follow_up_body) {
    await db.from('calls').update({ follow_up_status: 'skipped', follow_up_error: 'no drafted body' }).eq('id', call.id)
    return NextResponse.json({ ok: true, skipped: 'no body' })
  }

  // Recipient + any existing email thread for this lead.
  const table = call.cold_lead_id ? 'cold_leads' : 'leads'
  const leadId = call.cold_lead_id || call.lead_id
  const emailCol = call.cold_lead_id ? 'email' : 'contact_email'
  const { data: lead } = await db
    .from(table)
    .select(`${emailCol}, business_name, intro_email_message_id, intro_email_subject`)
    .eq('id', leadId)
    .maybeSingle()

  const recipient: string | null = lead?.[emailCol] ?? null
  if (!recipient) {
    await db.from('calls').update({ follow_up_status: 'skipped', follow_up_error: 'no recipient email' }).eq('id', call.id)
    return NextResponse.json({ ok: true, skipped: 'no recipient' })
  }

  // Always attach the capability statement (rendered PDF). This is non-negotiable:
  // if the PDF fails to render we do NOT send — we leave the follow-up pending so
  // the safety cron retries, rather than let an email go out without it.
  const attachments = await buildCapabilityAttachment()
  if (!attachments || attachments.length === 0) {
    await db.from('calls').update({ follow_up_error: 'capability PDF not ready — will retry' }).eq('id', call.id)
    return NextResponse.json({ ok: false, retry: 'capability pdf not ready' }, { status: 503 })
  }

  // Reply into the existing thread if there is one; otherwise open a new thread we own.
  const existingThread = lead?.intro_email_message_id || null
  const newMessageId = existingThread ? undefined : `<call-${call.id}-${Date.now()}@deltacleaning.com.au>`
  const baseSubject = call.follow_up_subject || `Following up${lead?.business_name ? `, ${lead.business_name}` : ''}`
  const subject = existingThread
    ? ((lead?.intro_email_subject || baseSubject).startsWith('Re: ')
        ? (lead?.intro_email_subject || baseSubject)
        : `Re: ${lead?.intro_email_subject || baseSubject}`)
    : baseSubject

  const result = await sendThreadedEmail({
    to: recipient,
    subject,
    html: bodyTextToHtml(call.follow_up_body),
    inReplyTo: existingThread || undefined,
    messageId: newMessageId,
    attachments,
  })

  if (!result.success) {
    await db.from('calls').update({ follow_up_error: String(result.error ?? 'send failed').slice(0, 300) }).eq('id', call.id)
    return NextResponse.json({ error: result.error ?? 'send failed' }, { status: 500 })
  }

  await db.from('calls').update({ follow_up_status: 'sent', follow_up_sent_at: new Date().toISOString() }).eq('id', call.id)

  // If we started a new thread, remember it so later emails reply into it.
  if (newMessageId && leadId) {
    await db.from(table).update({ intro_email_message_id: newMessageId, intro_email_subject: subject }).eq('id', leadId)
  }

  return NextResponse.json({ ok: true, sent: true, threaded: !!existingThread })
}
