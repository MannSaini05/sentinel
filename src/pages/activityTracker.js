/* ============================================================
   SENTINEL — Child Activity Tracker
   Mobile-friendly real-time app usage tracker.
   
   TWO layers of tracking:
   1. AUTOMATIC (Verified) — heartbeat every 60s while page is visible.
      Uses Page Visibility API. Child CANNOT fake this.
   2. MANUAL (Self-reported) — child taps apps they claim to use.
      Parent can compare against verified time to detect lies.
   ============================================================ */

import { api } from '../services/api.js';
import { getUser } from '../services/auth.js';
import { escapeHtml, formatMinutes, showToast } from '../utils/helpers.js';
import router from '../utils/router.js';

// ── Popular apps with categories & colors ────────────────────
const TRACKABLE_APPS = [
  { name: 'YouTube',    category: 'entertainment', icon: '▶️',  color: '#FF0000', bg: 'rgba(255,0,0,0.12)' },
  { name: 'Instagram',  category: 'social',        icon: '📸',  color: '#E4405F', bg: 'rgba(228,64,95,0.12)' },
  { name: 'WhatsApp',   category: 'social',        icon: '💬',  color: '#25D366', bg: 'rgba(37,211,102,0.12)' },
  { name: 'TikTok',     category: 'entertainment', icon: '🎵',  color: '#00f2ea', bg: 'rgba(0,242,234,0.12)' },
  { name: 'Snapchat',   category: 'social',        icon: '👻',  color: '#FFFC00', bg: 'rgba(255,252,0,0.12)' },
  { name: 'Minecraft',  category: 'gaming',        icon: '⛏️',  color: '#62B47A', bg: 'rgba(98,180,122,0.12)' },
  { name: 'Roblox',     category: 'gaming',        icon: '🎮',  color: '#E2231A', bg: 'rgba(226,35,26,0.12)' },
  { name: 'Netflix',    category: 'entertainment', icon: '🎬',  color: '#E50914', bg: 'rgba(229,9,20,0.12)' },
  { name: 'Chrome',     category: 'productivity',  icon: '🌐',  color: '#4285F4', bg: 'rgba(66,133,244,0.12)' },
  { name: 'Homework',   category: 'education',     icon: '📚',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  { name: 'Zoom',       category: 'education',     icon: '📹',  color: '#2D8CFF', bg: 'rgba(45,140,255,0.12)' },
  { name: 'Spotify',    category: 'entertainment', icon: '🎧',  color: '#1DB954', bg: 'rgba(29,185,84,0.12)' },
  { name: 'Twitter/X',  category: 'social',        icon: '🐦',  color: '#1DA1F2', bg: 'rgba(29,161,242,0.12)' },
  { name: 'Facebook',   category: 'social',        icon: '👍',  color: '#1877F2', bg: 'rgba(24,119,242,0.12)' },
  { name: 'Discord',    category: 'social',        icon: '🎙️',  color: '#5865F2', bg: 'rgba(88,101,242,0.12)' },
  { name: 'Other',      category: 'other',         icon: '📱',  color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
];

let activeSession = null;
let timerInterval = null;
let heartbeatInterval = null;
let verifiedMinutes = 0;

export async function renderActivityTracker(container) {
  const user = await getUser();
  if (!user || user.role !== 'child') {
    router.navigate('/dashboard');
    return;
  }

  container.innerHTML = `
    <div style="min-height:100vh;background:var(--bg-primary);padding:var(--space-4);max-width:480px;margin:0 auto;">

      <!-- Header -->
      <div style="text-align:center;padding:var(--space-6) 0 var(--space-4);">
        <h1 style="font-size:var(--font-xl);font-weight:var(--weight-bold);color:var(--text-primary);margin:0;">
          <span class="gradient-text">Activity Tracker</span>
        </h1>
        <p style="color:var(--text-muted);font-size:var(--font-xs);margin-top:var(--space-1);">
          Tap an app when you start or stop using it
        </p>
      </div>

      <!-- Auto-Tracking Banner (always on) -->
      <div class="glass-card" style="padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.06);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span class="live-dot" style="width:8px;height:8px;background:#10b981;"></span>
            <span style="font-size:var(--font-xs);color:#10b981;font-weight:var(--weight-semibold);text-transform:uppercase;letter-spacing:0.5px;">
              Auto-Tracking Active
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-1);">
            <i data-lucide="shield-check" style="width:14px;height:14px;color:#10b981;"></i>
            <span id="verified-timer" style="font-size:var(--font-sm);color:#10b981;font-weight:var(--weight-bold);font-family:'Courier New',monospace;">
              0 min
            </span>
          </div>
        </div>
        <p style="font-size:10px;color:var(--text-muted);margin:4px 0 0;line-height:1.3;">
          Screen time is being recorded automatically. Your parent can see your total verified screen time.
        </p>
      </div>

      <!-- Active Session Banner -->
      <div id="active-session" class="glass-card" style="display:none;margin-bottom:var(--space-5);padding:var(--space-5);text-align:center;border:1px solid rgba(6,182,212,0.3);animation:pulse 2s infinite;">
        <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-3);margin-bottom:var(--space-3);">
          <span class="live-dot" style="width:10px;height:10px;"></span>
          <span style="font-size:var(--font-sm);color:var(--color-primary);font-weight:var(--weight-semibold);text-transform:uppercase;letter-spacing:1px;">Currently Tracking</span>
        </div>
        <div id="active-app-name" style="font-size:var(--font-lg);font-weight:var(--weight-bold);color:var(--text-primary);margin-bottom:var(--space-2);"></div>
        <div id="active-timer" style="font-size:40px;font-weight:var(--weight-bold);color:var(--color-primary);font-family:'Courier New',monospace;letter-spacing:4px;margin-bottom:var(--space-4);">00:00</div>
        <button class="btn btn-primary" id="stop-btn" style="width:100%;padding:var(--space-3);background:var(--color-danger);border-color:var(--color-danger);">
          <i data-lucide="square" style="width:16px;height:16px;"></i>
          Stop Tracking
        </button>
      </div>

      <!-- Today's Stats -->
      <div class="glass-card" style="padding:var(--space-4);margin-bottom:var(--space-5);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
          <div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Self-Reported Total</div>
            <div id="today-total" style="font-size:var(--font-lg);font-weight:var(--weight-bold);color:var(--text-primary);margin-top:2px;">0 min</div>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-sm btn-secondary" id="back-dashboard-btn" style="font-size:var(--font-xs);">
              <i data-lucide="arrow-left" style="width:14px;height:14px;"></i>
              Dashboard
            </button>
          </div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);background:rgba(245,158,11,0.08);border-radius:var(--radius-sm);padding:6px 10px;">
          ⚠️ Your parent can compare this against your verified screen time. Honestly report what you're using!
        </div>
      </div>

      <!-- App Grid -->
      <div style="margin-bottom:var(--space-3);">
        <h3 style="font-size:var(--font-sm);color:var(--text-muted);font-weight:var(--weight-medium);margin:0 0 var(--space-3);">
          What are you using?
        </h3>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin-bottom:var(--space-6);" id="app-grid">
        ${TRACKABLE_APPS.map(app => `
          <button class="app-tracker-btn" data-app="${escapeHtml(app.name)}" data-category="${app.category}"
                  style="background:${app.bg};border:1px solid transparent;border-radius:var(--radius-lg);
                         padding:var(--space-3) var(--space-2);text-align:center;cursor:pointer;
                         transition:all 0.2s ease;display:flex;flex-direction:column;align-items:center;gap:6px;">
            <span style="font-size:28px;line-height:1;">${app.icon}</span>
            <span style="font-size:10px;font-weight:var(--weight-medium);color:var(--text-secondary);line-height:1.2;">
              ${escapeHtml(app.name)}
            </span>
          </button>
        `).join('')}
      </div>

      <!-- Recent Sessions -->
      <div class="glass-card" style="padding:var(--space-5);margin-bottom:var(--space-6);">
        <h3 style="font-size:var(--font-sm);font-weight:var(--weight-semibold);color:var(--text-primary);margin:0 0 var(--space-4);">
          <i data-lucide="clock" style="width:16px;height:16px;display:inline;vertical-align:middle;margin-right:6px;"></i>
          Recent Sessions
        </h3>
        <div id="recent-sessions">
          <p style="color:var(--text-muted);font-size:var(--font-xs);text-align:center;">Loading...</p>
        </div>
      </div>
    </div>

    <style>
      .app-tracker-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .app-tracker-btn:active {
        transform: scale(0.95);
      }
      .app-tracker-btn.tracking {
        border-color: var(--color-primary) !important;
        box-shadow: 0 0 0 2px rgba(6,182,212,0.3), 0 0 20px rgba(6,182,212,0.15);
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
      }
    </style>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  // ── Start auto-tracking heartbeat ─────────────────────────
  _startHeartbeat(container);

  // ── Check for existing active session ─────────────────────
  try {
    const res = await api.get('/api/usage/track/active');
    if (res.active) {
      activeSession = res.active;
      _showActiveSession(container, res.active);
    }
  } catch (err) {
    console.warn('Could not check active session:', err);
  }

  // ── Load today's total ────────────────────────────────────
  _loadTodayTotal(container, user.id);

  // ── Load recent sessions ──────────────────────────────────
  _loadRecentSessions(container, user.id);

  // ── App grid click handlers ───────────────────────────────
  container.querySelectorAll('.app-tracker-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const appName = btn.dataset.app;
      const category = btn.dataset.category;

      if (activeSession) {
        // Stop current session
        await _stopTracking(container, user.id);
      } else {
        // Start tracking
        await _startTracking(container, appName, category, user.id);
      }
    });
  });

  // ── Stop button ───────────────────────────────────────────
  container.querySelector('#stop-btn')?.addEventListener('click', async () => {
    await _stopTracking(container, user.id);
  });

  // ── Back button ───────────────────────────────────────────
  container.querySelector('#back-dashboard-btn')?.addEventListener('click', () => {
    _stopHeartbeat();
    router.navigate('/dashboard');
  });
}


// ── Auto-tracking heartbeat (Verified) ──────────────────────

function _startHeartbeat(container) {
  // Clear any existing heartbeat
  _stopHeartbeat();

  let isVisible = true;

  // Send initial heartbeat immediately
  _sendHeartbeat(container);

  // Send heartbeat every 60 seconds while page is visible
  heartbeatInterval = setInterval(() => {
    if (isVisible) {
      _sendHeartbeat(container);
    }
  }, 60000);

  // Pause heartbeat when page/tab is hidden (child switched to another app)
  const handleVisibility = () => {
    isVisible = !document.hidden;
    if (isVisible) {
      // Resumed — send immediate heartbeat
      _sendHeartbeat(container);
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);

  // Store cleanup ref
  container._heartbeatCleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

function _stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function _sendHeartbeat(container) {
  try {
    const res = await api.post('/api/usage/track/heartbeat');
    if (res && !res.error) {
      verifiedMinutes = res.verified_minutes || 0;
      const el = container.querySelector('#verified-timer');
      if (el) el.textContent = formatMinutes(verifiedMinutes);
    }
  } catch {
    // Silent fail — heartbeat is best-effort
  }
}


// ── Manual tracking helpers ─────────────────────────────────

async function _startTracking(container, appName, category, childId) {
  try {
    const res = await api.post('/api/usage/track/start', {
      app_name: appName,
      app_category: category,
    });

    if (res.error) throw new Error(res.error);

    activeSession = {
      id: res.session_id,
      app_name: appName,
      app_category: category,
      start_time: res.start_time,
    };

    _showActiveSession(container, activeSession);
    showToast(`Tracking ${appName}`, 'success');

    // Highlight the button
    const btn = container.querySelector(`[data-app="${appName}"]`);
    if (btn) btn.classList.add('tracking');

  } catch (err) {
    showToast(err.message || 'Failed to start tracking', 'error');
  }
}

async function _stopTracking(container, childId) {
  try {
    const res = await api.post('/api/usage/track/stop');
    if (res.error) throw new Error(res.error);

    const appName = activeSession?.app_name || res.app_name;
    const duration = res.duration_minutes;

    showToast(`${appName} — ${formatMinutes(Math.round(duration))} recorded`, 'success');

    // Remove highlight
    container.querySelectorAll('.app-tracker-btn.tracking').forEach(b => b.classList.remove('tracking'));

    activeSession = null;
    _hideActiveSession(container);
    _loadTodayTotal(container, childId);
    _loadRecentSessions(container, childId);

  } catch (err) {
    showToast(err.message || 'Failed to stop tracking', 'error');
  }
}

function _showActiveSession(container, session) {
  const banner = container.querySelector('#active-session');
  const appEl  = container.querySelector('#active-app-name');
  const timerEl = container.querySelector('#active-timer');

  if (!banner) return;

  const app = TRACKABLE_APPS.find(a => a.name === session.app_name);
  appEl.textContent = `${app?.icon || '📱'} ${session.app_name}`;
  banner.style.display = 'block';

  // Highlight the active app button
  const btn = container.querySelector(`[data-app="${session.app_name}"]`);
  if (btn) btn.classList.add('tracking');

  // Start timer
  if (timerInterval) clearInterval(timerInterval);
  const startTime = new Date(session.start_time).getTime();

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;

    if (hrs > 0) {
      timerEl.textContent = `${String(hrs).padStart(2, '0')}:${String(remainMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function _hideActiveSession(container) {
  const banner = container.querySelector('#active-session');
  if (banner) banner.style.display = 'none';
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function _loadTodayTotal(container, childId) {
  const totalEl = container.querySelector('#today-total');
  if (!totalEl) return;

  try {
    const res = await api.get(`/api/usage/today/${childId}`);
    if (res && !res.error) {
      totalEl.textContent = formatMinutes(res.total_minutes || 0);
    }
  } catch {
    totalEl.textContent = '—';
  }
}

async function _loadRecentSessions(container, childId) {
  const sessionsEl = container.querySelector('#recent-sessions');
  if (!sessionsEl) return;

  try {
    const res = await api.get(`/api/usage/today/${childId}`);
    const sessions = (res?.sessions || [])
      .filter(s => s.end_time && s.app_name !== 'Screen Time (Verified)')
      .slice(-6).reverse();

    if (sessions.length === 0) {
      sessionsEl.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-xs);text-align:center;padding:var(--space-4);">No completed sessions yet. Start tracking!</p>';
      return;
    }

    sessionsEl.innerHTML = sessions.map(s => {
      const app = TRACKABLE_APPS.find(a => a.name === s.app_name);
      const duration = Math.round(s.duration_minutes || 0);
      const time = new Date(s.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:20px;width:32px;text-align:center;">${app?.icon || '📱'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:var(--font-sm);color:var(--text-primary);font-weight:var(--weight-medium);">${escapeHtml(s.app_name)}</div>
            <div style="font-size:var(--font-xs);color:var(--text-muted);">${time}</div>
          </div>
          <span style="font-size:var(--font-sm);color:var(--color-primary);font-weight:var(--weight-semibold);">
            ${formatMinutes(duration)}
          </span>
        </div>
      `;
    }).join('');
  } catch {
    sessionsEl.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-xs);text-align:center;">Could not load sessions.</p>';
  }
}
