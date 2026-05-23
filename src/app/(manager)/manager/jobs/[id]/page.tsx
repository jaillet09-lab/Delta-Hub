import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResolveButton } from '@/components/portal/manager/ResolveButton'
import { MarkJobCompleteButton } from '@/components/team/MarkJobCompleteButton'
import { PhotoGrid } from '@/components/ui/PhotoLightbox'
import { MapPin, User, AlertTriangle, Link as LinkIcon } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
  flagged:     'Flagged',
}

function formatBrisbaneTime(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Brisbane',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ManagerJobDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: job }, { data: submission }, { data: flags }] = await Promise.all([
    (supabase as any)
      .from('job_assignments')
      .select('*, clients(business_name, address, suburb), profiles(full_name)')
      .eq('id', params.id)
      .single(),
    (supabase as any)
      .from('job_submissions')
      .select('*')
      .eq('job_id', params.id)
      .single(),
    (supabase as any)
      .from('job_flags')
      .select('*')
      .eq('job_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!job) notFound()

  const checklist: { id: string; label: string }[] = job.checklist ?? []
  const completedMap: Record<string, boolean> = submission?.checklist_completed ?? {}
  const photos: string[] = submission?.photo_urls ?? []
  const videos: string[] = submission?.video_urls ?? []

  const completedByRole: string | null = submission?.completed_by_role ?? null
  const cleanerCompleted =
    submission?.completed_at &&
    (completedByRole === 'cleaner' || completedByRole == null)
  const overrideCompleted = submission?.completed_at && (completedByRole === 'admin' || completedByRole === 'manager')

  // Determine started_at: prefer submission.started_at, fallback to submitted_at
  const startedAt = submission?.started_at ?? null
  const completedAt = submission?.completed_at ?? submission?.submitted_at ?? null

  let durationMin: number | null = null
  if (startedAt && completedAt && cleanerCompleted) {
    durationMin = Math.round(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000
    )
  }

  return (
    <>
      {/* Back + title */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/manager/dashboard" className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-black transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Jobs
        </Link>
      </div>
      <h1 className="text-lg font-bold text-black mb-4">{job.clients?.business_name ?? 'Job'}</h1>

      {/* Header card */}
      <div className="bg-white rounded-2xl px-5 py-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">
              {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
            {job.profiles?.full_name && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-700">{job.profiles.full_name}</p>
              </div>
            )}
            {job.clients?.address && (
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  {[job.clients.address, job.clients.suburb].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>
          <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
            job.status === 'completed'   ? 'bg-black text-white' :
            job.status === 'in_progress' ? 'border border-black text-black' :
            job.status === 'flagged'     ? 'bg-gray-900 text-white' :
            'bg-gray-100 text-gray-500'
          }`}>
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
      </div>

      {/* Mark as Complete — manager override */}
      {job.status !== 'completed' && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Actions</p>
          <MarkJobCompleteButton
            jobId={job.id}
            currentStatus={job.status}
            cleanerCompleted={!!cleanerCompleted}
            role="manager"
          />
        </div>
      )}

      {/* Override banner — if admin/manager completed it */}
      {overrideCompleted && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Completion</p>
          <p className="text-sm font-semibold text-gray-800">
            Marked as complete by {completedByRole}
          </p>
          {submission?.notes && (
            <p className="text-xs text-gray-500 mt-1 italic">{submission.notes}</p>
          )}
        </div>
      )}

      {/* Timing — only shown for cleaner submissions */}
      {cleanerCompleted && (startedAt || completedAt) && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Timing</p>
          <div className="flex gap-6 flex-wrap">
            {startedAt && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Started</p>
                <p className="text-sm font-semibold text-black">{formatBrisbaneTime(startedAt)}</p>
              </div>
            )}
            {completedAt && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Completed</p>
                <p className="text-sm font-semibold text-black">{formatBrisbaneTime(completedAt)}</p>
              </div>
            )}
            {durationMin != null && durationMin > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                <p className="text-sm font-semibold text-black">{durationMin} min</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Photos ({photos.length})
          </p>
          <PhotoGrid photos={photos} />
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Videos ({videos.length})
          </p>
          <div className="space-y-2">
            {videos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-black hover:underline"
              >
                <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">Video {i + 1}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Checklist</p>
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className={`w-4 h-4 rounded-full flex-shrink-0 ${completedMap[item.id] ? 'bg-black' : 'border-2 border-gray-200'}`} />
                <span className={`text-sm ${completedMap[item.id] ? 'text-black' : 'text-gray-400'}`}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {submission?.notes && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.notes}</p>
        </div>
      )}

      {/* Flags */}
      {flags && flags.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Flags ({flags.length})
          </p>
          {flags.map((flag: any) => (
            <div key={flag.id} className="bg-white rounded-2xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-gray-500" />
                    <p className="text-xs text-gray-400">
                      {new Date(flag.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700">{flag.description}</p>
                  {flag.resolved && (
                    <p className="text-xs text-gray-400 mt-1">Resolved</p>
                  )}
                </div>
                {!flag.resolved && <ResolveButton flagId={flag.id} type="flag" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
