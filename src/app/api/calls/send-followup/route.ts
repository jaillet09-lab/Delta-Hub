import { NextResponse } from 'next/server'
import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { DEFAULT_CAPABILITY } from '@/lib/documents/capability'

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

// Send the drafted follow-up email + capability statement. Idempotent: only fires
// when the call's follow_up_status is still 'pending', then flips it to 'sent', so
// QStash and the safety cron can't double-send.
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

  // Recipient
  let recipient: string | null = null
  let company: string | null = null
  if (call.cold_lead_id) {
    const { data: l } = await db.from('cold_leads').select('email, business_name').eq('id', call.cold_lead_id).maybeSingle()
    recipient = l?.email ?? null; company = l?.business_name ?? null
  } else if (call.lead_id) {
    const { data: l } = await db.from('leads').select('contact_email, business_name').eq('id', call.lead_id).maybeSingle()
    recipient = l?.contact_email ?? null; company = l?.business_name ?? null
  }
  if (!recipient) {
    await db.from('calls').update({ follow_up_status: 'skipped', follow_up_error: 'no recipient email' }).eq('id', call.id)
    return NextResponse.json({ ok: true, skipped: 'no recipient' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  // Always attach the capability statement to the intro follow-up.
  const attachments: { filename: string; content: Buffer }[] = []
  try {
    const cap = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY }))
    attachments.push({ filename: 'Delta Cleaning Capability Statement.pdf', content: cap })
  } catch { /* send without it rather than not at all */ }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const res = await resend.emails.send({
      from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      bcc: 'hello@deltacleaning.com.au',
      to: recipient,
      subject: call.follow_up_subject || `Following up${company ? `, ${company}` : ''}`,
      html: bodyTextToHtml(call.follow_up_body),
      attachments,
    })
    if (res.error) {
      await db.from('calls').update({ follow_up_error: String(res.error.message).slice(0, 300) }).eq('id', call.id)
      return NextResponse.json({ error: res.error.message }, { status: 500 })
    }
  } catch (e: any) {
    await db.from('calls').update({ follow_up_error: String(e?.message ?? 'send failed').slice(0, 300) }).eq('id', call.id)
    return NextResponse.json({ error: e?.message ?? 'send failed' }, { status: 500 })
  }

  await db.from('calls').update({ follow_up_status: 'sent', follow_up_sent_at: new Date().toISOString() }).eq('id', call.id)
  return NextResponse.json({ ok: true, sent: true })
}
