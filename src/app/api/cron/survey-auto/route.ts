import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'

export const runtime = 'nodejs'
export const maxDuration = 60

// Auto-send client satisfaction surveys.
//  • Recurring clients (daily/weekly/fortnightly/monthly): every survey_frequency_days
//    (default 90) since their last survey activity.
//  • Periodic clients (quarterly/annual): a week after each completed clean.
//  • Any survey unanswered after 7 days gets ONE reminder (keyed off the send date's
//    day-7 window, so it fires exactly once without needing a new column).
// Notifies the owner (admin) when a survey is sent. Submissions notify separately.

const RECURRING = new Set(['daily', 'weekly', 'fortnightly', 'monthly'])
const PERIODIC  = new Set(['quarterly', 'annual'])
const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au').replace(/\/$/, '')

const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86_400_000)

function inviteEmail(contactName: string, businessName: string, url: string) {
  const first = (contactName || '').split(' ')[0] || 'there'
  return {
    subject: `How are we going at ${businessName}?`,
    html: `<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;background:#fff;">
<div style="max-width:540px;padding:40px 24px;">
<p>Hi ${first},</p>
<p>Hope you're well. I just wanted to personally check in and ask how you feel we've been going at ${businessName}.</p>
<p>I put together a short 1-minute survey — your honest feedback really means a lot and helps us keep improving.</p>
<p><a href="${url}" style="color:#1a1a1a;">Click here to complete the survey</a></p>
<p>Thanks so much for your time.</p>
<p style="margin-top:24px;">Best Regards<br/>Jackson Jaillet<br/>
<span style="color:#555;font-size:14px;">Founder &amp; Director, Delta Cleaning</span><br/>
<span style="color:#555;font-size:14px;">0412 844 238</span><br/>
<a href="https://www.deltacleaning.com.au" style="color:#555;font-size:14px;text-decoration:none;">www.deltacleaning.com.au</a></p>
</div></body></html>`,
  }
}

function reminderEmail(contactName: string, businessName: string, url: string) {
  const first = (contactName || '').split(' ')[0] || 'there'
  return {
    subject: `A quick reminder — how are we going at ${businessName}?`,
    html: `<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;background:#fff;">
<div style="max-width:540px;padding:40px 24px;">
<p>Hi ${first},</p>
<p>Just a gentle nudge on the short survey I sent through for ${businessName} — I know things get busy.</p>
<p>It only takes a minute and your feedback genuinely helps us keep the standard where it should be.</p>
<p><a href="${url}" style="color:#1a1a1a;">Complete the survey here</a></p>
<p>Thanks so much.</p>
<p style="margin-top:24px;">Best Regards<br/>Jackson Jaillet<br/>
<span style="color:#555;font-size:14px;">Founder &amp; Director, Delta Cleaning</span><br/>
<span style="color:#555;font-size:14px;">0412 844 238</span><br/>
<a href="https://www.deltacleaning.com.au" style="color:#555;font-size:14px;text-decoration:none;">www.deltacleaning.com.au</a></p>
</div></body></html>`,
  }
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  const db = createAdminClient() as any
  const now = new Date()

  // Survey cadence in days (from settings, default 90)
  let cadence = 90
  try {
    const { data: s } = await db.from('settings').select('value').eq('key', 'survey_frequency_days').maybeSingle()
    const n = Number(s?.value)
    if (Number.isFinite(n) && n > 0) cadence = n
  } catch { /* keep default */ }

  const [{ data: clients }, { data: tokens }, { data: jobs }] = await Promise.all([
    db.from('clients').select('id, business_name, contact_name, contact_email, frequency').eq('active', true).not('contact_email', 'is', null),
    db.from('survey_tokens').select('client_id, token, created_at, submitted_at').eq('kind', 'ongoing').order('created_at', { ascending: false }),
    db.from('job_assignments').select('client_id, scheduled_date').eq('status', 'completed').order('scheduled_date', { ascending: false }),
  ])

  // Latest ongoing token + last completed clean per client
  const latestToken = new Map<string, any>()
  for (const t of tokens ?? []) if (!latestToken.has(t.client_id)) latestToken.set(t.client_id, t)
  const lastClean = new Map<string, string>()
  for (const j of jobs ?? []) if (!lastClean.has(j.client_id)) lastClean.set(j.client_id, j.scheduled_date)

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)

  const send = async (client: any, kind: 'invite' | 'reminder', token: string) => {
    const url = `${APP}/survey/${token}`
    const mail = kind === 'invite'
      ? inviteEmail(client.contact_name, client.business_name, url)
      : reminderEmail(client.contact_name, client.business_name, url)
    const { error } = await resend.emails.send({
      from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
      to: client.contact_email, reply_to: 'hello@deltacleaning.com.au', bcc: 'hello@deltacleaning.com.au',
      subject: mail.subject, html: mail.html,
    })
    return !error
  }

  let sent = 0, reminded = 0

  for (const c of clients ?? []) {
    const tok = latestToken.get(c.id)
    const pending = tok && !tok.submitted_at

    // Reminder: a pending survey that's been out 7 days (fire once, in the day-7 window)
    if (pending) {
      const age = daysBetween(now, new Date(tok.created_at))
      if (age >= 7 && age < 8) {
        if (await send(c, 'reminder', tok.token)) reminded++
      }
      continue // never send a second survey while one is unanswered
    }

    // Should a new survey go out?
    let due = false
    const freq = c.frequency as string | null
    if (freq && RECURRING.has(freq)) {
      const last = tok?.submitted_at || tok?.created_at
      due = !last || daysBetween(now, new Date(last)) >= cadence
    } else if (freq && PERIODIC.has(freq)) {
      const clean = lastClean.get(c.id)
      if (clean && daysBetween(now, new Date(clean + 'T00:00:00')) >= 7) {
        const lastSent = tok?.created_at ? new Date(tok.created_at) : null
        due = !lastSent || lastSent < new Date(clean + 'T00:00:00')  // no survey since this clean
      }
    }
    if (!due) continue

    const { data: row } = await db.from('survey_tokens').insert({ client_id: c.id, kind: 'ongoing' }).select('token').single()
    if (!row?.token) continue
    if (await send(c, 'invite', row.token)) {
      sent++
      sendPushToRole('admin', { title: 'Survey sent', body: `Sent a satisfaction survey to ${c.business_name}.`, url: '/surveys' }).catch(() => {})
    } else {
      await db.from('survey_tokens').delete().eq('token', row.token)  // clean up if the email failed
    }
  }

  return NextResponse.json({ ok: true, sent, reminded })
}
