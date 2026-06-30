'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output  = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output.buffer
}

async function subscribeAndSave(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return

  // Reuse existing subscription if valid, otherwise create a new one.
  // Avoid always unsubscribing — that invalidates the endpoint before the
  // new one is saved, creating a window where push delivery silently fails.
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  // Always save/upsert so the DB always has the current endpoint.
  await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(sub.toJSON()),
  })
}

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function NotificationGate({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    // If push isn't supported at all (e.g. iOS Safari browser, not PWA), let them through
    if (!isPushSupported()) {
      setPermission('unsupported')
      return
    }

    const perm = Notification.permission
    setPermission(perm)

    // If already granted, silently re-register the subscription in the background.
    // This ensures the DB always has a fresh endpoint even after the cleaner
    // clears browser data, switches devices, or the subscription expires.
    if (perm === 'granted') {
      subscribeAndSave().catch(() => {})
    }

    // Watch for permission changes
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          status.addEventListener('change', () => setPermission(Notification.permission))
        })
        .catch(() => {})
    }
  }, [])

  // Still detecting
  if (permission === null) return null

  // Unsupported or already granted — show the app
  if (permission === 'unsupported' || permission === 'granted') return <>{children}</>

  async function handleEnable() {
    setError(null)
    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        setError(
          result === 'denied'
            ? 'Notifications are blocked. Open your phone Settings, find Delta, and turn notifications on. Then tap "I\'ve turned them on" below.'
            : 'You need to allow notifications to continue.'
        )
        setPermission(result)
        setLoading(false)
        return
      }
      // Try to subscribe — failure here doesn't block the user
      try { await subscribeAndSave() } catch { /* non-fatal */ }
      setPermission('granted')
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-6">
        {permission === 'denied'
          ? <BellOff className="w-7 h-7 text-white" />
          : <Bell    className="w-7 h-7 text-white" />
        }
      </div>

      <h1 className="text-xl font-bold text-black mb-2">
        {permission === 'denied' ? 'Notifications are off' : 'Enable Notifications'}
      </h1>

      <p className="text-sm text-gray-500 leading-relaxed mb-8 max-w-xs">
        {permission === 'denied'
          ? 'Notifications are blocked on this device. Go to Settings and enable them for Delta, then tap the button below.'
          : 'Delta needs to send you notifications — new job assignments, reminders to start and finish your cleans, and updates from your manager.'
        }
      </p>

      {error && (
        <p className="text-xs text-red-500 mb-5 max-w-xs leading-relaxed">{error}</p>
      )}

      {permission !== 'denied' ? (
        <button
          onClick={handleEnable}
          disabled={loading}
          className="w-full max-w-xs bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? 'Enabling…' : 'Allow Notifications'}
        </button>
      ) : (
        <button
          onClick={() => setPermission(Notification.permission)}
          className="w-full max-w-xs bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
        >
          I've turned them on
        </button>
      )}
    </div>
  )
}
