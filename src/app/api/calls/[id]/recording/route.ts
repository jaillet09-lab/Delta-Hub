import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { twilioEnv } from '@/lib/twilio'

export const runtime = 'nodejs'

// Streams a call recording privately: signed-in staff only, proxied straight from
// Twilio with our credentials so the recording URL is never exposed publicly.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const db = createAdminClient() as any
  const { data: call } = await db.from('calls').select('recording_path').eq('id', params.id).maybeSingle()
  if (!call?.recording_path) return new NextResponse('No recording', { status: 404 })

  const e = twilioEnv()
  if (!e.accountSid || !e.authToken) return new NextResponse('Not configured', { status: 503 })

  const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${e.accountSid}/Recordings/${call.recording_path}.mp3`
  const r = await fetch(mediaUrl, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${e.accountSid}:${e.authToken}`).toString('base64') },
  })
  if (!r.ok || !r.body) return new NextResponse('Recording unavailable', { status: 502 })

  return new NextResponse(r.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' },
  })
}
