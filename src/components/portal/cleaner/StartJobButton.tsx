'use client'

import { useState } from 'react'
import { startJobAction } from '@/actions/jobs'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export function StartJobButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function handleStart() {
    setLoading(true)
    setErr(null)
    try {
      const result = await startJobAction(jobId)
      if (result?.error) {
        setErr(result.error)
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      // Never leave the button spinning forever — surface a retryable error
      setErr('Could not start the job. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {err && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 leading-relaxed">{err}</p>
        </div>
      )}
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full bg-white border-2 border-black text-black font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Starting…' : 'Start Job'}
      </button>
    </div>
  )
}
