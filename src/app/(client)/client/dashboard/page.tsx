export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientShell } from '@/components/portal/ClientShell'
import { getUpcomingDates } from '@/lib/schedule'
import { CalendarDays, CheckCircle2, History } from 'lucide-react'

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

function formatTimeAU(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Australia/Brisbane',
  })
}

export default async function ClientDashboardPage() {
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

  const clientId = profile.linked_client_id
  const today = new Date().toISOString().split('T')[0]

  const [{ data: client }, { data: lastJob }, { data: nextJob }, { data: historyJobs }] = await Promise.all([
    (supabase as any)
      .from('clients')
      .select('business_name, frequency, service_days, days_per_week, start_date')
      .eq('id', clientId)
      .single(),

    // Most recent completed job
    (supabase as any)
      .from('job_assignments')
      .select('scheduled_date, job_submissions(completed_at, notes, completed_by_role)')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .single(),

    // Next upcoming job
    (supabase as any)
      .from('job_assignments')
      .select('scheduled_date, status, profiles(full_name)')
      .eq('client_id', clientId)
      .gte('scheduled_date', today)
      .in('status', ['not_started', 'in_progress'])
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .single(),

    // All service history
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, job_submissions(completed_at, notes, completed_by_role)')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false })
      .limit(100),
  ])

  const lastSub = Array.isArray(lastJob?.job_submissions)
    ? (lastJob.job_submissions[0] ?? null)
    : (lastJob?.job_submissions ?? null)

  // If no scheduled job assignment, calculate next expected date from client's frequency + service_days
  let scheduledNextDate: string | null = null
  if (!nextJob && client?.frequency && (client?.service_days ?? []).length > 0) {
    const upcoming = getUpcomingDates({
      id: clientId,
      business_name: client.business_name,
      address: null,
      suburb: null,
      frequency: client.frequency,
      service_days: client.service_days ?? [],
      start_date: client.start_date ?? null,
    }, 90)
    if (upcoming.length > 0) {
      scheduledNextDate = upcoming[0].toISOString().split('T')[0]
    }
  }

  const greeting = getBrisbaneGreeting()

  return (
    <ClientShell clientName={client?.business_name} userName={profile.full_name} activePath="/client/dashboard">

      {/* Greeting */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-black tracking-tight">
          {greeting}{client?.business_name ? `, ${client.business_name}` : ''}
        </h1>
        <p className="text-gray-500 mt-2">Your service overview</p>
      </div>

      {/* Next / Last clean */}
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
              {((client?.service_days ?? []) as string[]).length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Every {(client.service_days as string[]).join(' & ')}
                  {client?.days_per_week ? ` · ${client.days_per_week}× per week` : ''}
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
              {lastSub?.completed_at && lastSub?.completed_by_role === 'cleaner' && (
                <p className="text-xs text-gray-400 mt-1">
                  Finished at {formatTimeAU(lastSub.completed_at)}
                </p>
              )}
              {/* Never show cleaner notes or admin/manager identity to client */}
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
            {historyJobs.map((job: any) => {
              const sub = Array.isArray(job.job_submissions)
                ? (job.job_submissions[0] ?? null)
                : (job.job_submissions ?? null)
              const byRole: string | null = sub?.completed_by_role ?? null
              const cleanerDid = byRole === 'cleaner' || byRole == null
              return (
                <div key={job.id} className="py-3.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-black flex-shrink-0 mt-1.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black">{formatDateAU(job.scheduled_date)}</p>
                      {cleanerDid && sub?.completed_at ? (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Completed {formatTimeAU(sub.completed_at)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Completed</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No completed cleans yet.</p>
        )}
      </div>

    </ClientShell>
  )
}
