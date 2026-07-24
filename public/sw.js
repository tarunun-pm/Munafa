/**
 * Munafa Service Worker
 * Strategy:
 *  - App shell (fonts, static assets) → Cache First
 *  - API routes → Network First (never cache)
 *  - Navigation requests → Network First with offline fallback
 */

const CACHE_NAME = 'munafa-v1'

const STATIC_ASSETS = [
  '/',
  '/onboarding',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

/* ────────────────────────────────────────────────
   INSTALL — pre-cache shell assets
──────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS.filter(u => !u.startsWith('/icons'))))
      .then(() => self.skipWaiting())
  )
})

/* ────────────────────────────────────────────────
   ACTIVATE — delete old caches
──────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

/* ────────────────────────────────────────────────
   FETCH — routing strategy
──────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Chrome extension or non-http requests — ignore
  if (!url.protocol.startsWith('http')) {
    return
  }

  // Next.js HMR / webpack requests — ignore in dev
  if (url.pathname.startsWith('/_next/webpack-hmr')) {
    return
  }

  // Static Next.js assets (_next/static) — Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  // Navigation (HTML pages) — Network First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/onboarding').then((r) => r ?? new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html' },
        }))
      )
    )
    return
  }

  // Everything else — Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request))
  )
})

/* ────────────────────────────────────────────────
   OFFLINE FALLBACK HTML
──────────────────────────────────────────────── */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Munafa — Offline</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0F3D2E;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: white;
      text-align: center;
    }
    .logo {
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #F2A93B, #DB8F1F);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; color: #0F3D2E;
      margin-bottom: 20px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: rgba(255,255,255,0.55); line-height: 1.6; max-width: 260px; }
    .pill {
      margin-top: 28px;
      padding: 12px 24px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      font-size: 14px;
      color: rgba(255,255,255,0.7);
    }
  </style>
</head>
<body>
  <div class="logo">₹</div>
  <h1>You're offline</h1>
  <p>Connect to the internet to access Munafa and log your daily transactions.</p>
  <div class="pill">📡 Waiting for connection…</div>
</body>
</html>`
