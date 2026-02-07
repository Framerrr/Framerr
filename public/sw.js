/**
 * Framerr Service Worker
 * 
 * Handles Web Push notifications and app shell caching for faster loads.
 */

// VERSION - Update this to force new SW installation
const SW_VERSION = '1.2.1';

// Cache name for app shell resources
const CACHE_NAME = 'framerr-cache-v3';
// Note: We intentionally don't cache navigation URLs ('/', '/index.html')
// This ensures nginx auth_request can intercept and enforce authentication
const STATIC_ASSETS = [
    // Static assets like icons can still be cached
    // '/favicon/web-app-manifest-192x192.png'
];

console.log('[SW] Framerr Service Worker version', SW_VERSION);

// Install event - cache app shell
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('[SW] Failed to cache:', error);
            })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all clients immediately
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip API requests and external resources
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') || !url.origin.includes(self.location.origin)) {
        return;
    }

    // CRITICAL: Skip cache for navigation requests (page loads)
    // This allows nginx auth_request to intercept and redirect to Authentik login
    // Without this, cached HTML would load even when user is logged out
    if (event.request.mode === 'navigate') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request);
            })
    );
});

// Push event - matches Overseerr's working pattern
self.addEventListener('push', (event) => {
    console.log('[SW v' + SW_VERSION + '] Push received');

    const payload = event.data ? event.data.json() : {};

    const options = {
        body: payload.body || payload.message || 'New notification',
        icon: '/favicon/web-app-manifest-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            url: '/',
            notificationId: payload.id,
            type: payload.type
        }
    };

    console.log('[SW] Showing notification:', payload.title, options.body);

    event.waitUntil(
        self.registration.showNotification(payload.title || 'Framerr', options)
    );
});

// Notification click event - navigate to app and trigger toast
self.addEventListener('notificationclick', (event) => {
    console.log('[SW v' + SW_VERSION + '] Notification clicked');
    console.log('[SW] Notification data:', JSON.stringify(event.notification.data));

    event.notification.close();

    const notificationId = event.notification.data?.notificationId;
    console.log('[SW] Extracted notificationId:', notificationId);

    const baseUrl = '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                console.log('[SW] Found clients:', clientList.length);

                // Find an existing Framerr tab
                const existingClient = clientList.find(client =>
                    client.url.includes(self.location.origin)
                );

                if (existingClient) {
                    // App is already open - send message to show toast
                    console.log('[SW] Posting NOTIFICATION_CLICK message to client:', existingClient.url);
                    existingClient.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        notificationId: notificationId
                    });
                    return existingClient.focus();
                }

                // App not open - open with notification ID in URL
                if (clients.openWindow) {
                    const urlWithNotification = notificationId
                        ? `${baseUrl}#notification=${notificationId}`
                        : baseUrl;
                    console.log('[SW] Opening new window:', urlWithNotification);
                    return clients.openWindow(urlWithNotification);
                }
            })
    );
});

// Push subscription change - auto-resubscribe
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW] Push subscription changed, resubscribing...');

    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: event.oldSubscription?.options?.applicationServerKey
        }).then((newSubscription) => {
            // Inform the server about the new subscription
            // This requires the app to handle it next time it loads
            console.log('[SW] Resubscribed to push notifications');
        }).catch((error) => {
            console.error('[SW] Failed to resubscribe:', error);
        })
    );
});
