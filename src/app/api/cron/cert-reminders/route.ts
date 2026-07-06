import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

// Weekly (Monday, Brisbane) reminder of certifications/insurances that are expired
// or expiring within 60 days, so nothing lapses unnoticed. ?to=<email> for a test.

export const dynamic = 'force-dynamic'

const OWNER_EMAIL = 'hello@deltacleaning.com.au'

function brisbaneDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}
function daysLeft(dateStr: string): number {
  return Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - new Date(brisbaneDate(0) + 'T00:00:00').getTime()) / 86_400_000)
}
function auDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const horizon = brisbaneDate(60)

  const { data: certs } = await db
    .from('certifications')
    .select('name, holder, reference, expiry_date')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', horizon)
    .order('expiry_date', { ascending: true })

  const list: any[] = certs ?? []
  if (list.length === 0) return NextResponse.json({ sent: false, reason: 'nothing expiring within 60 days' })

  const row = (c: any) => {
    const d = daysLeft(c.expiry_date)
    const color = d < 0 ? '#b91c1c' : d <= 30 ? '#b45309' : '#64748b'
    const state = d < 0 ? `expired ${Math.abs(d)}d ago` : `${d}d left`
    return `<tr>
      <td style="padding:8px 12px 8px 0;color:#0f172a;font-weight:600;font-size:14px;">${c.name}${c.holder ? ` <span style="color:#94a3b8;font-weight:400;">· ${c.holder}</span>` : ''}</td>
      <td style="padding:8px 0;text-align:right;color:${color};font-size:13px;font-weight:600;white-space:nowrap;">${auDate(c.expiry_date)} · ${state}</td>
    </tr>`
  }

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <div style="background:#0b1320;border-radius:12px 12px 0 0;padding:22px 26px;">
        <p style="margin:0;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Delta Cleaning · Compliance</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:20px;">${list.length} certificate${list.length !== 1 ? 's' : ''} to renew</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 26px;">
        <p style="margin:0 0 14px;font-size:13px;color:#64748b;">Expired or expiring within 60 days. Renew and re-upload to the register so your compliance stays current.</p>
        <table style="width:100%;border-collapse:collapse;">${list.map(row).join('')}</table>
        <p style="margin:22px 0 0;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:14px;">Certifications &amp; insurance register · Delta Cleaning Operations Hub</p>
      </div>
    </div>`

  const to = new URL(request.url).searchParams.get('to') || OWNER_EMAIL
  const result = await sendEmail(to, `Compliance — ${list.length} certificate${list.length !== 1 ? 's' : ''} to renew`, html)
  return NextResponse.json({ sent: result.success, count: list.length, to, error: result.error })
}
