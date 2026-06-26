/* ============================================================
   SENTINEL — Application Entry Point
   Routing, auth guards, and app initialization.
   ============================================================ */

import router from './utils/router.js';
import { isAuthenticated, getUser } from './services/auth.js';
import { startHeartbeatService, stopHeartbeatService } from './services/heartbeat.js';
import { renderLoginPage } from './pages/login.js';
import { renderRegisterPage } from './pages/register.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderChildProfilePage } from './pages/childProfile.js';
import { renderAnalyticsPage } from './pages/analytics.js';
import { renderSettingsPage } from './pages/settings.js';
import { renderDbViewerPage } from './pages/dbViewer.js';
import { renderActivityTracker } from './pages/activityTracker.js';
import { initAlertListener } from './components/alertBanner.js';

// ── Public routes (no auth needed) ───────────────────────────
const PUBLIC_PATHS = ['/login', '/register', '/database'];

// ── Register routes ──────────────────────────────────────────

router.addRoute('/login', (container) => {
  stopHeartbeatService(); // Stop tracking on logout
  renderLoginPage(container);
  _postRender();
});

router.addRoute('/register', (container) => {
  renderRegisterPage(container);
  _postRender();
});

router.addRoute('/dashboard', async (container) => {
  const user = await _ensureUser();
  _autoStartHeartbeat(user);
  await renderDashboardPage(container);
  _postRender();
});

router.addRoute('/child/:id', async (container, params) => {
  const user = await _ensureUser();
  _autoStartHeartbeat(user);
  await renderChildProfilePage(container, params);
  _postRender();
});

router.addRoute('/analytics', async (container) => {
  const user = await _ensureUser();
  _autoStartHeartbeat(user);
  await renderAnalyticsPage(container);
  _postRender();
});

router.addRoute('/settings', async (container) => {
  const user = await _ensureUser();
  _autoStartHeartbeat(user);
  await renderSettingsPage(container);
  _postRender();
});

router.addRoute('/database', async (container) => {
  await renderDbViewerPage(container);
  _postRender();
});

router.addRoute('/tracker', async (container) => {
  const user = await _ensureUser();
  _autoStartHeartbeat(user);
  await renderActivityTracker(container);
  _postRender();
});

// ── Auth guard ───────────────────────────────────────────────
router.setBeforeEach((path) => {
  const authed = isAuthenticated();

  // Root redirect
  if (path === '/' || path === '') {
    return authed ? '/dashboard' : '/login';
  }

  // Not authenticated → send to login (unless already on public route)
  if (!authed && !PUBLIC_PATHS.includes(path)) {
    return '/login';
  }

  // Authenticated but on login/register → redirect to dashboard
  if (authed && PUBLIC_PATHS.includes(path)) {
    return '/dashboard';
  }

  // Allow navigation
  return path;
});

// ── Initialize ───────────────────────────────────────────────

// Register Service Worker for PWA + background heartbeat
_registerServiceWorker();

// Alert listener for SSE push notifications
initAlertListener();

// Start the router
router.start();

// ── Helpers ──────────────────────────────────────────────────

let heartbeatStarted = false;

/**
 * Auto-start heartbeat for child users on any page navigation.
 * Only starts once per session to avoid duplicate timers.
 */
function _autoStartHeartbeat(user) {
  if (!user || heartbeatStarted) return;
  if (user.role === 'child') {
    startHeartbeatService('child');
    heartbeatStarted = true;
    console.log('[Main] Auto-heartbeat started for child user');
  }
}

/**
 * Ensure user data is fetched before rendering protected pages.
 */
async function _ensureUser() {
  try {
    return await getUser();
  } catch (err) {
    console.warn('Failed to fetch user:', err);
    return null;
  }
}

/**
 * Run post-render tasks: re-initialize Lucide icons globally.
 */
function _postRender() {
  requestAnimationFrame(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });
}

/**
 * Register the Service Worker for PWA support and background heartbeat.
 */
async function _registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[SW] Service Worker registered:', registration.scope);
  } catch (err) {
    console.warn('[SW] Service Worker registration failed:', err);
  }
}
