'use client'

import { useState } from 'react'
import { X, PenLine, Loader2, Check } from 'lucide-react'

// Interim: emails the agreement PDF for the client to review and sign.
// Phase 4 replaces this with DocuSign e-signature (anchored to the execution
// page's signature blocks) once DocuSign credentials are configured.
export function SendAgreementModal({ id, status, onClose }: { id: string; status: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function send() {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/documents/send', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, toEmail: email.trim(), message: message.trim() || undefined }),
      })
      const res = await r.json()
      setBusy(false)
      if (!r.ok || res.error) { setError(res.error || 'Could not send. Please try again.'); return }
      setSent(true); setTimeout(onClose, 1400)
    } catch { setBusy(false); setError('Could not send. Check your connection and try again.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl border border-gray-200 shadow-xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-gray-900">Send agreement for signature</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-emerald-600" /></div>
            <p className="text-sm font-semibold text-gray-900">Agreement sent</p>
            <p className="text-xs text-gray-400 mt-1">Marked out for signature.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 mb-4">
              <p className="text-xs text-amber-700">DocuSign e-signature is coming next. For now this emails the agreement PDF for the client to sign and return.</p>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Send to</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="client@company.com.au"
                  className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Personal note (optional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Leave blank to use the default…"
                  className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
            </div>
            {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>}
            <button onClick={send} disabled={busy || !email.trim()}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3.5 disabled:opacity-40 active:scale-[0.99] transition-all">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><PenLine className="w-4 h-4" /> Send agreement</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
