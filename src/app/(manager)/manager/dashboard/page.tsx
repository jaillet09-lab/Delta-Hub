export const dynamic   = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUpcomingDates } from '@/lib/schedule'
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react'

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function brisbaneTomorrow(): string {
  const d = new Date(Date.now() + 86_400_000)
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

type ScheduleEvent = {
  date: string
  clientId: string
  clientName: string
  suburb: string | null
  job: any | null
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function fmtShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default async function ManagerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today    = brisbaneToday()
  const tomorrow = brisbaneTomorrow()
  const pastFrom = new Date(Date.now() -  7 * 86_400_000).toISOString().split('T')[0]
  const ahead    = new Date(Date.now() + 90 * 86_400_000).toISOString().split('T')[0]

  const hour = parseInt(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }), 10
  )
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const [{ data: profile }, { data: clientsRaw }, { data: jobsRaw }] = await Promise.all([
    (supabase as any).from('profiles').select('full_name').eq('user_id', user.id).single(),
    (supabase as any)
      .from('clients')
      .select('id, business_name, suburb, frequency, service_days, start_date, is_multi_site')
      .eq('active', true)
      .not('frequency', 'is', null)
      .order('business_name'),
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, client_id, clients(business_name, suburb), profiles(full_name), job_submissions(started_at, completed_at, photo_urls)')
      .gte('scheduled_date', pastFrom)
      .lte('scheduled_date', ahead)
      .order('scheduled_date', { ascending: true }),
  ])

  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'there'
  const clients   = (clientsRaw ?? []) as any[]
  const jobs      = (jobsRaw    ?? []) as any[]

  // Build job lookup
  const jobMap = new Map<string, any>()
  for (const job of jobs) {
    jobMap.set(`${job.client_id}::${job.scheduled_date}`, job)
  }

  // Generate schedule events from client schedules
  const events: ScheduleEvent[] = []
  const matchedJobIds = new Set<string>()

  for (const client of clients) {
    if (client.is_multi_site) continue
    if (!(client.service_days ?? []).length) continue

    const dates = getUpcomingDates({
      id:           client.id,
      business_name: client.business_name,
      address:      null,
      suburb:       client.suburb ?? null,
      frequency:    client.frequency,
      service_days: client.service_days ?? [],
      start_date:   client.start_date ?? null,
    }, 90)

    for (const d of dates) {
      const dateStr = d.toISOString().split('T')[0]
      if (dateStr > ahead) break
      const job = jobMap.get(`${client.id}::${dateStr}`) ?? null
      if (job) matchedJobIds.add(job.id)
      events.push({ date: dateStr, clientId: client.id, clientName: client.business_name, suburb: client.suburb ?? null, job })
    }
  }

  // Add unmatched job_assignments (e.g. manually created one-offs)
  for (const job of jobs) {
    if (!matchedJobIds.has(job.id)) {
      events.push({ date: job.scheduled_date, clientId: job.client_id, clientName: job.clients?.business_name ?? 'Unknown', suburb: job.clients?.suburb ?? null, job })
    }
  }

  events.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.clientName.localeCompare(b.clientName))

  // Group
  const todayAllEvents     = events.filter(e => e.date === today)
  const todayEvents        = todayAllEvents.filter(e => e.job?.status !== 'completed')
  const completedToday     = todayAllEvents.filter(e => e.job?.status === 'completed')
  const tomorrowEvents     = events.filter(e => e.date === tomorrow)
  const upcomingEvents     = events.filter(e => e.date > tomorrow)
  const recentJobs         = jobs
    .filter((j: any) => j.scheduled_date < today)
    .sort((a: any, b: any) => b.scheduled_date.localeCompare(a.scheduled_date))
    .slice(0, 8)

  function getSub(job: any) {
    const s = job?.job_submissions
    return Array.isArray(s) ? (s[0] ?? null) : (s ?? null)
  }

  // Status helpers
  function StatusBadge({ ev, showNotStarted = false }: { ev: ScheduleEvent; showNotStarted?: boolean }) {
    const job = ev.job
    if (!job) {
      if (!showNotStarted) return null
      return <span className="flex items-center gap-1 text-xs text-gray-400"><Circle className="w-3 h-3" />Not started</span>
    }
    if (job.status === 'completed')   return <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />Complete</span>
    if (job.status === 'flagged')     return <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><AlertTriangle className="w-3.5 h-3.5" />Flagged</span>
    if (job.status === 'in_progress') return <span className="flex items-center gap-1 text-xs font-semibold text-blue-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />In progress</span>
    return <span className="flex items-center gap-1 text-xs text-gray-400"><Circle className="w-3 h-3" />Not started</span>
  }

  function CleanCard({ ev, dark = false, showNotStarted = false }: { ev: ScheduleEvent; dark?: boolean; showNotStarted?: boolean }) {
    const href = ev.job ? `/manager/jobs/${ev.job.id}` : `/manager/clients/${ev.clientId}`
    const cleaner = ev.job?.profiles?.full_name ?? null
    return (
      <Link href={href} className="block active:scale-[0.98] transition-all">
        <div className={`rounded-2xl px-5 py-4 flex items-center justify-between gap-3 ${dark ? 'bg-black text-white' : 'bg-white'}`}>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-black'}`}>{ev.clientName}</p>
            <p className={`text-xs mt-0.5 truncate ${dark ? 'text-gray-400' : 'text-gray-400'}`}>
              {cleaner ?? (ev.suburb ?? 'No cleaner assigned')}
            </p>
          </div>
          <div className={dark ? '[&_span]:!text-white [&_.text-gray-400]:!text-gray-400 [&_.text-emerald-600]:!text-emerald-400 [&_.text-blue-500]:!text-blue-300 [&_.text-red-500]:!text-red-400 [&_svg]:stroke-current' : ''}>
            <StatusBadge ev={ev} showNotStarted={showNotStarted} />
          </div>
        </div>
      </Link>
    )
  }

  const hasTodayOrTomorrow = todayEvents.length > 0 || completedToday.length > 0 || tomorrowEvents.length > 0

  return (
    <div className="space-y-7">

      {/* Greeting */}
      <p className="text-2xl font-bold text-black tracking-tight">{greeting}, {firstName}.</p>

      {/* TODAY — black cards, most prominent */}
      {todayEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-black uppercase tracking-widest">Today</p>
            <p className="text-xs text-gray-400">{fmtDate(today)}</p>
          </div>
          <div className="space-y-2">
            {todayEvents.map((ev, i) => <CleanCard key={i} ev={ev} dark showNotStarted />)}
          </div>
        </section>
      )}

      {/* TOMORROW */}
      {tomorrowEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Tomorrow</p>
            <p className="text-xs text-gray-400">{fmtDate(tomorrow)}</p>
          </div>
          <div className="space-y-2">
            {tomorrowEvents.map((ev, i) => <CleanCard key={i} ev={ev} />)}
          </div>
        </section>
      )}

      {/* UPCOMING — grouped by date */}
      {upcomingEvents.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming</p>
          {/* Group by date */}
          {(() => {
            const groups: Map<string, ScheduleEvent[]> = new Map()
            for (const ev of upcomingEvents) {
              if (!groups.has(ev.date)) groups.set(ev.date, [])
              groups.get(ev.date)!.push(ev)
            }
            return Array.from(groups.entries()).map(([date, evs]) => (
              <div key={date} className="mb-4">
                <p className="text-xs text-gray-400 mb-2 ml-1">{fmtShort(date)}</p>
                <div className="space-y-2">
                  {evs.map((ev, i) => <CleanCard key={i} ev={ev} />)}
                </div>
              </div>
            ))
          })()}
        </section>
      )}

      {/* COMPLETED TODAY — below upcoming */}
      {completedToday.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Completed today</p>
            <p className="text-xs text-gray-400">{completedToday.length} {completedToday.length === 1 ? 'job' : 'jobs'}</p>
          </div>
          <div className="space-y-2">
            {completedToday.map((ev, i) => <CleanCard key={i} ev={ev} showNotStarted />)}
          </div>
        </section>
      )}

      {/* Empty state if nothing today/tomorrow/upcoming */}
      {!hasTodayOrTomorrow && upcomingEvents.length === 0 && (
        <div className="bg-white rounded-2xl px-5 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-gray-500">No cleans scheduled</p>
          <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
            Make sure clients have a frequency and cleaning days set in their profile.
          </p>
        </div>
      )}

      {/* RECENT — past jobs */}
      {recentJobs.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Recent</p>
          <div className="space-y-2">
            {recentJobs.map((job: any) => {
              const ev: ScheduleEvent = {
                date: job.scheduled_date,
                clientId: job.client_id,
                clientName: job.clients?.business_name ?? 'Unknown',
                suburb: job.clients?.suburb ?? null,
                job,
              }
              return <CleanCard key={job.id} ev={ev} />
            })}
          </div>
        </section>
      )}

    </div>
  )
}
