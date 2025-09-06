const CACHE_NAME = 'attendance-system-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/?utm_source=pwa',
  '/?action=checkin',
  '/?action=checkout'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error('Service Worker: Cache failed', error);
      })
  );
  // Force the waiting service worker to become active immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        // Clone the request for network fetch
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          function(response) {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response for caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Cache the new response
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(function(error) {
          console.log('Service Worker: Network failed, serving offline fallback');
          
          // Return offline fallback for HTML requests
          if (event.request.headers.get('accept') && 
              event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/') || createOfflineResponse();
          }
          
          // For other requests, return generic offline response
          return new Response('Offline', { 
            status: 503, 
            statusText: 'Service Unavailable' 
          });
        });
      }
    )
  );
});

// Create offline response
function createOfflineResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Attendance System</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .container {
          background: rgba(255,255,255,0.1);
          padding: 3rem 2rem;
          border-radius: 20px;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.2);
          max-width: 500px;
          margin: 1rem;
        }
        h1 { 
          font-size: 2.5rem; 
          margin: 0 0 1rem 0;
          font-weight: 700;
        }
        p { 
          font-size: 1.2rem; 
          margin: 0 0 2rem 0;
          opacity: 0.9;
          line-height: 1.5;
        }
        .retry-btn {
          background: #4CAF50;
          color: white;
          padding: 1rem 2rem;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
        }
        .retry-btn:hover { 
          background: #45a049; 
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        }
        .status {
          background: rgba(255,152,0,0.2);
          border: 1px solid rgba(255,152,0,0.3);
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
          font-size: 0.9rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📱 You're Offline</h1>
        <div class="status">
          ⚡ Running in offline mode
        </div>
        <p>The Attendance System works offline! Your data is saved locally and will sync when you're back online.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          🔄 Try Again
        </button>
      </div>
      <script>
        // Auto-reload when back online
        window.addEventListener('online', function() {
          setTimeout(() => window.location.reload(), 1000);
        });
      </script>
    </body>
    </html>
  `, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

// Background sync for future data synchronization
self.addEventListener('sync', function(event) {
  if (event.tag === 'attendance-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(syncAttendanceData());
  }
});

// Sync attendance data (placeholder for server sync)
function syncAttendanceData() {
  return new Promise((resolve, reject) => {
    // Future implementation: sync with server
    console.log('Service Worker: Syncing attendance data...');
    setTimeout(resolve, 1000);
  });
}

// Push notification support
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'New attendance notification',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: data.primaryKey || Date.now()
        },
        actions: [
          {
            action: 'view',
            title: 'View App',
            icon: '/icon-96.png'
          },
          {
            action: 'close',
            title: 'Close',
            icon: '/icon-96.png'
          }
        ],
        requireInteraction: true
      };

      event.waitUntil(
        self.registration.showNotification(
          data.title || 'Attendance System', 
          options
        )
      );
    } catch (error) {
      console.error('Push notification error:', error);
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function(clientList) {
        // If app is already open, focus it
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    console.log('Service Worker: Manual cache update requested');
    event.waitUntil(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.addAll(urlsToCache);
      })
    );
  }
});

// Handle client communication
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      cached: urlsToCache
    });
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'attendance-background-sync') {
    event.waitUntil(syncAttendanceData());
  }
});

// Handle app shortcuts
self.addEventListener('notificationclick', function(event) {
  const action = event.action;
  
  if (action === 'checkin') {
    event.waitUntil(
      clients.openWindow('/?action=checkin')
    );
  } else if (action === 'checkout') {
    event.waitUntil(
      clients.openWindow('/?action=checkout')
    );
  }
  
  event.notification.close();
});