export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientShell } from '@/components/portal/ClientShell'
import { getUpcomingDates } from '@/lib/schedule'
import { CalendarDays, CheckCircle2, History, MapPin } from 'lucide-react'

function getBrisbaneGreeting(): string {
  const hour = parseInt(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }),
    10
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDateAU(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams?: { site?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, linked_client_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.linked_client_id) {
    return (
      <ClientShell userName={profile?.full_name}>
        <div className="text-center py-20">
          <p className="text-gray-500 text-sm">Your account is not linked to a client. Contact Delta Cleaning.</p>
        </div>
      </ClientShell>
    )
  }

  const clientId       = profile.linked_client_id
  const today          = new Date().toISOString().split('T')[0]
  const selectedSiteId = searchParams?.site || null

  const [{ data: client }, { data: sitesRaw }] = await Promise.all([
    (supabase as any)
      .from('clients')
      .select('business_name, frequency, service_days, days_per_week, start_date, is_multi_site')
      .eq('id', clientId)
      .single(),
    (supabase as any)
      .from('client_sites')
      .select('id, site_name, suburb, frequency, service_days, days_per_week')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true }),
  ])

  const sites      = (sitesRaw ?? []) as any[]
  const isMultiSite = client?.is_multi_site && sites.length > 1
  const showAllSites = isMultiSite && !selectedSiteId

  // ── ALL SITES mode ──────────────────────────────────────────────────────────
  if (showAllSites) {
    // Fetch all upcoming + completed jobs across all sites
    const [{ data: upcomingJobs }, { data: allHistory }] = await Promise.all([
      (supabase as any)
        .from('job_assignments')
        .select('id, scheduled_date, status, site_id, profiles(full_name)')
        .eq('client_id', clientId)
        .gte('scheduled_date', today)
        .in('status', ['not_started', 'in_progress', 'completed'])
        .order('scheduled_date', { ascending: true })
        .limit(50),
      (supabase as any)
        .from('job_assignments')
        .select('id, scheduled_date, site_id, job_submissions(completed_at, completed_by_role)')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(100),
    ])

    const upcoming  = (upcomingJobs ?? []) as any[]
    const history   = (allHistory   ?? []) as any[]

    // Build per-site data
    const siteData = sites.map((site: any) => {
      const siteUpcoming = upcoming.filter((j: any) => j.site_id === site.id)
      const siteHistory  = history.filter((j: any) => j.site_id === site.id)

      const nextJob  = siteUpcoming[0] ?? null
      const lastJob  = siteHistory[0]  ?? null

      // Calculate from schedule if no job record
      let scheduledNext: string | null = null
      if (!nextJob && site.frequency && (site.service_days ?? []).length > 0) {
        const upcoming = getUpcomingDates({
          id: site.id,
          business_name: site.site_name,
          address: null,
          suburb: site.suburb ?? null,
          frequency: site.frequency,
          service_days: site.service_days ?? [],
          start_date: client?.start_date ?? null,
        }, 90)
        if (upcoming.length > 0) scheduledNext = upcoming[0].toISOString().split('T')[0]
      }

      return { site, nextJob, lastJob, scheduledNext, historyCount: siteHistory.length }
    })

    return (
      <ClientShell
        clientName={client?.business_name}
        userName={profile.full_name}
        activePath="/client/dashboard"
        sites={sites.map((s: any) => ({ id: s.id, site_name: s.site_name, suburb: s.suburb }))}
        selectedSiteId={null}
      >
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-black tracking-tight">
            {getBrisbaneGreeting()}{client?.business_name ? `, ${client.business_name}` : ''}
          </h1>
          <p className="text-gray-500 mt-2">All sites overview</p>
        </div>

        {/* Per-site cards */}
        <div className="space-y-4 mb-10">
          {siteData.map(({ site, nextJob, lastJob, scheduledNext, historyCount }) => {
            const nextDate = nextJob?.scheduled_date ?? scheduledNext
            const isToday  = nextDate === today
            const isInProgress = nextJob?.status === 'in_progress'

            return (
              <div key={site.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Site header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-black">{site.site_name}</p>
                      {site.suburb && <p className="text-xs text-gray-400">{site.suburb}</p>}
                    </div>
                  </div>
                  {isInProgress && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-black border border-black px-3 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      In Progress
                    </span>
                  )}
                  {isToday && !isInProgress && (
                    <span className="text-xs font-semibold text-black bg-gray-100 px-3 py-1 rounded-full">Today</span>
                  )}
                </div>

                {/* Next / Last */}
                <div className="grid grid-cols-2 divide-x divide-gray-50">
                  <div className="px-6 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Next Clean</p>
                    {nextDate ? (
                      <p className="text-sm font-semibold text-black">{formatDateShort(nextDate)}</p>
                    ) : (
                      <p className="text-sm text-gray-400">Not scheduled</p>
                    )}
                    {site.frequency && (
                      <p className="text-xs text-gray-400 mt-1 capitalize">{site.frequency}</p>
                    )}
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Last Clean</p>
                    {lastJob ? (
                      <p className="text-sm font-semibold text-black">{formatDateAU(lastJob.scheduled_date)}</p>
                    ) : (
                      <p className="text-sm text-gray-400">No history</p>
                    )}
                    {historyCount > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{historyCount} total</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Combined history */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl p-7 border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <History className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Service History · {history.length} cleans across all sites
              </p>
            </div>
            <div className="space-y-0">
              {history.map((job: any) => {
                const siteName = sites.find((s: any) => s.id === job.site_id)?.site_name ?? null
                return (
                  <div key={job.id} className="py-3.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-black flex-shrink-0 mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-black">{formatDateAU(job.scheduled_date)}</p>
                          {siteName && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{siteName}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Completed</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ClientShell>
    )
  }

  // ── SINGLE SITE / SINGLE CLIENT mode ────────────────────────────────────────
  const scheduleSource = isMultiSite && selectedSiteId
    ? sites.find((s: any) => s.id === selectedSiteId) ?? client
    : client

  function applyJobFilters(q: any) {
    q = q.eq('client_id', clientId)
    if (isMultiSite && selectedSiteId) q = q.eq('site_id', selectedSiteId)
    return q
  }

  const [{ data: lastJob }, { data: nextJob }, { data: historyJobs }] = await Promise.all([
    applyJobFilters(
      (supabase as any)
        .from('job_assignments')
        .select('scheduled_date, job_submissions(completed_at, notes, completed_by_role)')
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(1)
    ).single(),
    applyJobFilters(
      (supabase as any)
        .from('job_assignments')
        .select('scheduled_date, status, profiles(full_name)')
        .gte('scheduled_date', today)
        .in('status', ['not_started', 'in_progress'])
        .order('scheduled_date', { ascending: true })
        .limit(1)
    ).single(),
    applyJobFilters(
      (supabase as any)
        .from('job_assignments')
        .select('id, scheduled_date, job_submissions(completed_at, notes, completed_by_role)')
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false })
        .limit(100)
    ),
  ])

  const lastSub = Array.isArray(lastJob?.job_submissions)
    ? (lastJob.job_submissions[0] ?? null)
    : (lastJob?.job_submissions ?? null)

  let scheduledNextDate: string | null = null
  if (!nextJob && scheduleSource?.frequency && (scheduleSource?.service_days ?? []).length > 0) {
    const upcoming = getUpcomingDates({
      id: clientId,
      business_name: client?.business_name ?? '',
      address: null,
      suburb: null,
      frequency: scheduleSource.frequency,
      service_days: scheduleSource.service_days ?? [],
      start_date: (scheduleSource as any).start_date ?? client?.start_date ?? null,
    }, 90)
    if (upcoming.length > 0) scheduledNextDate = upcoming[0].toISOString().split('T')[0]
  }

  return (
    <ClientShell
      clientName={client?.business_name}
      userName={profile.full_name}
      activePath="/client/dashboard"
      sites={isMultiSite ? sites.map((s: any) => ({ id: s.id, site_name: s.site_name, suburb: s.suburb })) : undefined}
      selectedSiteId={isMultiSite ? selectedSiteId : undefined}
    >
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-black tracking-tight">
          {getBrisbaneGreeting()}{client?.business_name ? `, ${client.business_name}` : ''}
        </h1>
        <p className="text-gray-500 mt-2">Your service overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Next clean */}
        <div className="bg-white rounded-2xl p-7 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Next Clean</p>
          </div>
          {nextJob ? (
            <div>
              <p className="text-2xl font-bold text-black">
                {new Date(nextJob.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </p>
              {nextJob.profiles?.full_name && (
                <p className="text-sm text-gray-500 mt-2">With {nextJob.profiles.full_name}</p>
              )}
              {nextJob.status === 'in_progress' && (
                <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-black border border-black px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                  In Progress Now
                </span>
              )}
            </div>
          ) : scheduledNextDate ? (
            <div>
              <p className="text-2xl font-bold text-black">
                {new Date(scheduledNextDate + 'T00:00:00').toLocaleDateString('en-AU', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </p>
              {((scheduleSource?.service_days ?? []) as string[]).length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Every {(scheduleSource.service_days as string[]).join(' & ')}
                  {scheduleSource?.days_per_week ? ` · ${scheduleSource.days_per_week}× per week` : ''}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No upcoming cleans scheduled.</p>
          )}
        </div>

        {/* Last clean */}
        <div className="bg-white rounded-2xl p-7 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Last Clean</p>
          </div>
          {lastJob ? (
            <div>
              <p className="text-2xl font-bold text-black">Completed</p>
              <p className="text-sm text-gray-500 mt-1">{formatDateAU(lastJob.scheduled_date)}</p>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No previous cleans recorded.</p>
          )}
        </div>
      </div>

      {/* Service History */}
      <div className="bg-white rounded-2xl p-7 border border-gray-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <History className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Service History · {(historyJobs ?? []).length} cleans
          </p>
        </div>
        {historyJobs && historyJobs.length > 0 ? (
          <div className="space-y-0">
            {historyJobs.map((job: any) => (
              <div key={job.id} className="py-3.5 border-b border-gray-50 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-black flex-shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">{formatDateAU(job.scheduled_date)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Completed</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No completed cleans yet.</p>
        )}
      </div>
    </ClientShell>
  )
}
