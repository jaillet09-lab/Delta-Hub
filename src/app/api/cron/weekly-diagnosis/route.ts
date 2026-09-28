import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { runDiagnostics } from '@/lib/diagnostics'

// Weekly app health check. Runs the shared diagnostics and pushes a summary to
// the owner (admin) in-app. Scheduled Monday ~7am Brisbane in vercel.json.
// A ?to override isn't needed — hit it with the CRON_SECRET to test.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const { checks } = await runDiagnostics(db)

  const issues = checks.filter((c) => c.status !== 'ok')

  const title = issues.length === 0
    ? 'Delta Hub weekly check — all clear'
    : `Delta Hub weekly check — ${issues.length} to look at`

  const body = (issues.length === 0
    ? checks.filter((c) => c.detail).slice(0, 2).map((c) => c.detail).join(' ')
    : issues.map((c) => `• ${c.label}: ${c.detail}`).join('\n')
  ).slice(0, 300)

  await sendPushToRole('admin', { title, body, url: '/diagnostics' })

  return NextResponse.json({ ok: true, issues: issues.length, checks })
}
