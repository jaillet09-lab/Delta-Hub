'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startCleanForClientAction } from '@/actions/jobs'
import { Loader2, AlertCircle } from 'lucide-react'

interface Props {
  clientId: string
  address:  string | null
  suburb:   string | null
  label?:   string
  siteId?:  string | null
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocode(q: string) {
  try {
    // Abort after 6s so a slow/blocked geocoder can never hang the Start flow
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=au`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'DeltaCleaningPortal/1.0' }, signal: ctrl.signal })
    clearTimeout(t)
    const d = await r.json()
    return d?.[0] ? { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) } : null
  } catch { return null }
}

function getGPS(): Promise<GeolocationPosition> {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 })
  )
}

type Step = 'idle' | 'starting' | 'error'

export function StartCleanButton({ clientId, address, suburb, label: customLabel, siteId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [err,  setErr]  = useState<string | null>(null)

  async function runStart(location: { lat: number; lng: number; distanceM: number | null } | null) {
    try {
      const r = await startCleanForClientAction(clientId, siteId ?? null, location)
      if (r?.error) { setErr(r.error); setStep('error') } else { router.refresh() }
    } catch {
      setErr('Could not start the clean. Check your connection and try again.')
      setStep('error')
    }
  }

  // Capture where they started (best-effort) and how far from the site — this NEVER
  // blocks the start. If GPS is denied, slow, or the address can't be geocoded, we
  // simply start without it. The distance is recorded so the office can see off-site
  // starts, not to stop a cleaner getting to work.
  async function handleStart() {
    setErr(null)
    setStep('starting')

    let location: { lat: number; lng: number; distanceM: number | null } | null = null
    try {
      const [gps, coords] = await Promise.all([
        getGPS().catch(() => null),
        (address || suburb)
          ? (async () => {
              for (const q of [
                address && suburb ? `${address}, ${suburb}, Queensland, Australia` : '',
                suburb ? `${suburb}, Queensland, Australia` : '',
              ].filter(Boolean)) {
                const c = await geocode(q); if (c) return c
              }
              return null
            })()
          : Promise.resolve(null),
      ])
      if (gps) {
        const distanceM = coords
          ? Math.round(haversineKm(gps.coords.latitude, gps.coords.longitude, coords.lat, coords.lon) * 1000)
          : null
        location = { lat: gps.coords.latitude, lng: gps.coords.longitude, distanceM }
      }
    } catch { /* ignore — never block the start on a location problem */ }

    await runStart(location)
  }

  const busy = step === 'starting'
  const idleLabel = customLabel ?? 'Start Clean'
  const label = busy ? 'Starting…' : idleLabel

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
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {label}
      </button>
      {step === 'idle' && (address || suburb) && (
        <p className="text-[11px] text-center text-gray-400">Tap when you arrive — your location is noted on start</p>
      )}
    </div>
  )
}
