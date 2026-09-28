import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '@/lib/supabase/server'
import { twilioEnv } from '@/lib/twilio'

export const runtime = 'nodejs'

// Voice access token for the in-browser dialer. Signed-in staff only.
export async function GET() {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const e = twilioEnv()
  if (!e.accountSid || !e.apiKey || !e.apiSecret || !e.twimlAppSid) {
    return NextResponse.json({ error: 'Calling is not configured yet.' }, { status: 503 })
  }

  const AccessToken = twilio.jwt.AccessToken
  const VoiceGrant = AccessToken.VoiceGrant
  const token = new AccessToken(e.accountSid, e.apiKey, e.apiSecret, { identity: e.identity, ttl: 3600 })
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: e.twimlAppSid, incomingAllow: true }))

  return NextResponse.json({ token: token.toJwt(), identity: e.identity })
}
