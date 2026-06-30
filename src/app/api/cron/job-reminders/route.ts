import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'

// Push reminders to cleaners to START (morning) and FINISH (evening) their cleans.
// Runs twice daily; the Brisbane hour decides which pass. Quiet hours 20:00–07:00.
// Morning pass nudges anyone with a clean scheduled today who hasn't started it.
// Evening pass nudges anyone with a clean still in progress (started, not submitted).

function brisbane() {
  const now = new Date()
  const date = now
    .toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
  const dayKey = now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short' }).slice(0, 3)
  const hour = parseInt(now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', hour12: false }), 10)
  return { date, dayKey, hour }
}

function brisbaneOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000)
    .toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}

const normDay = (d: string) => d.slice(0, 3).replace(/^./, (c) => c.toUpperCase())

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient() as any
  const { date: today, dayKey, hour } = brisbane()

  // Quiet hours — never buzz a cleaner late at night or early morning.
  if (hour < 7 || hour >= 20) return NextResponse.json({ skipped: 'quiet hours', hour })

  const pass = hour < 14 ? 'start' : 'finish'
  let sent = 0

  if (pass === 'start') {
    // Don't re-nudge a clean already underway or done today.
    const { data: todays } = await db.from('job_assignments')
      .select('client_id, cleaner_id, status').eq('scheduled_date', today)
    const handled = new Set(
      (todays ?? [])
        .filter((j: any) => j.status === 'in_progress' || j.status === 'completed')
        .map((j: any) => `${j.client_id}::${j.cleaner_id}`)
    )

    type Cand = { cleanerId: string; label: string; clientId: string }
    const cands: Cand[] = []

    // Single-site clients scheduled today with an assigned cleaner
    const { data: singles } = await db.from('clients')
      .select('id, business_name, service_days, clean_days, assigned_cleaner_id')
      .eq('active', true).eq('is_multi_site', false).not('assigned_cleaner_id', 'is', null)
    for (const c of singles ?? []) {
      const days = ((c.clean_days?.length ? c.clean_days : c.service_days) ?? []).map(normDay)
      if (days.includes(dayKey)) cands.push({ cleanerId: c.assigned_cleaner_id, label: c.business_name, clientId: c.id })
    }

    // Individually-assigned sites scheduled today
    const { data: sites } = await db.from('client_sites')
      .select('site_name, client_id, service_days, clean_days, assigned_cleaner_id, clients(business_name, active)')
      .not('assigned_cleaner_id', 'is', null)
    for (const s of sites ?? []) {
      if (s.clients?.active === false) continue
      const days = ((s.clean_days?.length ? s.clean_days : s.service_days) ?? []).map(normDay)
      if (days.includes(dayKey)) {
        cands.push({ cleanerId: s.assigned_cleaner_id, label: `${s.clients?.business_name ?? ''} — ${s.site_name}`.trim(), clientId: s.client_id })
      }
    }

    const cleanerIds = Array.from(new Set(cands.map((c) => c.cleanerId)))
    const { data: profs } = cleanerIds.length
      ? await db.from('profiles').select('id, user_id').in('id', cleanerIds)
      : { data: [] }
    const uid = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.user_id] as [string, string]))

    for (const c of cands) {
      if (handled.has(`${c.clientId}::${c.cleanerId}`)) continue
      const userId = uid.get(c.cleanerId)
      if (!userId) continue
      await sendPushToUser(userId, {
        title: 'Time to start your clean',
        body: `${c.label} is on today — tap to start when you arrive.`,
        url: `/cleaner/clients/${c.clientId}`,
      })
      sent++
    }
  } else {
    // Finish pass — cleans started but not submitted (incl. a Saturday job carried into Sunday).
    const { data: open } = await db.from('job_assignments')
      .select('client_id, scheduled_date, status, clients(business_name), profiles(user_id)')
      .gte('scheduled_date', brisbaneOffset(-2)).eq('status', 'in_progress')
    for (const j of open ?? []) {
      const userId = j.profiles?.user_id
      if (!userId) continue
      await sendPushToUser(userId, {
        title: "Don't forget to finish",
        body: `Your clean at ${j.clients?.business_name ?? 'your job'} is still open — tap to submit it.`,
        url: `/cleaner/clients/${j.client_id}`,
      })
      sent++
    }
  }

  return NextResponse.json({ pass, sent, today, dayKey, hour })
}
