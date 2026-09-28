'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { setClientActiveAction } from '@/actions/clients'
import { Loader2, X } from 'lucide-react'

export function OffboardClientButton({ clientId, active, hasEmail }: { clientId: string; active: boolean; hasEmail: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState(hasEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reactivating is a one-tap action — no confirmation needed.
  async function reactivate() {
    setBusy(true); setError(null)
    const res = await setClientActiveAction(clientId, true)
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    router.refresh()
  }

  async function offboard() {
    setBusy(true); setError(null)
    const res = await setClientActiveAction(clientId, false, { sendEmail })
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setOpen(false)
    router.refresh()
  }

  if (!active) {
    return (
      <Button onClick={reactivate} disabled={busy} variant="primary" size="sm">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Reactivate
      </Button>
    )
  }

  return (
    <>
      <Button onClick={() => { setError(null); setOpen(true) }} variant="secondary" size="sm">Mark Inactive</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl border border-gray-200 shadow-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-display text-lg font-bold text-gray-900">Off-board this client</h3>
              <button onClick={() => !busy && setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              This marks the client inactive (hidden from your active lists and schedules) and disables their portal login. You can reactivate any time.
            </p>

            <label className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 select-none ${hasEmail ? 'cursor-pointer border-gray-200' : 'border-gray-100 opacity-50'}`}>
              <input type="checkbox" checked={sendEmail && hasEmail} disabled={!hasEmail} onChange={e => setSendEmail(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1e3a5f] flex-shrink-0" />
              <span className="text-sm text-gray-700">
                Send a thank-you &amp; feedback email
                <span className="block text-xs text-gray-400 mt-0.5">{hasEmail ? 'A warm sign-off with a short feedback link.' : 'No email on file for this client.'}</span>
              </span>
            </label>

            {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>}

            <div className="flex gap-2 mt-5">
              <Button onClick={() => setOpen(false)} disabled={busy} variant="secondary" size="sm" className="flex-1">Cancel</Button>
              <button onClick={offboard} disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50 transition-colors">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</> : 'Mark inactive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
