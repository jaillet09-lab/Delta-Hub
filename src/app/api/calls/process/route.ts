import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { transcribeRecording, analyzeCall, type LeadContext } from '@/lib/call-analysis'
import { enqueue } from '@/lib/qstash'
import { appUrl } from '@/lib/twilio'

export const runtime = 'nodejs'
export const maxDuration = 300

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

// Transcribe + analyse one recorded call, store the results, and (if the prospect
// asked for info) draft the follow-up and schedule it for 5 minutes' time.
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))
  const db = createAdminClient() as any

  const { data: call } = body.callId
    ? await db.from('calls').select('*').eq('id', body.callId).maybeSingle()
    : await db.from('calls').select('*').eq('twilio_call_sid', body.callSid).maybeSingle()

  if (!call) return NextResponse.json({ ok: true, skipped: 'no call' })
  if (!call.recording_path) {
    await db.from('calls').update({ status: 'completed' }).eq('id', call.id)
    return NextResponse.json({ ok: true, skipped: 'no recording' })
  }
  if (call.transcript) return NextResponse.json({ ok: true, skipped: 'already processed' })

  // Who was on the call + where the follow-up would go.
  const lead: LeadContext = { contactName: null, businessName: null, role: null }
  let recipient: string | null = null
  if (call.cold_lead_id) {
    const { data: l } = await db.from('cold_leads').select('contact_name, business_name, email, role').eq('id', call.cold_lead_id).maybeSingle()
    if (l) { lead.contactName = l.contact_name; lead.businessName = l.business_name; lead.role = l.role; recipient = l.email }
  } else if (call.lead_id) {
    const { data: l } = await db.from('leads').select('contact_name, business_name, contact_email').eq('id', call.lead_id).maybeSingle()
    if (l) { lead.contactName = l.contact_name; lead.businessName = l.business_name; recipient = l.contact_email }
  }

  try {
    const transcript = await transcribeRecording(call.recording_path)
    const analysis = transcript ? await analyzeCall(transcript, lead) : null

    const patch: Record<string, any> = { status: 'completed' }
    if (transcript) patch.transcript = transcript
    if (analysis) {
      patch.summary = analysis.summary
      patch.outcome = analysis.outcome
      patch.next_step = analysis.next_step
      patch.details = analysis.details
    }

    if (analysis?.wants_info_email && recipient) {
      patch.follow_up_status = 'pending'
      patch.follow_up_scheduled_at = new Date(Date.now() + 5 * 60_000).toISOString()
      patch.follow_up_subject = analysis.email_subject || `Following up${lead.businessName ? `, ${lead.businessName}` : ''}`
      patch.follow_up_body = analysis.email_body
    } else if (analysis?.wants_info_email && !recipient) {
      patch.follow_up_status = 'skipped'
      patch.follow_up_error = 'lead has no email address'
    }

    await db.from('calls').update(patch).eq('id', call.id)

    // Precise 5-minute delivery via QStash; the safety cron is the fallback.
    if (patch.follow_up_status === 'pending') {
      await enqueue(`${appUrl()}/api/calls/send-followup`, { callId: call.id }, { delaySeconds: 300 })
    }
    return NextResponse.json({ ok: true, outcome: patch.outcome ?? null, followUp: patch.follow_up_status ?? null })
  } catch (e: any) {
    await db.from('calls').update({ status: 'failed', follow_up_error: String(e?.message ?? 'processing failed').slice(0, 300) }).eq('id', call.id)
    return NextResponse.json({ error: e?.message ?? 'processing failed' }, { status: 500 })
  }
}
