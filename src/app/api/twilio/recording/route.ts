import { createAdminClient } from '@/lib/supabase/admin'
import { readTwilioBody, twimlResponse } from '@/lib/twilio'

export const runtime = 'nodejs'

// Recording completed callback. Save the recording reference + duration on the
// call. Phase 3 will kick off Deepgram transcription from here (via QStash).
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
      // Phase 3: enqueue transcription (Deepgram) + summary (Claude) via QStash here.
    }
  } catch { /* never throw from a webhook */ }

  return twimlResponse('<Response/>')
}
