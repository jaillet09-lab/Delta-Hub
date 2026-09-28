import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { twilioEnv, readTwilioBody, twimlResponse, appUrl, normaliseAU, validateTwilioSignature } from '@/lib/twilio'

export const runtime = 'nodejs'

const last9 = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-9)

// Inbound calls to the Delta number. Match the caller to a lead/cold-lead, log
// the call, push an "incoming" alert, then ring the in-app dialer AND the owner's
// mobile in parallel (whichever answers first), recording the whole thing.
export async function POST(req: Request) {
  const b = await readTwilioBody(req)
  const e = twilioEnv()
  const VoiceResponse = twilio.twiml.VoiceResponse

  // Reject spoofed webhooks once the account is wired up.
  if (e.authToken && !validateTwilioSignature(req.headers.get('x-twilio-signature'), `${appUrl()}/api/twilio/inbound`, b)) {
    const vr = new VoiceResponse(); vr.reject()
    return twimlResponse(vr.toString())
  }

  const from = normaliseAU(b.From)
  const callSid = b.CallSid || null
  const tail = last9(from)
  const db = createAdminClient() as any

  let leadId: string | null = null
  let coldLeadId: string | null = null
  let name = from || 'Unknown number'

  if (tail) {
    const { data: leads } = await db.from('leads').select('id, business_name, contact_phone').not('contact_phone', 'is', null)
    const lm = (leads || []).find((l: any) => last9(normaliseAU(l.contact_phone)) === tail)
    if (lm) { leadId = lm.id; name = lm.business_name }
    if (!lm) {
      const { data: cls } = await db.from('cold_leads').select('id, business_name, phone').not('phone', 'is', null)
      const cm = (cls || []).find((c: any) => last9(normaliseAU(c.phone)) === tail)
      if (cm) { coldLeadId = cm.id; name = cm.business_name }
    }
  }

  // Unknown number → create a cold lead marked inbound so nothing is lost.
  if (!leadId && !coldLeadId) {
    try {
      const { data: created } = await db.from('cold_leads').insert({ business_name: 'Inbound (unmatched)', phone: from }).select('id').single()
      coldLeadId = created?.id ?? null
    } catch { /* still connect the call even if we can't create the lead */ }
  }

  try {
    if (leadId || coldLeadId) {
      await db.from('calls').insert({
        lead_id: leadId, cold_lead_id: coldLeadId,
        direction: 'inbound', from_number: from, to_number: e.callerId,
        twilio_call_sid: callSid, started_at: new Date().toISOString(), status: 'in_progress',
      })
      const tbl = leadId ? 'leads' : 'cold_leads'
      const id = leadId || coldLeadId
      const { data: cur } = await db.from(tbl).select('call_count').eq('id', id).maybeSingle()
      await db.from(tbl).update({ call_count: (cur?.call_count ?? 0) + 1, last_called_at: new Date().toISOString() }).eq('id', id)
    }
  } catch { /* logging must never block the call */ }

  const targetUrl = leadId ? `/leads/${leadId}` : coldLeadId ? `/calls?lead=${coldLeadId}` : '/calls'
  sendPushToRole('admin', { title: `📞 Incoming — ${name}`, body: from ? `Call from ${from}` : 'Incoming call', url: targetUrl }).catch(() => {})

  const vr = new VoiceResponse()
  const dial = vr.dial({
    answerOnBridge: true,
    record: 'record-from-answer-dual',
    recordingStatusCallback: `${appUrl()}/api/twilio/recording`,
    recordingStatusCallbackEvent: ['completed'],
    action: `${appUrl()}/api/twilio/status`,
    timeout: 25,
  } as any)
  dial.client(e.identity)
  if (e.forwardTo) dial.number(e.forwardTo)
  return twimlResponse(vr.toString())
}
