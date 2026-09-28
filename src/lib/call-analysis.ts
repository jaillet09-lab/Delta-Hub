import 'server-only'
import { twilioEnv } from '@/lib/twilio'
import { DELTA_EMAIL_SIGNATURE } from '@/lib/emails/proposal-email-body'

// Phase 3 brains: turn a Twilio recording into a transcript (Deepgram), then a
// structured read of the call + a follow-up email draft in Jackson's voice (Claude).
// Every step is guarded so the feature stays dormant until the keys are set.

export function transcriptionConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY?.trim()
}
export function analysisConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim()
}

const ANALYSIS_MODEL = process.env.CALL_ANALYSIS_MODEL?.trim() || 'claude-sonnet-5'

export const CALL_OUTCOMES = [
  'booked_walkthrough', 'callback_requested', 'info_requested',
  'follow_up', 'not_interested', 'no_answer', 'wrong_number',
] as const

export interface LeadContext {
  contactName?: string | null
  businessName?: string | null
  role?: string | null
}

export interface CallAnalysis {
  summary: string
  outcome: string
  next_step: string
  details: Record<string, string | null>
  wants_info_email: boolean
  email_subject: string
  email_body: string
}

// ─── Transcription (Deepgram) ─────────────────────────────────────────────────

export async function transcribeRecording(recordingSid: string): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY?.trim()
  const e = twilioEnv()
  if (!key || !e.accountSid || !e.authToken || !recordingSid) return ''

  // Pull the recording audio from Twilio (basic auth), then hand the bytes to Deepgram.
  const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${e.accountSid}/Recordings/${recordingSid}.mp3`
  const creds = Buffer.from(`${e.accountSid}:${e.authToken}`).toString('base64')
  const audioRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${creds}` } })
  if (!audioRes.ok) throw new Error(`Twilio recording fetch failed: ${audioRes.status}`)
  const audio = Buffer.from(await audioRes.arrayBuffer())

  const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=true', {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/mpeg' },
    body: audio,
  })
  if (!dgRes.ok) throw new Error(`Deepgram failed: ${dgRes.status}`)
  const dg = await dgRes.json()
  return dg?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
}

// ─── Analysis + follow-up draft (Claude) ──────────────────────────────────────

const SYSTEM_PROMPT = `You are Jackson Jaillet, founder and director of Delta Cleaning, a commercial cleaning business in Brisbane, Australia. You are reviewing the transcript of a sales call you just had with a prospect, and (when they asked for it) drafting the follow-up email yourself.

Write EVERYTHING in your own voice:
- Warm, direct, down-to-earth Australian. Straight talker, no corporate fluff.
- Short sentences. Contractions are fine ("we'd", "I've", "that's").
- NEVER use em dashes or en dashes. Use commas, full stops, or "and".
- Ban this AI-slop language entirely: "I hope this email finds you well", "reach out", "delighted", "furthermore", "moreover", "in today's fast-paced", "seamless", "leverage", "elevate", "at your earliest convenience", "please don't hesitate", "we are thrilled". If a phrase sounds like a template, cut it.
- Only reference things that were actually said on the call. Do not invent site details, prices, or promises. If pricing came up and you are unsure, offer a ballpark or a quick site walk-through instead of a made-up number.
- Delta's strengths, when relevant: a regular cleaner who learns the site, a supervisor keeping the standard, and you (the owner) across it all. Window cleaning and floor care (carpet, vinyl, concrete, pressure washing, steam) are available.

The follow-up email must end with exactly this sign-off block, each on its own line:
${DELTA_EMAIL_SIGNATURE}`

export async function analyzeCall(transcript: string, lead: LeadContext): Promise<CallAnalysis | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key || !transcript.trim()) return null

  const firstName = (lead.contactName || '').split(/\s+/)[0] || ''
  const task = `Here is the transcript of the call:

"""
${transcript}
"""

Prospect: ${lead.contactName || 'unknown'}${lead.role ? `, ${lead.role}` : ''}${lead.businessName ? ` at ${lead.businessName}` : ''}.

Return ONLY a JSON object (no prose, no code fences) with exactly these keys:
{
  "summary": "2-3 plain sentences on what was discussed and where it landed",
  "outcome": one of ${JSON.stringify(CALL_OUTCOMES)},
  "next_step": "the single next action, short",
  "details": { "site_size": string|null, "current_cleaner": string|null, "frequency": string|null, "budget": string|null, "decision_maker": string|null },
  "wants_info_email": true ONLY if they asked you to send more information, a proposal, or pricing by email; otherwise false,
  "email_subject": "short, plain subject if wants_info_email is true, else empty string",
  "email_body": "if wants_info_email is true: the full follow-up email in your voice, greeting ${firstName ? `\"Hi ${firstName},\"` : 'the contact by first name if known else \"Hi,\"'}, built strictly from the call, ending with your sign-off block. If false: empty string."
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: task }],
    }),
  })
  if (!res.ok) throw new Error(`Claude failed: ${res.status}`)
  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''

  // Be forgiving: strip code fences and grab the outermost JSON object.
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  let parsed: any
  try { parsed = JSON.parse(cleaned.slice(start, end + 1)) } catch { return null }

  const outcome = CALL_OUTCOMES.includes(parsed.outcome) ? parsed.outcome : 'follow_up'
  return {
    summary: String(parsed.summary ?? '').trim(),
    outcome,
    next_step: String(parsed.next_step ?? '').trim(),
    details: (parsed.details && typeof parsed.details === 'object') ? parsed.details : {},
    wants_info_email: parsed.wants_info_email === true && !!String(parsed.email_body ?? '').trim(),
    email_subject: String(parsed.email_subject ?? '').trim(),
    email_body: String(parsed.email_body ?? '').trim(),
  }
}
