'use client'

import { useState } from 'react'
import { createPortalUserAction } from '@/actions/team'
import { Globe, X } from 'lucide-react'

interface Props {
  clientId: string
  clientName: string
  contactEmail?: string | null
}

export function ImportToPortalButton({ clientId, clientName, contactEmail }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(contactEmail ?? '')
  const [contactName, setContactName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500'
  const lbl = 'block text-xs font-medium text-gray-500 mb-1.5'

  async function handleCreate() {
    if (!email || !contactName || !password) return setError('All fields required')
    setSubmitting(true)
    const result = await createPortalUserAction({
      email,
      password,
      fullName: contactName,
      role: 'client',
      linkedClientId: clientId,
    })
    setSubmitting(false)
    if (result.error) return setError(result.error)
    setSuccess(true)
    setTimeout(() => { setSuccess(false); setOpen(false) }, 2500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        Import to Portal
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-900">Create Client Portal</h3>
                <p className="text-xs text-gray-400 mt-0.5">{clientName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="text-center py-6">
                <p className="text-emerald-600 font-semibold">✓ Portal access created</p>
                <p className="text-xs text-gray-400 mt-1">Share the login credentials with the client.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {error && <p className="text-xs text-red-600 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
                <div>
                  <label className={lbl}>Contact Name</label>
                  <input className={inp} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className={lbl}>Login Email</label>
                  <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@business.com" />
                </div>
                <div>
                  <label className={lbl}>Temporary Password</label>
                  <input className={inp} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 5 characters" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setOpen(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg py-2.5 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={submitting} className="flex-1 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg py-2.5 hover:bg-[#162d4a] disabled:opacity-50 transition-colors">
                    {submitting ? 'Creating…' : 'Create Access'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
