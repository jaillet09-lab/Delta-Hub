import 'server-only'
import twilio from 'twilio'

export function twilioEnv() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim(),
    authToken:  process.env.TWILIO_AUTH_TOKEN?.trim(),
    apiKey:     process.env.TWILIO_API_KEY?.trim(),
    apiSecret:  process.env.TWILIO_API_SECRET?.trim(),
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID?.trim(),
    callerId:   process.env.TWILIO_CALLER_ID?.trim(),        // Delta AU number (E.164)
    forwardTo:  process.env.TWILIO_FORWARD_TO?.trim(),       // owner mobile fallback (E.164)
    recordingAnnouncement: (process.env.RECORDING_ANNOUNCEMENT ?? 'false').trim() === 'true',
    identity: 'delta-owner',
  }
}

// True once the minimum Twilio secrets exist — used to keep the whole calling
// feature dormant (no errors) until the account is wired up in Vercel.
export function callingConfigured(): boolean {
  const e = twilioEnv()
  return !!(e.accountSid && e.authToken && e.callerId)
}

export function twilioClient() {
  const e = twilioEnv()
  if (!e.accountSid || !e.authToken) return null
  return twilio(e.accountSid, e.authToken)
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au').replace(/\/$/, '')
}

// Normalise an AU phone number to E.164 (+61…). Leaves already-international
// numbers alone. Returns null when there's nothing usable.
export function normaliseAU(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.replace(/[^\d+]/g, '')
  if (!s) return null
  if (s.startsWith('+')) return s
  if (s.startsWith('0'))  return '+61' + s.slice(1)
  if (s.startsWith('61')) return '+' + s
  if (s.length === 9)     return '+61' + s   // mobile without the leading 0
  return '+' + s
}

// Validate a Twilio webhook signature. `url` must be the exact public URL Twilio
// requested; `params` are the POST body fields.
export function validateTwilioSignature(signature: string | null, url: string, params: Record<string, any>): boolean {
  const e = twilioEnv()
  if (!e.authToken || !signature) return false
  try {
    return twilio.validateRequest(e.authToken, signature, url, params)
  } catch {
    return false
  }
}

// Pull the POST form body into a plain object (Twilio posts application/x-www-form-urlencoded).
export async function readTwilioBody(req: Request): Promise<Record<string, string>> {
  const form = await req.formData()
  const out: Record<string, string> = {}
  for (const [k, v] of Array.from(form.entries())) out[k] = String(v)
  return out
}

export function twimlResponse(xml: string): Response {
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } })
}
