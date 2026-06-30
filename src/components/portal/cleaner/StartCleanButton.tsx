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
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  )
}

type Step = 'idle' | 'locating' | 'geocoding' | 'starting' | 'error'

export function StartCleanButton({ clientId, address, suburb, label: customLabel, siteId }: Props) {
  const router = useRouter()
  const [step, setStep]   = useState<Step>('idle')
  const [err,  setErr]    = useState<string | null>(null)

  // Calls the server action with a hard guard so the button can never hang on
  // "Starting…": any thrown/timed-out error surfaces and resets the button.
  async function runStart() {
    setStep('starting')
    try {
      const r = await startCleanForClientAction(clientId, siteId ?? null)
      if (r?.error) { setErr(r.error); setStep('error') } else { router.refresh() }
    } catch {
      setErr('Could not start the clean. Check your connection and try again.')
      setStep('error')
    }
  }

  async function handleStart() {
    setErr(null)

    // No address stored — skip location check
    if (!address && !suburb) { await runStart(); return }

    // 1. GPS
    setStep('locating')
    let pos: GeolocationPosition
    try { pos = await getGPS() } catch (e: any) {
      setErr(e?.code === 1
        ? 'Location access denied. Allow location in your browser settings.'
        : 'Could not get your location. Check GPS and try again.')
      setStep('error'); return
    }

    // 2. Geocode
    setStep('geocoding')
    let coords: { lat: number; lon: number } | null = null
    for (const q of [
      address && suburb ? `${address}, ${suburb}, Queensland, Australia` : '',
      suburb ? `${suburb}, Queensland, Australia` : '',
    ].filter(Boolean)) {
      coords = await geocode(q); if (coords) break
    }

    // Can't geocode — let them through
    if (!coords) { await runStart(); return }

    // 3. Distance check — 1 km with address, 3 km suburb only
    const dist   = haversineKm(pos.coords.latitude, pos.coords.longitude, coords.lat, coords.lon)
    const radius = address ? 1 : 3

    if (dist > radius) {
      const distStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`
      setErr(`You must be within ${radius} km of the client to start. You are ${distStr} away.`)
      setStep('error'); return
    }

    // 4. Start
    await runStart()
  }

  const busy = step === 'locating' || step === 'geocoding' || step === 'starting'
  const idleLabel = customLabel ?? 'Start Clean'
  const label = { idle: idleLabel, locating: 'Getting location…', geocoding: 'Checking address…', starting: 'Starting…', error: idleLabel }[step]

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
        <p className="text-[11px] text-center text-gray-400">Must be on-site to start</p>
      )}
    </div>
  )
}
