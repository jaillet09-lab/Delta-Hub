'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send, Loader2, Check } from 'lucide-react'
import { buildProposalEmailBody, firstNameFromAttention } from '@/lib/emails/proposal-email-body'

export function SendProposalModal({
  id, defaultEmail, clientName = '', attention = '', isAgreement = false, onClose,
}: {
  id: string
  defaultEmail?: string
  clientName?: string
  attention?: string
  isAgreement?: boolean
  onClose: () => void
}) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [attachCapability, setAttachCapability] = useState(!isAgreement)
  const build = (attach: boolean) => buildProposalEmailBody({
    firstName: firstNameFromAttention(attention), clientName, isAgreement, attachCapability: !isAgreement && attach,
  })
  const [body, setBody] = useState(() => build(!isAgreement))
  const edited = useRef(false)          // once the owner types, stop auto-regenerating
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Keep the capability line in sync with the checkbox until the owner edits by hand.
  useEffect(() => {
    if (!edited.current) setBody(build(attachCapability))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachCapability])

  async function send() {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/documents/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, toEmail: email.trim(), attachCapability, message: body.trim() || undefined }),
      })
      const res = await r.json()
      setBusy(false)
      if (!r.ok || res.error) { setError(res.error || 'Could not send. Please try again.'); return }
      setSent(true)
      setTimeout(onClose, 1400)
    } catch {
      setBusy(false)
      setError('Could not send. Check your connection and try again.')
    }
  }

  const label = isAgreement ? 'Send agreement' : 'Send proposal'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl border border-gray-200 shadow-xl p-6 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-gray-900">{label}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-emerald-600" /></div>
            <p className="text-sm font-semibold text-gray-900">{isAgreement ? 'Agreement sent' : 'Proposal sent'}</p>
            <p className="text-xs text-gray-400 mt-1">Marked as sent and logged in history.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Send to</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="client@company.com.au"
                  className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Email message</label>
                  <span className="text-[11px] text-gray-400">Edit anything before it sends</span>
                </div>
                <textarea value={body} onChange={e => { edited.current = true; setBody(e.target.value) }} rows={12}
                  className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2.5 text-[13.5px] leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y" />
              </div>
              {!isAgreement && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={attachCapability} onChange={e => setAttachCapability(e.target.checked)} className="w-4 h-4 accent-[#1e3a5f]" />
                  <span className="text-sm text-gray-700">Attach capability statement</span>
                </label>
              )}
              <p className="text-[11px] text-gray-400">The {isAgreement ? 'agreement' : 'proposal'} PDF is attached automatically. Generating PDFs can take a few seconds.</p>
            </div>

            {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>}

            <button onClick={send} disabled={busy || !email.trim()}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3.5 disabled:opacity-40 active:scale-[0.99] transition-all">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> {label}</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
