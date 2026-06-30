export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'
import { AcceptClientButton } from '@/components/portal/cleaner/AcceptClientButton'
import { buildSchedule, actionableDates, brisbaneTodayStr } from '@/lib/schedule'
import { ChevronRight, Briefcase, Calendar, AlertCircle, XCircle } from 'lucide-react'

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
  twice_weekly: 'Twice weekly', three_weekly: '3x per week',
  four_weekly: 'Every 4 weeks', adhoc: 'Ad hoc',
}

function dateLabel(dateStr: string): string {
  const d     = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const tom   = new Date(today); tom.setDate(tom.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tom.toDateString())   return 'Tomorrow'
  return d.toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Australia/Brisbane',
  })
}

export default async function CleanerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const today = brisbaneTodayStr()
  const dates = actionableDates(today)   // today + Saturday when it's Sunday

  const pastFrom = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]

  // Fetch clients + active jobs (weekend-aware) + past not-started jobs in parallel
  const [{ data: clients }, { data: activeJobs }, { data: missedJobsRaw }] = await Promise.all([
    (supabase as any)
      .from('clients')
      .select('id, business_name, address, suburb, frequency, service_days, start_date, assignment_accepted')
      .eq('assigned_cleaner_id', profile.id)
      .eq('active', true)
      .order('business_name'),
    (supabase as any)
      .from('job_assignments')
      .select('id, status, client_id, clients(business_name, address, suburb)')
      .eq('cleaner_id', profile.id)
      .in('scheduled_date', dates)
      .in('status', ['in_progress', 'flagged']),
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, client_id, clients(business_name, suburb)')
      .eq('cleaner_id', profile.id)
      .gte('scheduled_date', pastFrom)
      .lt('scheduled_date', today)
      .eq('status', 'not_started')
      .order('scheduled_date', { ascending: false }),
  ])

  const allClients: any[] = clients ?? []
  const pending  = allClients.filter((c) => !c.assignment_accepted)
  const accepted = allClients.filter((c) => c.assignment_accepted)
  const inProgressJob = (activeJobs ?? [])[0] ?? null

  // Sites this cleaner is assigned to individually (multi-site clients). The parent client may
  // not be assigned to them at the client level, so fetch via admin scoped to this cleaner.
  const adminDb = createAdminClient() as any
  const { data: mySitesRaw } = await adminDb
    .from('client_sites')
    .select('id, site_name, suburb, client_id, clients(business_name, active)')
    .eq('assigned_cleaner_id', profile.id)
  const assignedSites: any[] = (mySitesRaw ?? []).filter((s: any) => s.clients?.active !== false)

  // Split past not-started jobs: a Saturday job carried into Sunday is still due
  // (actionable), everything older is a genuine missed clean.
  const pastNotStarted: any[] = missedJobsRaw ?? []
  const dueWeekend: any[] = pastNotStarted.filter((j) => dates.includes(j.scheduled_date))
  const missedJobs: any[]  = pastNotStarted.filter((j) => !dates.includes(j.scheduled_date))

  // Build upcoming schedule (next 14 days) from accepted clients
  const schedule = buildSchedule(accepted, 14)

  // Group by date label, skip today if job already in progress
  const grouped: Record<string, typeof schedule> = {}
  for (const event of schedule) {
    const label = dateLabel(event.dateStr)
    // If there's already an active job for this client today, mark it handled
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(event)
  }

  const firstName = (profile.full_name ?? user.email ?? '').split(' ')[0]
  const hour = parseInt(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }), 10
  )
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <PortalShell userName={profile.full_name} subtitle="Cleaner Portal">

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black tracking-tight">
          {greeting}, {firstName}.
        </h1>
      </div>

      {/* ── 1. JOB IN PROGRESS (only when active) ── */}
      {inProgressJob && (
        <section className="mb-6">
          <Link href={`/cleaner/clients/${inProgressJob.client_id}`} className="block">
            <div className="bg-black text-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:opacity-80 transition-opacity">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-0.5">
                    {inProgressJob.status === 'flagged' ? 'Flagged — still open' : 'Clean in progress'}
                  </p>
                  <p className="text-base font-bold text-white truncate">
                    {inProgressJob.clients?.business_name ?? 'Current job'}
                  </p>
                  {inProgressJob.clients?.address && (
                    <p className="text-xs text-white/50 mt-0.5 truncate">{inProgressJob.clients.address}</p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 bg-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white">
                Finish →
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── 1a. DUE THIS WEEKEND (Saturday jobs carried into Sunday) ── */}
      {dueWeekend.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            Still due this weekend
          </p>
          <div className="space-y-2">
            {dueWeekend.map((job: any) => {
              const d = new Date(job.scheduled_date + 'T00:00:00')
              const dl = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
              return (
                <Link key={job.id} href={`/cleaner/clients/${job.client_id}`} className="block">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-amber-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black truncate">{job.clients?.business_name ?? '—'}</p>
                      <p className="text-xs text-amber-600 mt-0.5">{dl}'s clean · tap to start</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 1b. MISSED CLEANS (tap to do them late) ── */}
      {missedJobs.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5" />
            Missed Clean{missedJobs.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {missedJobs.map((job: any) => {
              const d = new Date(job.scheduled_date + 'T00:00:00')
              const dateLabel = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <Link key={job.id} href={`/cleaner/clients/${job.client_id}`} className="block">
                  <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-red-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black truncate">{job.clients?.business_name ?? '—'}</p>
                      <p className="text-xs text-red-400 mt-0.5">{dateLabel} · Not completed — tap to catch up</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 2. NEW ASSIGNMENTS (only when pending) ── */}
      {pending.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            New Assignment{pending.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            {pending.map((client: any) => (
              <div key={client.id} className="bg-white rounded-2xl px-5 py-4">
                <p className="text-sm font-semibold text-black mb-1">{client.business_name}</p>
                {(client.address || client.suburb) && (
                  <p className="text-xs text-gray-500 mb-1">
                    {[client.address, client.suburb].filter(Boolean).join(', ')}
                  </p>
                )}
                {client.frequency && (
                  <p className="text-xs text-gray-400 mb-3">
                    {FREQ_LABELS[client.frequency] ?? client.frequency}
                    {(client.service_days ?? []).length > 0 && (
                      <> · {(client.service_days as string[]).map((d) => DAY_LABELS[d] ?? d).join(', ')}</>
                    )}
                  </p>
                )}
                <AcceptClientButton clientId={client.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. UPCOMING CLEANS (shown when no job in progress) ── */}
      {!inProgressJob && Object.keys(grouped).length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            Upcoming Cleans
          </p>
          <div className="space-y-3">
            {Object.entries(grouped).map(([label, events]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 ml-1">{label}</p>
                {events.map((ev) => (
                  <Link key={`${ev.dateStr}-${ev.client.id}`} href={`/cleaner/clients/${ev.client.id}`} className="block mb-2">
                    <div className="bg-white rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-black truncate">{ev.client.business_name}</p>
                        {ev.client.suburb && (
                          <p className="text-xs text-gray-400 mt-0.5">{ev.client.suburb}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-medium text-gray-400">
                          {FREQ_LABELS[ev.client.frequency ?? ''] ?? ev.client.frequency}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── MY SITES (individually-assigned sites of multi-site clients) ── */}
      {assignedSites.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">My Sites</p>
          <div className="space-y-2">
            {assignedSites.map((site: any) => (
              <Link key={site.id} href={`/cleaner/clients/${site.client_id}?site=${site.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{site.site_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {site.clients?.business_name}{site.suburb ? ` · ${site.suburb}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── MY CLIENTS ── */}
      {accepted.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">My Clients</p>
          <div className="space-y-2">
            {accepted.map((client: any) => (
              <Link key={client.id} href={`/cleaner/clients/${client.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black truncate">{client.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {FREQ_LABELS[client.frequency] ?? client.frequency ?? '—'}
                      {(client.service_days ?? []).length > 0 && (
                        <> · {(client.service_days as string[]).map((d: string) => DAY_LABELS[d] ?? d).join(', ')}</>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── EMPTY STATE ── */}
      {allClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Briefcase className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">No clients assigned yet</p>
          <p className="text-xs text-gray-400 mt-1">Your manager will assign clients to you.</p>
        </div>
      )}


    </PortalShell>
  )
}
