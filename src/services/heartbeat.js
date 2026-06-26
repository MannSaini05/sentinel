/* ============================================================
   SENTINEL — Heartbeat Service
   Auto-tracking heartbeat that runs on EVERY page for child users.
   Works with the Service Worker for background tracking.
   ============================================================ */

import { getToken } from './auth.js';

let pageHeartbeatTimer = null;
let isPageVisible = true;
let verifiedMinutes = 0;

/**
 * Start the heartbeat service for a child user.
 * This runs on every page — dashboard, settings, tracker, etc.
 * Also initializes the Service Worker heartbeat for background tracking.
 */
export function startHeartbeatService(userRole) {
  if (userRole !== 'child') return;

  // Clear any existing timers
  stopHeartbeatService();

  isPageVisible = true;

  // Send heartbeat immediately
  _sendHeartbeat();

  // Page-level heartbeat every 60 seconds (backup to SW)
  pageHeartbeatTimer = setInterval(() => {
    if (isPageVisible) {
      _sendHeartbeat();
    }
  }, 60000);

  // Pause when page is hidden, resume when visible
  document.addEventListener('visibilitychange', _handleVisibility);

  // Initialize Service Worker heartbeat
  _initServiceWorkerHeartbeat();

  console.log('[Heartbeat] Service started for child user');
}

/**
 * Stop the heartbeat service (e.g., on logout).
 */
export function stopHeartbeatService() {
  if (pageHeartbeatTimer) {
    clearInterval(pageHeartbeatTimer);
    pageHeartbeatTimer = null;
  }
  document.removeEventListener('visibilitychange', _handleVisibility);

  // Tell Service Worker to stop
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'STOP_HEARTBEAT' });
  }
}

/**
 * Get the current verified minutes count.
 */
export function getVerifiedMinutes() {
  return verifiedMinutes;
}

// ── Private helpers ─────────────────────────────────────────

function _handleVisibility() {
  isPageVisible = !document.hidden;
  if (isPageVisible) {
    // Resumed — send immediate heartbeat
    _sendHeartbeat();
  }
}

async function _sendHeartbeat() {
  const token = getToken();
  if (!token) return;

  try {
    const response = await fetch('/api/usage/track/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      verifiedMinutes = data.verified_minutes || 0;

      // Dispatch a custom event so any page can listen for updates
      window.dispatchEvent(new CustomEvent('sentinel:heartbeat', {
        detail: { verified_minutes: verifiedMinutes }
      }));
    }
  } catch {
    // Silent fail — best effort
  }
}

/**
 * Initialize the Service Worker and tell it to start heartbeats.
 * The SW can send heartbeats even when the browser tab is minimized.
 */
async function _initServiceWorkerHeartbeat() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const token = getToken();

    if (registration.active && token) {
      registration.active.postMessage({
        type: 'INIT_HEARTBEAT',
        token: token,
        role: 'child'
      });
    }

    // Listen for heartbeat acknowledgments from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'HEARTBEAT_ACK') {
        verifiedMinutes = event.data.verified_minutes || 0;
        window.dispatchEvent(new CustomEvent('sentinel:heartbeat', {
          detail: { verified_minutes: verifiedMinutes }
        }));
      }
    });
  } catch (err) {
    console.warn('[Heartbeat] Service Worker init failed:', err);
  }
}
