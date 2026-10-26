// Redstep service worker (generated into dist/sw.js at build time by vite.config.js).
// - On install it saves the app shell and the Jezero data, so the planner works offline after
//   the first visit.
// - Everything else from this site (world-map tiles, other sites) is saved the first time it is
//   viewed and served from the cache afterwards.
// - Page loads try the network first and fall back to the saved app when offline.
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const SHELL = `shell-${VERSION}`
const RUNTIME = `runtime-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html', { ignoreSearch: true, ignoreVary: true })),
    )
    return
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        // only keep real files, never the HTML fallback served for unknown paths
        const type = res.headers.get('content-type') || ''
        if (res.ok && !type.includes('text/html')) {
          const copy = res.clone()
          caches.open(RUNTIME).then((c) => c.put(req, copy))
        }
        return res
      })
    }),
  )
})
