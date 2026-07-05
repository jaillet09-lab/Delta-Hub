import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

// Weekly operations report for managers. Sent Monday mornings (Brisbane) to every
// manager-role user, at their own login email. Summarises the past 7 days: cleans
// completed, cleans not marked off, and the completion rate.
//
// Test send: GET ?to=someone@example.com sends a single copy to that address only
// (rendered as the manager's copy) without emailing the real managers.

export const dynamic = 'force-dynamic'

function brisbaneDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}
function fmt(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtRange(a: string, b: string): string {
  const d = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  return `${d(a)} – ${d(b)}`
}

interface Item { label: string; date: string; cleaner: string | null }

function buildHtml(opts: {
  name: string; period: string; appUrl: string;
  completed: Item[];
  open: Item[];
}): string {
  const total = opts.completed.length + opts.open.length
  const pct = total ? Math.round((100 * opts.completed.length) / total) : 0
  const row = (it: Item, color: string) =>
    `<div style="line-height:1.9;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};vertical-align:middle;margin-right:8px;"></span>${it.label} <span style="color:#94a3b8;">· ${fmt(it.date)}${it.cleaner ? ` · ${it.cleaner}` : ' · unassigned'}</span></div>`

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <div style="background:#0b1320;border-radius:12px 12px 0 0;padding:22px 26px;">
        <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Delta Cleaning · Weekly report</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">Week of ${opts.period}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 26px;">
        <p style="margin:0 0 16px;font-size:14px;">Morning ${opts.name}, here's how last week ran.</p>
        <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 16px;"><tr>
          <td style="width:33%;background:#f1f5f9;border-radius:10px;padding:12px;"><p style="margin:0;font-size:22px;font-weight:700;">${opts.completed.length}</p><p style="margin:2px 0 0;font-size:11px;color:#64748b;">Completed</p></td>
          <td style="width:33%;background:#fffbeb;border-radius:10px;padding:12px;"><p style="margin:0;font-size:22px;font-weight:700;color:#b45309;">${opts.open.length}</p><p style="margin:2px 0 0;font-size:11px;color:#b45309;">Not marked off</p></td>
          <td style="width:33%;background:#f1f5f9;border-radius:10px;padding:12px;"><p style="margin:0;font-size:22px;font-weight:700;">${pct}%</p><p style="margin:2px 0 0;font-size:11px;color:#64748b;">Completion</p></td>
        </tr></table>
        ${opts.completed.length ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;">Completed · ${opts.completed.length}</p><div style="font-size:13px;color:#334155;margin-bottom:16px;">${opts.completed.map(c => row(c, '#16a34a')).join('')}</div>` : ''}
        ${opts.open.length ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#b45309;">Still open — chase these · ${opts.open.length}</p><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;font-size:13px;color:#78350f;margin-bottom:20px;">${opts.open.map(c => row(c, '#f59e0b')).join('')}</div>` : ''}
        <a href="${opts.appUrl}/manager/dashboard" style="display:inline-block;background:#0b1320;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:12px 22px;">Open the manager dashboard →</a>
        <p style="margin:22px 0 0;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:14px;">Sent Monday mornings · Delta Cleaning Operations Hub</p>
      </div>
    </div>`
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const testTo = url.searchParams.get('to')

  const db = createAdminClient() as any
  const today   = brisbaneDate(0)
  const weekAgo = brisbaneDate(-7)
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.deltacleaning.com.au'

  const { data: jobs } = await db
    .from('job_assignments')
    .select('scheduled_date, status, clients(business_name), client_sites(site_name), profiles(full_name)')
    .gte('scheduled_date', weekAgo)
    .lt('scheduled_date', today)
    .order('scheduled_date', { ascending: true })

  const toItem = (j: any) => {
    const site = j.client_sites?.site_name
    const name = j.clients?.business_name ?? 'A client'
    return { label: site ? `${name} — ${site}` : name, date: j.scheduled_date, cleaner: j.profiles?.full_name ?? null }
  }
  const completed = (jobs ?? []).filter((j: any) => j.status === 'completed').map(toItem)
  const open      = (jobs ?? []).filter((j: any) => j.status !== 'completed').map(toItem)
  const period    = fmtRange(weekAgo, brisbaneDate(-1))

  // Recipients
  let recipients: { email: string; name: string }[]
  if (testTo) {
    recipients = [{ email: testTo, name: 'Sam' }]
  } else {
    const { data: mgrs } = await db.from('profiles').select('user_id, full_name').eq('role', 'manager')
    const { data: list } = await db.auth.admin.listUsers()
    const users: any[] = list?.users ?? []
    recipients = (mgrs ?? []).map((m: any) => {
      const u = users.find((x) => x.id === m.user_id)
      return u?.email ? { email: u.email as string, name: (m.full_name || '').split(' ')[0] || 'team' } : null
    }).filter(Boolean) as { email: string; name: string }[]
  }

  let sent = 0
  const failures: string[] = []
  for (const r of recipients) {
    const html = buildHtml({ name: r.name, period, appUrl, completed, open })
    const subject = `${testTo ? '[Test] ' : ''}Weekly report — ${period}`
    const res = await sendEmail(r.email, subject, html)
    if (res.success) sent++
    else failures.push(`${r.email}: ${res.error}`)
  }

  return NextResponse.json({ sent, recipients: recipients.map((r) => r.email), completed: completed.length, open: open.length, failures })
}
