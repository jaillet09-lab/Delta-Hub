import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

// Vercel cron: every weekday morning (Brisbane). Emails Jackson the day's
// due follow-ups and booked walk-throughs from the cold-call deck.

const REPORT_EMAIL = 'hello@deltacleaning.com.au'

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const today = brisbaneToday()

  // Pull everything still in play, then split into walk-throughs, due follow-ups
  // and due retries (no-answer leads whose next attempt date has arrived).
  const { data: rows, error } = await db
    .from('cold_leads')
    .select('business_name, contact_name, phone, suburb, status, next_follow_up, next_attempt, follow_up_note, call_count')
    .in('status', ['follow_up', 'walkthrough', 'called'])
    .order('next_follow_up', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const walkthroughs = (rows ?? []).filter((l: any) => l.status === 'walkthrough')
  const followUps    = (rows ?? []).filter((l: any) => l.status !== 'walkthrough' && l.next_follow_up && l.next_follow_up <= today)
  const retries      = (rows ?? []).filter((l: any) => l.status === 'called' && l.next_attempt && l.next_attempt <= today)

  const due = [...walkthroughs, ...followUps, ...retries]
  if (due.length === 0) return NextResponse.json({ ok: true, due: 0 })

  const row = (l: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${l.business_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${[l.contact_name, l.suburb].filter(Boolean).join(' · ') || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.phone ? `<a href="tel:${l.phone.replace(/[^\d+]/g, '')}" style="color:#1e3a5f;">${l.phone}</a>` : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;">${l.follow_up_note || ''}</td>
    </tr>`

  const table = (rows: any[]) => `
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      ${rows.map(row).join('')}
    </table>`

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; max-width: 640px;">
  <p style="font-size:15px;">Today's call list from the cold-call deck:</p>
  ${walkthroughs.length > 0 ? `<h3 style="font-size:14px;margin:18px 0 6px;">Walk-throughs (${walkthroughs.length})</h3>${table(walkthroughs)}` : ''}
  ${followUps.length > 0 ? `<h3 style="font-size:14px;margin:18px 0 6px;">Follow-ups due (${followUps.length})</h3>${table(followUps)}` : ''}
  ${retries.length > 0 ? `<h3 style="font-size:14px;margin:18px 0 6px;">Try again today (${retries.length})</h3>${table(retries)}` : ''}
  <p style="margin-top:20px;font-size:14px;">
    <a href="https://portal.deltacleaning.com.au/calls" style="color:#1e3a5f;font-weight:600;">Open the call deck →</a>
  </p>
</div>`

  const result = await sendEmail(
    REPORT_EMAIL,
    `${due.length} cold-call follow-up${due.length === 1 ? '' : 's'} due today`,
    html
  )

  return NextResponse.json({ ok: result.success, due: due.length })
}
