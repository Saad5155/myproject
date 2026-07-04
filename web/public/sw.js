// Minimal PWA service worker.
// - Never caches /api/* (always live).
// - Network-first for navigations (fresh app shell), falling back to cache offline.
// - Cache-first for static assets.
const CACHE = 'terminal-x-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // always network for API

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((ch) => ch.put(request, c)); return res })
        .catch(() => caches.match(request).then((m) => m || caches.match('/')))
    )
    return
  }

  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then((ch) => ch.put(request, c)) }
        return res
      }).catch(() => cached)
    )
  )
})
