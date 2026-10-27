// Gurukul Sports Academy - PWA Service Worker
const CACHE_NAME = 'gurukul-sports-v8';
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

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gurukul Sports Academy — Offline</title>
  <style>
    body { margin: 0; background-color: #020617; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 20px; box-sizing: border-box; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 24px; padding: 32px 24px; max-width: 380px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
    h1 { font-size: 18px; font-weight: 800; margin: 0 0 8px; color: #fff; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0 0 24px; }
    .btn { background: #2563eb; color: #fff; border: none; padding: 12px 24px; border-radius: 14px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; width: 100%; }
    .btn:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🥋</div>
    <h1>You are Offline</h1>
    <p>Gurukul Sports Academy cannot reach the server right now. Check your internet connection and try again.</p>
    <button class="btn" onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
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
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const shell = (await caches.match('/login')) || (await caches.match('/'));
          if (shell) return shell;
          return new Response(OFFLINE_FALLBACK_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
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

// Native Device Message & Push Notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'Gurukul Sports Academy 🥋';
    const options = {
      body: event.data.body || 'You have a new update from Gurukul Sports Academy.',
      icon: event.data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: {
        url: event.data.url || '/student/dashboard',
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
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
