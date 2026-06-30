export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'
import { StartCleanButton } from '@/components/portal/cleaner/StartCleanButton'
import { SubmitJobForm } from '@/components/portal/cleaner/SubmitJobForm'
import { FlagModal } from '@/components/portal/cleaner/FlagModal'
import { CleanerSchedule } from '@/components/portal/cleaner/CleanerSchedule'
import type { ScopeTask } from '@/lib/scope'
import { MapPin, Calendar, Key, ClipboardList, CheckCircle2 } from 'lucide-react'
import { getUpcomingDates, actionableDates, brisbaneTodayStr } from '@/lib/schedule'

const FREQ_LABELS: Record<string, string> = {
  weekly:       'Weekly',
  fortnightly:  'Fortnightly',
  monthly:      'Monthly',
  twice_weekly: 'Twice weekly',
  three_weekly: '3x per week',
  four_weekly:  'Every 4 weeks',
  adhoc:        'Ad hoc',
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Australia/Brisbane',
  })
}

export default async function CleanerClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  // Load client + sites via admin so a cleaner assigned only to a SITE (not the whole
  // client) can still reach this page. We authorize manually below.
  const admin = createAdminClient() as any
  const { data: client } = await admin.from('clients').select('*').eq('id', params.id).single()
  if (!client) notFound()

  const { data: sitesRaw } = await admin
    .from('client_sites').select('*').eq('client_id', params.id).order('sort_order', { ascending: true })
  const sites = (sitesRaw ?? []) as any[]
  const mySites = sites.filter((s) => s.assigned_cleaner_id === profile.id)
  const clientAssigned = client.assigned_cleaner_id === profile.id && client.assignment_accepted

  // Must be assigned to the client, or to at least one of its sites.
  if (!clientAssigned && mySites.length === 0) notFound()

  // Check for an actionable job — today's, or a Saturday job carried into Sunday
  const today = brisbaneTodayStr()
  const dates = actionableDates(today)
  const { data: candidateJobs } = await (supabase as any)
    .from('job_assignments')
    .select('*, job_submissions(*)')
    .eq('client_id', params.id)
    .eq('cleaner_id', profile.id)
    .in('scheduled_date', dates)
    .order('scheduled_date', { ascending: false })

  // Prefer an in-progress/flagged job, then one still to do, then a completed one
  const jobs = (candidateJobs ?? []) as any[]
  const todayJob =
    jobs.find((j) => j.status === 'in_progress' || j.status === 'flagged')
    ?? jobs.find((j) => j.status === 'not_started')
    ?? jobs.find((j) => j.status === 'completed')
    ?? null

  const serviceDays: string[] = client.service_days ?? []
  const checklist = todayJob?.checklist ?? []

  // Get upcoming dates using the same schedule engine as the dashboard
  const upcomingDates = getUpcomingDates({
    id:            client.id,
    business_name: client.business_name,
    address:       client.address ?? null,
    suburb:        client.suburb ?? null,
    frequency:     client.frequency ?? null,
    service_days:  serviceDays,
    start_date:    client.start_date ?? null,
  }, 60).slice(0, 5)

  const isInProgress = todayJob?.status === 'in_progress' || todayJob?.status === 'flagged'
  const isCompleted  = todayJob?.status === 'completed'

  // ── Scope-of-works checklist(s) ──
  // Today's completions for the whole client (task ids are unique per site, so one set
  // serves every site checklist). Read via admin so site-only cleaners always see ticks.
  const { data: comps } = await admin
    .from('schedule_completions')
    .select('task_id')
    .eq('client_id', params.id)
    .eq('clean_date', today)
    .eq('done', true)
  const completedIds: string[] = (comps ?? []).map((r: any) => r.task_id)
  const dateLabel = new Date(today + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane',
  })
  const dayKey = (freq: string | null) => FREQ_LABELS[freq ?? ''] ?? freq ?? ''
  const fallbackDays = (svc: string[]) => svc.map((d) => d.slice(0, 3).replace(/^./, (c) => c.toUpperCase()))

  // Which checklists to show: per-site for multi-site clients (only the cleaner's sites,
  // or all sites when assigned at the client level), else a single client-level checklist.
  const siteChecklists =
    sites.length > 0
      ? (mySites.length ? mySites : (clientAssigned ? sites : []))
          .filter((s) => Array.isArray(s.scope) && s.scope.length > 0)
          .map((s) => ({
            key: s.id,
            name: s.site_name as string,
            short: [s.suburb, dayKey(s.frequency)].filter(Boolean).join(' · '),
            scope: s.scope as ScopeTask[],
            cleanDays: (s.clean_days?.length ? s.clean_days : fallbackDays(s.service_days ?? [])) as string[],
          }))
      : []

  const clientScope: ScopeTask[] = Array.isArray(client.scope) ? client.scope : []
  const clientCleanDays: string[] = client.clean_days?.length ? client.clean_days : fallbackDays(serviceDays)
  const clientShort = [client.suburb, dayKey(client.frequency)].filter(Boolean).join(' · ')

  return (
    <PortalShell
      userName={profile.full_name}
      subtitle="Cleaner Portal"
      backHref="/cleaner/dashboard"
      backLabel="Dashboard"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black tracking-tight">{client.business_name}</h1>
      </div>

      {/* Today's schedule checklist(s) */}
      {siteChecklists.length > 0 ? (
        <div className="space-y-4 mb-6">
          {siteChecklists.map((s) => (
            <CleanerSchedule
              key={s.key}
              clientId={params.id}
              clientName={s.name}
              siteShort={s.short}
              scope={s.scope}
              cleanDays={s.cleanDays}
              todayISO={today}
              dateLabel={dateLabel}
              initialCompleted={completedIds}
            />
          ))}
        </div>
      ) : clientScope.length > 0 ? (
        <div className="mb-6">
          <CleanerSchedule
            clientId={params.id}
            clientName={client.business_name}
            siteShort={clientShort}
            scope={clientScope}
            cleanDays={clientCleanDays}
            todayISO={today}
            dateLabel={dateLabel}
            initialCompleted={completedIds}
          />
        </div>
      ) : null}

      {/* Client details */}
      <div className="space-y-3 mb-6">
        {/* Upcoming cleans */}
        {upcomingDates.length > 0 && (
          <div className="bg-white rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming Cleans</p>
            <div className="space-y-2">
              {upcomingDates.map((d, i) => (
                <div key={d.toISOString()} className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-[10px] font-semibold bg-black text-white rounded-full px-2 py-0.5 flex-shrink-0">Next</span>
                  )}
                  <p className={`text-sm ${i === 0 ? 'font-semibold text-black' : 'text-gray-500'}`}>
                    {formatDate(d)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Address */}
        {(client.address || client.suburb) && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Address</p>
              <p className="text-sm font-semibold text-black">
                {[client.address, client.suburb].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Frequency + cleaning days */}
        <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Schedule</p>
            <p className="text-sm font-semibold text-black">
              {FREQ_LABELS[client.frequency] ?? client.frequency ?? '—'}
            </p>
            {serviceDays.length > 0 && (
              <p className="text-sm text-gray-600 mt-0.5">
                {serviceDays.map((d) => DAY_LABELS[d.toLowerCase()] ?? d).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Access details */}
        {client.access_details && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <Key className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Access Details</p>
              <p className="text-sm text-black whitespace-pre-wrap">{client.access_details}</p>
            </div>
          </div>
        )}

        {/* Scope of work */}
        {client.scope_of_work && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Scope of Work</p>
              <p className="text-sm text-black whitespace-pre-wrap">{client.scope_of_work}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Job section ── */}
      <div className="border-t border-gray-100 pt-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Today's Clean</p>

        {/* Completed — show summary + option to restart */}
        {isCompleted && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl px-5 py-5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-black">Clean completed</p>
                <p className="text-xs text-gray-400 mt-0.5">Great work today.</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Need to go back on site?</p>
            <StartCleanButton
              clientId={params.id}
              address={client.address ?? null}
              suburb={client.suburb ?? null}
              label="Start Again"
            />
          </div>
        )}

        {/* In progress — show submit form */}
        {isInProgress && todayJob && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <p className="text-sm font-semibold text-black">Clean in progress</p>
            </div>
            <SubmitJobForm jobId={todayJob.id} checklist={checklist} />
            <FlagModal jobId={todayJob.id} clientId={params.id} />
          </div>
        )}

        {/* Not started */}
        {!todayJob && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Tap below when you arrive on site.</p>
            <StartCleanButton
              clientId={params.id}
              address={client.address ?? null}
              suburb={client.suburb ?? null}
            />
          </div>
        )}
      </div>
    </PortalShell>
  )
}
