// Gurukul Sports Academy - PWA Service Worker
const CACHE_NAME = 'gurukul-sports-v2';
const CORE_ASSETS = [
  '/',
  '/login',
  '/manifest.webmanifest',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/favicon.svg',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use Promise.allSettled so any non-critical cache fetch failure doesn't abort SW installation
      await Promise.allSettled(
        CORE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[SW] Non-critical cache add failed for:', asset, err?.message);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API calls, websockets, external requests, non-GET
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    return;
  }

  // Network first, fallback to cache for offline support
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/login') || caches.match('/');
          }
        });
      })
  );
});

// Web Push Notification Listener
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Gurukul Sports Academy';
      const options = {
        body: data.body || 'You have a new update from Gurukul Sports Academy.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: {
          url: data.url || '/student/attendance',
        },
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.warn('[SW] Push notification parse error:', e);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
