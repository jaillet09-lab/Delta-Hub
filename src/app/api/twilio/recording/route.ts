import { createAdminClient } from '@/lib/supabase/admin'
import { readTwilioBody, twimlResponse, appUrl } from '@/lib/twilio'
import { enqueue } from '@/lib/qstash'

export const runtime = 'nodejs'

// Recording completed callback. Save the recording reference + duration, then kick
// off transcription (Deepgram) + analysis (Claude) asynchronously. If QStash isn't
// configured the safety cron (/api/cron/call-followups) picks the call up instead.
export async function POST(req: Request) {
  const b = await readTwilioBody(req)
  const sid = b.CallSid
  const recSid = b.RecordingSid
  const dur = b.RecordingDuration ? parseInt(b.RecordingDuration, 10) : null

  try {
    if (sid && recSid) {
      const db = createAdminClient() as any
      const patch: Record<string, any> = { recording_path: recSid, status: 'processing' }
      if (dur != null) patch.duration_seconds = dur
      await db.from('calls').update(patch).eq('twilio_call_sid', sid)
      // Async processing (never block or fail the webhook).
      await enqueue(`${appUrl()}/api/calls/process`, { callSid: sid })
    }
  } catch { /* never throw from a webhook */ }

  return twimlResponse('<Response/>')
}
