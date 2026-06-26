/* ============================================================
   SENTINEL — Service Worker
   Background heartbeat for real-time screen time tracking.
   Sends a heartbeat every 60s even when the app is minimized.
   ============================================================ */

let heartbeatTimer = null;
let authToken = null;
let isChild = false;

// Listen for messages from the main page
self.addEventListener('message', (event) => {
  const { type, token, role } = event.data || {};

  if (type === 'INIT_HEARTBEAT') {
    authToken = token;
    isChild = role === 'child';

    if (isChild && authToken) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  }

  if (type === 'STOP_HEARTBEAT') {
    stopHeartbeat();
  }
});

function startHeartbeat() {
  stopHeartbeat(); // Clear any existing

  // Send immediately
  sendHeartbeat();

  // Then every 60 seconds
  heartbeatTimer = setInterval(() => {
    sendHeartbeat();
  }, 60000);

  console.log('[SW] Heartbeat started (60s interval)');
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[SW] Heartbeat stopped');
  }
}

async function sendHeartbeat() {
  if (!authToken) return;

  try {
    const response = await fetch('/api/usage/track/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Notify all clients of the verified minutes
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'HEARTBEAT_ACK',
          verified_minutes: data.verified_minutes
        });
      });
    } else if (response.status === 401) {
      // Token expired, stop heartbeat
      stopHeartbeat();
    }
  } catch (err) {
    // Network error — silently continue, will retry next interval
    console.warn('[SW] Heartbeat failed:', err.message);
  }
}

// Service Worker lifecycle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler — pass through all requests (no caching)
self.addEventListener('fetch', (event) => {
  // Let all requests pass through normally
  return;
});
