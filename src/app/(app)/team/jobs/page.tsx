import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { CreateJobForm } from '@/components/team/CreateJobForm'
import { MarkJobCompleteButton } from '@/components/team/MarkJobCompleteButton'
import { ArrowLeft } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  not_started: 'text-gray-500',
  in_progress: 'text-blue-600',
  completed:   'text-emerald-600',
  flagged:     'text-red-600',
}

export default async function AdminJobsPage() {
  const supabase = createClient()

  const [{ data: profiles }, { data: clients }, { data: jobs }] = await Promise.all([
    (supabase as any).from('profiles').select('id, full_name, role').eq('role', 'cleaner').order('full_name'),
    (supabase as any).from('clients').select('id, business_name, address, suburb, frequency').eq('active', true).order('business_name'),
    (supabase as any)
      .from('job_assignments')
      .select('*, clients(business_name), profiles(full_name), job_submissions(completed_by_role, completed_at)')
      .order('scheduled_date', { ascending: false })
      .limit(50),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/team" className="text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Job Assignments</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Assign Job</h2>
            <CreateJobForm
              cleaners={profiles ?? []}
              clients={clients ?? []}
            />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Recent Jobs</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(jobs ?? []).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No jobs assigned yet.</p>
              )}
              {(jobs ?? []).map((job: any) => {
                const sub = Array.isArray(job.job_submissions)
                  ? (job.job_submissions[0] ?? null)
                  : (job.job_submissions ?? null)
                const cleanerCompleted =
                  sub?.completed_at &&
                  (sub?.completed_by_role === 'cleaner' || sub?.completed_by_role == null)
                return (
                  <div key={job.id} className="px-5 py-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {job.clients?.business_name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                          {job.profiles?.full_name ? ` · ${job.profiles.full_name}` : ' · Unassigned'}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold capitalize flex-shrink-0 ${STATUS_COLORS[job.status] ?? 'text-slate-400'}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                    <MarkJobCompleteButton
                      jobId={job.id}
                      currentStatus={job.status}
                      cleanerCompleted={!!cleanerCompleted}
                      role="admin"
                    />
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
