const CACHE_NAME = 'unlimited-attendance-v3';
const STATIC_CACHE = 'unlimited-attendance-static-v3';
const DYNAMIC_CACHE = 'unlimited-attendance-dynamic-v3';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Skip waiting for activation');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache failed during install', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // Clone the request for caching
        const requestClone = event.request.clone();
        
        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(requestClone)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseClone = response.clone();
            
            // Determine which cache to use
            const cacheToUse = urlsToCache.includes(event.request.url) ? STATIC_CACHE : DYNAMIC_CACHE;
            
            // Add to appropriate cache
            caches.open(cacheToUse)
              .then((cache) => {
                // Only cache GET requests
                if (event.request.method === 'GET') {
                  cache.put(event.request, responseClone);
                }
              })
              .catch((error) => {
                console.error('[SW] Error caching response:', error);
              });

            return response;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            
            // Return offline fallback for HTML requests
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // For other requests, return a generic offline response
            if (event.request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#999">📱 Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            return new Response(
              JSON.stringify({ error: 'Network unavailable', offline: true }),
              { 
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
      })
  );
});

// Background sync for data backup
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  return new Promise((resolve) => {
    // Here you could implement data synchronization logic
    // For example, sync attendance data to a remote server when online
    console.log('[SW] Performing background sync...');
    
    // Check if IndexedDB has data to sync
    const request = indexedDB.open('UnlimitedAttendanceDB', 1);
    request.onsuccess = function(event) {
      const db = event.target.result;
      if (db.objectStoreNames.contains('attendance')) {
        const transaction = db.transaction(['attendance'], 'readonly');
        const store = transaction.objectStore('attendance');
        const getRequest = store.get('unlimitedData');
        
        getRequest.onsuccess = function() {
          if (getRequest.result) {
            console.log('[SW] Found data to potentially sync:', getRequest.result.attendanceData.length, 'records');
            // Here you would send data to your server
          }
          resolve();
        };
      } else {
        resolve();
      }
    };
    
    request.onerror = function() {
      console.error('[SW] Error accessing IndexedDB during sync');
      resolve();
    };
  });
}

// Push notifications support
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Attendance reminder - Don\'t forget to check in/out!',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" fill="%23667eea"%3E%3Crect width="192" height="192" fill="%23667eea" rx="20"/%3E%3Cpath fill="white" d="M48 64h96v8H48zm0 16h96v8H48zm0 16h96v8H48zm0 16h64v8H48z"/%3E%3Ccircle fill="white" cx="128" cy="112" r="12"/%3E%3Cpath fill="white" d="M122 106l4 4 8-8v16l-8-8-4 4z"/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"%3E%3Crect width="72" height="72" fill="%23667eea" rx="8"/%3E%3Cpath fill="white" d="M20 24h32v4H20zm0 8h32v4H20zm0 16h20v4H20z"/%3E%3C/svg%3E',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'attendance-notification'
    },
    actions: [
      {
        action: 'checkin',
        title: 'Quick Check-in',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234CAF50"%3E%3Cpath d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/%3E%3C/svg%3E'
      },
      {
        action: 'view',
        title: 'Open App',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"%3E%3Cpath d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/%3E%3C/svg%3E'
      }
    ],
    tag: 'attendance-reminder',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification('Attendance System', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'checkin') {
    // Open app and trigger check-in
    event.waitUntil(
      clients.openWindow('/?action=checkin')
    );
  } else if (event.action === 'view') {
    // Just open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    // Default action - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  // Optional: track notification close events
});

// Cache size management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('unlimited-attendance-')) {
              console.log('[SW] Clearing cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'attendance-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Update check
self.addEventListener('updatefound', () => {
  console.log('[SW] Update found');
});

console.log('[SW] Service Worker script loaded successfully');