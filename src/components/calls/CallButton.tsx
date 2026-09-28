'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, PhoneOff, Loader2 } from 'lucide-react'

type State = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'error'

// In-browser click-to-call via the Twilio Voice SDK. The SDK is loaded lazily so
// it's out of the main bundle and only pulled when the owner actually calls.
export function CallButton({ phone, leadId, coldLeadId, label = 'Call' }: {
  phone: string | null | undefined
  leadId?: string
  coldLeadId?: string
  label?: string
}) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const deviceRef = useRef<any>(null)
  const callRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function cleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    try { callRef.current?.disconnect() } catch {}
    try { deviceRef.current?.destroy() } catch {}
    callRef.current = null
    deviceRef.current = null
  }
  useEffect(() => () => cleanup(), [])

  async function startCall() {
    if (!phone) return
    setError(null); setState('connecting')
    try {
      const res = await fetch('/api/twilio/token')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Calling is not set up yet.')
      }
      const { token } = await res.json()
      const { Device } = await import('@twilio/voice-sdk')
      const device = new (Device as any)(token, { codecPreferences: ['opus', 'pcmu'] })
      deviceRef.current = device
      const call = await device.connect({ params: { To: phone, leadId: leadId ?? '', coldLeadId: coldLeadId ?? '' } })
      callRef.current = call
      setState('ringing')
      call.on('accept', () => {
        setState('in-call'); setSeconds(0)
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      })
      call.on('disconnect', () => { cleanup(); setState('idle'); router.refresh() })
      call.on('cancel', () => { cleanup(); setState('idle') })
      call.on('error', (err: any) => { setError(err?.message || 'Call error'); cleanup(); setState('error') })
    } catch (e: any) {
      setError(e?.message || 'Could not start the call.'); cleanup(); setState('error')
    }
  }

  function hangup() { cleanup(); setState('idle'); router.refresh() }

  if (!phone) return null

  if (state === 'idle' || state === 'error') {
    return (
      <div>
        <button onClick={startCall}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 transition-colors">
          <Phone className="w-3.5 h-3.5" /> {label}
        </button>
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-3 py-1.5">
      <span className="text-xs font-medium inline-flex items-center gap-1.5">
        {state === 'connecting' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting…</>}
        {state === 'ringing' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Ringing…</>}
        {state === 'in-call' && <>On call · {mm}:{ss}</>}
      </span>
      <button onClick={hangup} className="inline-flex items-center gap-1 text-xs font-semibold bg-red-500 hover:bg-red-600 rounded-md px-2 py-1 transition-colors">
        <PhoneOff className="w-3.5 h-3.5" /> End
      </button>
    </div>
  )
}
