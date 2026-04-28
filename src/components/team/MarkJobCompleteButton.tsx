'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { adminMarkJobCompleteAction } from '@/actions/jobs'

interface Props {
  jobId: string
  currentStatus: string
  /** True if a cleaner has already submitted this job — hides the button */
  cleanerCompleted?: boolean
  role?: 'admin' | 'manager'
}

export function MarkJobCompleteButton({
  jobId,
  currentStatus,
  cleanerCompleted = false,
  role = 'admin',
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Already done by admin/manager
  if (currentStatus === 'completed' && !cleanerCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
        <CheckCircle className="w-3.5 h-3.5" />
        Marked complete
      </span>
    )
  }

  // Cleaner already submitted — show green badge, no override allowed
  if (cleanerCompleted || currentStatus === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
        <CheckCircle className="w-3.5 h-3.5" />
        Completed by cleaner
      </span>
    )
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    const result = await adminMarkJobCompleteAction(jobId, note.trim() || undefined, role)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="w-full">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f]/25 bg-white hover:bg-[#1e3a5f] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Mark as Complete
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3 w-full max-w-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Mark as Complete</p>
            <button
              onClick={() => { setExpanded(false); setError(null) }}
              className="text-gray-400 hover:text-gray-600"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Note <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`e.g. Cleaner couldn't submit — confirmed complete`}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-[#1e3a5f] text-white py-2 rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {loading ? 'Saving…' : `Confirm — mark complete`}
          </button>

          <p className="text-[10px] text-gray-400 text-center">
            This will be recorded as completed by {role}. Cleaner data will not be affected.
          </p>
        </div>
      )}
    </div>
  )
}
