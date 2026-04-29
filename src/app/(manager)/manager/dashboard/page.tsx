export const dynamic   = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ManagerJobRow } from '@/components/portal/manager/ManagerJobRow'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import { getUpcomingDates } from '@/lib/schedule'

const STATUS_ORDER = ['flagged', 'in_progress', 'not_started', 'completed']

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

// A scheduled event: either a job_assignment or a calculated clean date
type ScheduleEvent = {
  date: string
  clientId: string
  clientName: string
  suburb: string | null
  job: any | null // null = no job_assignment yet
}

export default async function ManagerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = brisbaneToday()
  const past  = new Date(Date.now() -  7 * 86_400_000).toISOString().split('T')[0]
  const ahead = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0]

  const hour = parseInt(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }), 10
  )
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Fetch profile, clients with schedules, and existing job_assignments in parallel
  const [{ data: profile }, { data: clientsRaw }, { data: jobsRaw }] = await Promise.all([
    (supabase as any).from('profiles').select('full_name').eq('user_id', user.id).single(),

    // Active clients that have a schedule set
    (supabase as any)
      .from('clients')
      .select('id, business_name, suburb, frequency, service_days, start_date, is_multi_site')
      .eq('active', true)
      .not('frequency', 'is', null)
      .order('business_name'),

    // All job_assignments in the window
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, client_id, clients(business_name, suburb), profiles(full_name), job_submissions(started_at, submitted_at, completed_at, photo_urls)')
      .gte('scheduled_date', past)
      .lte('scheduled_date', ahead)
      .order('scheduled_date', { ascending: true }),
  ])

  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'there'
  const clients = (clientsRaw ?? []) as any[]
  const jobs    = (jobsRaw    ?? []) as any[]

  // ── Build a lookup: clientId::date → job_assignment ─────────────────
  const jobMap = new Map<string, any>()
  for (const job of jobs) {
    jobMap.set(`${job.client_id}::${job.scheduled_date}`, job)
  }

  // ── Generate schedule events from client schedules ──────────────────
  const events: ScheduleEvent[] = []
  const matchedJobIds = new Set<string>()

  for (const client of clients) {
    // Skip multi-site clients (schedule is per-site, complex) and clients with no service_days
    if (client.is_multi_site) continue
    if (!(client.service_days ?? []).length) continue

    const upcomingDates = getUpcomingDates({
      id:            client.id,
      business_name: client.business_name,
      address:       null,
      suburb:        client.suburb ?? null,
      frequency:     client.frequency,
      service_days:  client.service_days ?? [],
      start_date:    client.start_date ?? null,
    }, 90)

    for (const d of upcomingDates) {
      const dateStr = d.toISOString().split('T')[0]
      if (dateStr > ahead) break
      const job = jobMap.get(`${client.id}::${dateStr}`) ?? null
      if (job) matchedJobIds.add(job.id)
      events.push({
        date:        dateStr,
        clientId:    client.id,
        clientName:  client.business_name,
        suburb:      client.suburb ?? null,
        job,
      })
    }
  }

  // Add job_assignments that were NOT matched to any schedule event
  for (const job of jobs) {
    if (!matchedJobIds.has(job.id)) {
      events.push({
        date:       job.scheduled_date,
        clientId:   job.client_id,
        clientName: job.clients?.business_name ?? 'Unknown',
        suburb:     job.clients?.suburb ?? null,
        job,
      })
    }
  }

  // ── Sort by date, then clientName ────────────────────────────────────
  events.sort((a, b) =>
    a.date !== b.date
      ? a.date.localeCompare(b.date)
      : a.clientName.localeCompare(b.clientName)
  )

  // ── Needs Attention (today's events without a job, or started-not-done) ──
  function getSub(job: any) {
    const sub = job?.job_submissions
    if (Array.isArray(sub)) return sub[0] ?? null
    return sub ?? null
  }

  const noJobToday     = events.filter(e => e.date === today && !e.job)
  const notStartedToday = events.filter(e => e.date === today && e.job && e.job.status === 'not_started')
  const startedNotDone  = events.filter(e => {
    if (!e.job) return false
    const sub = getSub(e.job)
    return sub?.started_at && !sub?.completed_at
  })
  const missingPhotos   = events.filter(e => {
    if (!e.job) return false
    const sub = getSub(e.job)
    const photoUrls: string[] = sub?.photo_urls ?? []
    return e.date < today && photoUrls.length === 0 && e.job.status === 'completed'
  })

  const hasAttention = noJobToday.length > 0 || notStartedToday.length > 0 || startedNotDone.length > 0 || missingPhotos.length > 0

  // ── Split into upcoming vs past ──────────────────────────────────────
  const upcomingEvents = events.filter(e => e.date >= today)
  const recentJobs     = jobs.filter(j => j.scheduled_date < today && (j.status === 'completed' || j.status === 'flagged'))
    .sort((a: any, b: any) => b.scheduled_date.localeCompare(a.scheduled_date))
    .slice(0, 10)

  return (
    <>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black tracking-tight">
          {greeting}, {firstName}.
        </h1>
      </div>

      {/* Needs Attention */}
      {hasAttention && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Needs Attention
          </p>
          <div className="space-y-2">
            {noJobToday.map((ev) => (
              <Link key={`nojob-${ev.clientId}`} href={`/manager/clients/${ev.clientId}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">No job created — today</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{ev.clientName}</p>
                  </div>
                </div>
              </Link>
            ))}
            {notStartedToday.map((ev) => (
              <Link key={`ns-${ev.job.id}`} href={`/manager/jobs/${ev.job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Not started — today</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {ev.clientName}{ev.job.profiles?.full_name ? ` · ${ev.job.profiles.full_name}` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
            {startedNotDone.map((ev) => (
              <Link key={`sd-${ev.job.id}`} href={`/manager/jobs/${ev.job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Started but not completed</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {ev.clientName} ·{' '}
                      {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
            {missingPhotos.map((ev) => (
              <Link key={`mp-${ev.job.id}`} href={`/manager/jobs/${ev.job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Missing photos</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {ev.clientName} ·{' '}
                      {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming schedule */}
      <section className="mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Upcoming · {upcomingEvents.length} {upcomingEvents.length === 1 ? 'clean' : 'cleans'}
        </p>

        {upcomingEvents.length === 0 ? (
          <div className="bg-white rounded-2xl px-5 py-8 text-center space-y-2">
            <CalendarDays className="w-8 h-8 text-gray-200 mx-auto" />
            <p className="text-sm font-semibold text-gray-500">No upcoming cleans</p>
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
              Make sure clients have a frequency and cleaning days set in their profile.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((ev, idx) => {
              const isToday = ev.date === today
              const dateStr = isToday
                ? 'Today'
                : new Date(ev.date + 'T00:00:00').toLocaleDateString('en-AU', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })

              if (ev.job) {
                // Has a job_assignment — use existing ManagerJobRow
                return <ManagerJobRow key={`${ev.date}-${ev.clientId}-${idx}`} job={ev.job} />
              }

              // Schedule-only: no job_assignment yet
              return (
                <Link
                  key={`${ev.date}-${ev.clientId}-${idx}`}
                  href={`/manager/clients/${ev.clientId}`}
                  className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="flex-shrink-0 text-center min-w-[40px]">
                      <p className={`text-xs font-semibold ${isToday ? 'text-black' : 'text-gray-400'}`}>{dateStr}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black truncate">{ev.clientName}</p>
                      {ev.suburb && <p className="text-xs text-gray-400 mt-0.5">{ev.suburb}</p>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 whitespace-nowrap ml-3">
                    No job
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent completed jobs */}
      {recentJobs.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Recent
          </p>
          <div className="space-y-2">
            {recentJobs.map((job: any) => (
              <ManagerJobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
