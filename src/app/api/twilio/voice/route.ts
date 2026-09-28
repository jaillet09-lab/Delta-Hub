import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { twilioEnv, readTwilioBody, twimlResponse, appUrl, normaliseAU } from '@/lib/twilio'

export const runtime = 'nodejs'

// TwiML App "Voice Request URL": handles OUTBOUND calls placed from the browser
// dialer. The client passes To + leadId/coldLeadId; we log the call, then dial
// the number from the Delta caller ID with dual-channel recording.
export async function POST(req: Request) {
  const b = await readTwilioBody(req)
  const e = twilioEnv()
  const to = normaliseAU(b.To || b.to)
  const leadId = b.leadId || null
  const coldLeadId = b.coldLeadId || null
  const callSid = b.CallSid || null

  const VoiceResponse = twilio.twiml.VoiceResponse
  const vr = new VoiceResponse()

  if (!to || !e.callerId) {
    vr.say('Sorry, this call could not be connected.')
    return twimlResponse(vr.toString())
  }

  try {
    const db = createAdminClient() as any
    if (leadId || coldLeadId) {
      await db.from('calls').insert({
        lead_id: leadId, cold_lead_id: coldLeadId,
        direction: 'outbound', from_number: e.callerId, to_number: to,
        twilio_call_sid: callSid, started_at: new Date().toISOString(), status: 'in_progress',
      })
      const tbl = leadId ? 'leads' : 'cold_leads'
      const id = leadId || coldLeadId
      const { data: cur } = await db.from(tbl).select('call_count').eq('id', id).maybeSingle()
      await db.from(tbl).update({ call_count: (cur?.call_count ?? 0) + 1, last_called_at: new Date().toISOString() }).eq('id', id)
    }
  } catch { /* logging must never block the call */ }

  const dial = vr.dial({
    callerId: e.callerId,
    record: 'record-from-answer-dual',
    recordingStatusCallback: `${appUrl()}/api/twilio/recording`,
    recordingStatusCallbackEvent: ['completed'],
    action: `${appUrl()}/api/twilio/status`,
    answerOnBridge: true,
  } as any)
  dial.number(to)
  return twimlResponse(vr.toString())
}
