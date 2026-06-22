const CACHE = 'delta-v5'

// ── Install: skip waiting immediately ────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting())
})

// ── Activate: delete ALL old caches, claim clients ───────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: only cache static assets, never HTML ──────────────────────────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Never intercept external requests or API routes
  if (url.hostname !== self.location.hostname || url.pathname.startsWith('/api/')) return

  // Only cache fonts and images — never JS/CSS/HTML, so app code and server
  // actions are always fresh from the network after a deploy.
  if (!url.pathname.match(/\.(woff2?|png|jpg|jpeg|svg|webp|ico)(\?.*)?$/)) return

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
        }
        return res
      })
    })
  )
})

// ── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Delta Cleaning', {
      body: data.body ?? '',
      icon: '/logo-icon-black.png',
      badge: '/logo-icon-black.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const target = e.notification.data?.url ?? '/'
      const existing = wins.find((w) => w.url.includes(target))
      if (existing) return existing.focus()
      return clients.openWindow(target)
    })
  )
})
