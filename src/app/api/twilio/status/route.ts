import { createAdminClient } from '@/lib/supabase/admin'
import { readTwilioBody, twimlResponse } from '@/lib/twilio'

export const runtime = 'nodejs'

// <Dial> action callback — fires when the call ends. Records the outcome for
// unanswered calls and the duration; a recording (if any) is handled separately.
export async function POST(req: Request) {
  const b = await readTwilioBody(req)
  const sid = b.CallSid
  const dialStatus = b.DialCallStatus || ''
  const dialDur = b.DialCallDuration ? parseInt(b.DialCallDuration, 10) : null
  const unanswered = ['no-answer', 'busy', 'failed', 'canceled'].includes(dialStatus)

  try {
    if (sid) {
      const db = createAdminClient() as any
      const { data: row } = await db.from('calls').select('id, outcome, duration_seconds').eq('twilio_call_sid', sid).maybeSingle()
      if (row) {
        const patch: Record<string, any> = { ended_at: new Date().toISOString() }
        if (dialDur != null && !row.duration_seconds) patch.duration_seconds = dialDur
        if (unanswered) {
          if (!row.outcome) patch.outcome = 'no_answer'
          patch.status = 'completed'   // no recording is coming
        }
        await db.from('calls').update(patch).eq('id', row.id)
      }
    }
  } catch { /* never throw from a webhook */ }

  return twimlResponse('<Response/>')
}
