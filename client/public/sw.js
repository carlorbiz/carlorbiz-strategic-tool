/**
 * Service Worker for Carlorbiz PWA.
 *
 * Strategy:
 * - Static assets (JS, CSS, images, fonts): cache-first (fast loads)
 * - HTML pages: network-first (always get latest content)
 * - API/Supabase calls: network-only (never cache)
 *
 * Update flow:
 * 1. New build deployed → sw.js changes (via CACHE_VERSION)
 * 2. Browser detects change → installs new SW in background
 * 3. New SW sends 'UPDATE_AVAILABLE' message to all clients
 * 4. App shows "Update available" toast → user clicks Refresh
 * 5. New SW activates, old caches cleared, page reloads
 */

const CACHE_VERSION = 'carlorbiz-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

// Assets to pre-cache on install (shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Patterns that should NEVER be cached
const NETWORK_ONLY_PATTERNS = [
  /supabase\.co/,
  /functions\/v1\//,
  /\/api\//,
  /kit\.com/,
  /railway\.app/,
  /gamma\.app/,
  /analytics/,
  /beacon/,
];

// Static asset extensions — cache-first
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|webm|mp4|pdf)$/i;

// ─── Install ─────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-critical — don't block install if precache fails
        console.warn('[SW] Some precache URLs failed — continuing');
      });
    })
  );
  // Don't wait for old SW to finish — activate immediately
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Clear old version caches
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that an update is available
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'UPDATE_AVAILABLE' });
        });
      });
    })
  );
});

// ─── Fetch ───────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) schemes (chrome-extension://, etc.)
  if (!request.url.startsWith('http')) return;

  // Skip cross-origin API calls — never cache
  if (NETWORK_ONLY_PATTERNS.some((p) => p.test(request.url))) return;

  // Static assets → cache-first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages → network-first with cache fallback
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline — serve cached version if available
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }
});

// ─── Message handler (for skip-waiting from app) ─────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
