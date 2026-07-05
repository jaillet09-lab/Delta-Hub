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

function section(title: string, dot: string, textColor: string, bg: string, border: string, items: Item[], boxed = true): string {
  if (!items.length) return ''
  const rows = items.map((it) =>
    `<div style="line-height:1.85;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dot};vertical-align:middle;margin-right:8px;"></span>${it.label}<span style="color:#94a3b8;"> · ${fmt(it.date)} · ${it.cleaner ?? 'unassigned'}</span></div>`
  ).join('')
  const label = `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${textColor};">${title} · ${items.length}</p>`
  const body = boxed
    ? `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:12px 14px;font-size:13px;color:#334155;margin-bottom:14px;">${rows}</div>`
    : `<div style="font-size:13px;color:#334155;margin-bottom:8px;">${rows}</div>`
  return label + body
}

function buildHtml(opts: {
  name: string; period: string;
  started: Item[]; notStarted: Item[]; completed: Item[];
}): string {
  const card = (n: number, label: string, color: string, bg: string) =>
    `<td style="width:33%;background:${bg};border-radius:10px;padding:12px;text-align:center;"><p style="margin:0;font-size:24px;font-weight:700;color:${color};">${n}</p><p style="margin:3px 0 0;font-size:11px;color:${color};line-height:1.3;">${label}</p></td>`
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <div style="background:#0b1320;border-radius:12px 12px 0 0;padding:22px 26px;">
        <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Delta Cleaning · Weekly report</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">Week of ${opts.period}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 26px;">
        <p style="margin:0 0 16px;font-size:14px;">Morning ${opts.name}, here's last week at a glance.</p>
        <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 20px;"><tr>
          ${card(opts.started.length, 'Started, not finished', '#b45309', '#fffbeb')}
          ${card(opts.notStarted.length, 'Never started', '#b91c1c', '#fef2f2')}
          ${card(opts.completed.length, 'Completed', '#15803d', '#f0fdf4')}
        </tr></table>
        ${section('Started, not finished', '#f59e0b', '#b45309', '#fffbeb', '#fde68a', opts.started)}
        ${section('Never started', '#ef4444', '#b91c1c', '#fef2f2', '#fecaca', opts.notStarted)}
        ${section('Completed', '#16a34a', '#15803d', '#f0fdf4', '#bbf7d0', opts.completed, false)}
        <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:14px;">Sent Monday mornings · Delta Cleaning Operations Hub</p>
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
  const started    = (jobs ?? []).filter((j: any) => j.status === 'in_progress' || j.status === 'flagged').map(toItem)
  const notStarted = (jobs ?? []).filter((j: any) => j.status === 'not_started').map(toItem)
  const completed  = (jobs ?? []).filter((j: any) => j.status === 'completed').map(toItem)
  const period     = fmtRange(weekAgo, brisbaneDate(-1))

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
    const html = buildHtml({ name: r.name, period, started, notStarted, completed })
    const subject = `${testTo ? '[Test] ' : ''}Weekly report — ${period}`
    const res = await sendEmail(r.email, subject, html)
    if (res.success) sent++
    else failures.push(`${r.email}: ${res.error}`)
  }

  return NextResponse.json({ sent, recipients: recipients.map((r) => r.email), started: started.length, notStarted: notStarted.length, completed: completed.length, failures })
}
