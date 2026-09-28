import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appUrl } from '@/lib/twilio'

export const runtime = 'nodejs'
export const maxDuration = 300

// Safety net for the call pipeline so nothing gets stuck if a QStash job is missed
// (or QStash isn't configured): finish transcribing/analysing any recorded calls,
// and send any follow-up emails whose 5-minute delay has passed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const base = appUrl()
  const call = (path: string, callId: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ callId }),
    }).catch(() => null)

  // 1) Recorded but not yet transcribed (older than ~2 min so the recording is ready).
  const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString()
  const { data: stuck } = await db
    .from('calls')
    .select('id')
    .eq('status', 'processing')
    .not('recording_path', 'is', null)
    .is('transcript', null)
    .lt('started_at', twoMinAgo)
    .limit(25)
  for (const c of stuck ?? []) await call('/api/calls/process', c.id)

  // 2) Follow-ups whose scheduled time has arrived.
  const { data: due } = await db
    .from('calls')
    .select('id')
    .eq('follow_up_status', 'pending')
    .lte('follow_up_scheduled_at', new Date().toISOString())
    .limit(25)
  for (const c of due ?? []) await call('/api/calls/send-followup', c.id)

  return NextResponse.json({ ok: true, processed: stuck?.length ?? 0, sent: due?.length ?? 0 })
}
