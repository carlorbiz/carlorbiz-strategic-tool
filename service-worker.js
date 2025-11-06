/**
 * RWAV Strategic Workshop PWA - Service Worker
 * Provides offline capability and caching strategy
 */

const CACHE_NAME = 'rwav-strategic-pwa-v1.0';
const RUNTIME_CACHE = 'rwav-runtime-v1.0';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/data.js',
  '/manifest.json',
  // External CDN resources will be cached on first use
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('cdnjs.cloudflare.com') &&
      !event.request.url.includes('cdn.jsdelivr.net') &&
      !event.request.url.includes('unpkg.com') &&
      !event.request.url.includes('openstreetmap.org')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache if not a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Cache the fetched response for future use
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                console.log('Service Worker: Caching new resource', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            
            // Return offline page or fallback response
            return caches.match('/index.html');
          });
      })
  );
});

// Background sync for future VERSION 2 workshop data
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sync-workshop-data') {
    event.waitUntil(syncWorkshopData());
  }
});

async function syncWorkshopData() {
  // Placeholder for VERSION 2 - sync workshop decisions and photo uploads
  console.log('Service Worker: Syncing workshop data...');
  return Promise.resolve();
}

// Push notifications for future VERSION 2 features
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('RWAV Strategic Plan', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
});

console.log('Service Worker: Script loaded');
