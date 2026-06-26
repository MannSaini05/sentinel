/* ============================================================
   SENTINEL — Dashboard Page
   The main page. Designed to look INCREDIBLE.
   ============================================================ */

import { renderSidebar, createSidebarOverlay, toggleSidebar } from '../components/sidebar.js';
import { renderNavbar, updateBreadcrumb, updateAlertCount } from '../components/navbar.js';
import { renderStatsGrid } from '../components/statsCard.js';
import { api } from '../services/api.js';
import { getUser, getToken } from '../services/auth.js';
import { connectSSE, onSSEEvent } from '../services/sse.js';
import { formatMinutes, formatTime, getInitials, getCategoryColor, getCategoryIcon, timeAgo, getPercentage, escapeHtml, showToast } from '../utils/helpers.js';
import { CHART_COLORS, APP_CATEGORIES } from '../utils/constants.js';
import router from '../utils/router.js';

/**
 * Render the main dashboard page with stats, children grid,
 * activity feed, and category doughnut chart.
 */
export async function renderDashboardPage(container) {
  const user = await getUser();
  if (!user) return;

  // ── Child users get their own dashboard ────────────────────
  if (user.role === 'child') {
    return _renderChildDashboard(container, user);
  }

  // ── Layout shell ──────────────────────────────────────────
  container.innerHTML = '<div class="app-layout"><div class="main-content" id="main-content"></div></div>';
  const layout = container.querySelector('.app-layout');
  const main   = container.querySelector('#main-content');

  // Sidebar + overlay
  renderSidebar(layout, '/dashboard');
  createSidebarOverlay(layout);

  // Navbar
  const navbar = renderNavbar(main, { onHamburgerClick: toggleSidebar });
  updateBreadcrumb(navbar, 'Dashboard');

  // Main content inner wrapper
  const inner = document.createElement('div');
  inner.className = 'main-content-inner page-enter';
  main.appendChild(inner);

  // ── Loading skeleton ──────────────────────────────────────
  inner.innerHTML = `
    <!-- Greeting -->
    <div class="page-header">
      <h1 class="page-greeting">
        Welcome back, <span class="gradient-text">${escapeHtml(user.name || 'User')}</span>
      </h1>
      <p class="page-greeting-date">${_formatToday()}</p>
    </div>

    <!-- Stats skeleton -->
    <div class="stats-grid" id="stats-grid">
      ${_skeletonCards(4)}
    </div>

    <!-- Children section header -->
    <div class="section-header">
      <div>
        <h2 class="section-title">Your Children</h2>
        <p class="section-subtitle">Real-time activity overview</p>
      </div>
      <div class="live-indicator">
        <span class="live-dot"></span>
        Live
      </div>
    </div>

    <!-- Children grid skeleton -->
    <div class="children-grid" id="children-grid">
      ${_skeletonCards(3, 'skeleton-card')}
    </div>

    <!-- Two-column bottom section -->
    <div class="dashboard-grid" id="dashboard-bottom">
      <!-- Activity Feed -->
      <div class="glass-card" id="activity-card">
        <div class="activity-feed-header">
          <div>
            <h3 style="font-size: var(--font-md); font-weight: var(--weight-semibold); color: var(--text-primary);">Recent Activity</h3>
            <p style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;">Today's sessions</p>
          </div>
          <button class="section-action" id="view-all-activity">
            View all <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
          </button>
        </div>
        <div class="activity-feed-body activity-feed" id="activity-feed">
          <div class="skeleton skeleton-text" style="width:100%;height:42px;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-text" style="width:100%;height:42px;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-text" style="width:90%;height:42px;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-text" style="width:80%;height:42px;"></div>
        </div>
      </div>

      <!-- Category doughnut -->
      <div class="glass-card chart-container" id="category-card">
        <div class="chart-container-header">
          <h3 class="chart-container-title">Today's Categories</h3>
        </div>
        <div class="chart-wrapper" style="max-width:320px;margin:0 auto;">
          <canvas id="category-chart" width="320" height="320"></canvas>
        </div>
        <div id="category-legend" style="margin-top: var(--space-4);"></div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [inner] });

  // ── Data fetching ──────────────────────────────────────────
  let comparisonData = [];
  let alertCount     = 0;
  let todayUsage     = null;

  try {
    const [compRes, alertRes] = await Promise.all([
      api.get('/api/analytics/comparison'),
      api.get('/api/alerts/count')
    ]);

    comparisonData = compRes?.children || compRes || [];
    if (!Array.isArray(comparisonData)) comparisonData = [];

    alertCount = alertRes?.count ?? 0;
    updateAlertCount(navbar, alertCount);

    // Fetch today's usage for the first child (for activity feed & chart)
    if (comparisonData.length > 0) {
      const firstId = comparisonData[0].id;
      const usageRes = await api.get(`/api/usage/today/${firstId}`);
      if (!usageRes.error) todayUsage = usageRes;
    }
  } catch (err) {
    console.error('Dashboard data fetch error:', err);
  }

  // ── Render stats ──────────────────────────────────────────
  const statsContainer = inner.querySelector('#stats-grid');
  statsContainer.innerHTML = '';

  const totalMinutes    = comparisonData.reduce((sum, c) => sum + (c.today?.total_minutes || 0), 0);
  const activeChildren  = comparisonData.length;
  const avgDaily        = comparisonData.reduce((max, c) => Math.max(max, c.weekly?.avg_daily || 0), 0);

  renderStatsGrid(statsContainer.parentNode, [
    {
      title: 'Total Screen Time',
      value: formatMinutes(totalMinutes),
      icon: 'clock',
      color: 'cyan',
      numericValue: totalMinutes,
      trend: 'neutral',
      trendValue: ''
    },
    {
      title: 'Active Children',
      value: String(activeChildren),
      icon: 'users',
      color: 'green',
      numericValue: activeChildren,
      trend: 'neutral',
      trendValue: ''
    },
    {
      title: 'Alerts Today',
      value: String(alertCount),
      icon: 'bell',
      color: 'amber',
      numericValue: alertCount,
      trend: alertCount > 0 ? 'up' : 'neutral',
      trendValue: alertCount > 0 ? `${alertCount} new` : ''
    },
    {
      title: 'Avg Daily',
      value: formatMinutes(Math.round(avgDaily)),
      icon: 'trending-up',
      color: 'purple',
      numericValue: Math.round(avgDaily),
      trend: 'neutral',
      trendValue: ''
    }
  ]);

  // Remove the skeleton grid since renderStatsGrid appends a new one
  statsContainer.remove();

  // ── Render children cards ─────────────────────────────────
  const childrenGrid = inner.querySelector('#children-grid');
  childrenGrid.innerHTML = '';

  if (comparisonData.length === 0) {
    childrenGrid.innerHTML = `
      <div class="glass-card p-8 text-center dashboard-grid-full" style="grid-column: 1 / -1;">
        <div class="empty-state" style="padding: var(--space-8);">
          <i data-lucide="user-plus" class="empty-state-icon" style="width:48px;height:48px;"></i>
          <p class="empty-state-title">No children linked yet</p>
          <p class="empty-state-text">Go to Settings to link a child account and start monitoring.</p>
          <button class="btn btn-primary mt-4" onclick="window.router.navigate('/settings')">
            <i data-lucide="settings" style="width:16px;height:16px;"></i>
            Go to Settings
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ nodes: [childrenGrid] });
  } else {
    comparisonData.forEach((child, i) => {
      const card = _renderChildCard(child, i);
      childrenGrid.appendChild(card);
    });

    // ── Verified Screen Time Section ──────────────────────
    // Fetch trust score data for each child and render below children grid
    _renderVerifiedSection(inner, comparisonData);
  }

  // ── Render activity feed ──────────────────────────────────
  const feedContainer = inner.querySelector('#activity-feed');
  _renderActivityFeed(feedContainer, todayUsage, comparisonData);

  // ── Render doughnut chart ─────────────────────────────────
  _renderCategoryChart(todayUsage, comparisonData);

  // ── SSE Integration ────────────────────────────────────────
  try {
    connectSSE(getToken());

    onSSEEvent('usage_update', (data) => {
      // Add to activity feed
      if (data && feedContainer) {
        const item = _createActivityItem({
          app_name: data.app_name || 'Unknown',
          app_category: data.category || 'other',
          duration_minutes: data.duration_minutes || 0,
          start_time: data.start_time || new Date().toISOString()
        });
        feedContainer.prepend(item);
        if (window.lucide) window.lucide.createIcons({ nodes: [item] });
      }
    });

    onSSEEvent('alert', (_data) => {
      alertCount++;
      updateAlertCount(navbar, alertCount);
    });

    // ── Real-time child online/offline status ──────────────
    onSSEEvent('child_status', (data) => {
      if (!data?.child_id) return;

      // Find the child card in the grid
      const childCards = inner.querySelectorAll('.child-card');
      childCards.forEach(card => {
        const statusEl = card.querySelector('.child-card-status');
        if (!statusEl) return;

        // Match by child name (since we don't have IDs on cards)
        const nameEl = card.querySelector('.child-card-name');
        if (nameEl && nameEl.textContent.trim() === data.child_name) {
          if (data.status === 'online') {
            statusEl.className = 'child-card-status active';
            statusEl.innerHTML = '<span class="live-dot" style="width:6px;height:6px;"></span> Online now';
            // Flash the card
            card.style.borderColor = 'rgba(16,185,129,0.4)';
            setTimeout(() => { card.style.borderColor = ''; }, 2000);
          } else {
            statusEl.className = 'child-card-status';
            statusEl.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Offline`;
            card.style.borderColor = 'rgba(239,68,68,0.2)';
            setTimeout(() => { card.style.borderColor = ''; }, 2000);
          }
        }
      });

      // Also update the verified section
      const verifiedCards = inner.querySelectorAll('#verified-cards .glass-card');
      verifiedCards.forEach(vCard => {
        const nameEl = vCard.querySelector('[style*="font-weight:var(--weight-semibold)"]');
        if (nameEl && nameEl.textContent.trim() === data.child_name) {
          const statusLine = nameEl.parentElement?.querySelector('[style*="font-size:var(--font-xs)"]');
          if (statusLine) {
            if (data.status === 'online') {
              statusLine.style.color = '#10b981';
              statusLine.textContent = '🟢 Online now';
            } else {
              statusLine.style.color = 'var(--text-muted)';
              statusLine.textContent = '🔴 Offline';
            }
          }
        }
      });
    });

    // ── Real-time heartbeat updates (verified minutes) ──────
    onSSEEvent('heartbeat', (data) => {
      if (!data?.child_id) return;
      // Could update verified minutes on verified cards in real-time
      // For now, the section refreshes on page load
    });

  } catch (err) {
    console.warn('SSE connection skipped:', err);
  }
}

// ═════════════════════════════════════════════════════════════
// Child Dashboard — shown when a child account logs in
// ═════════════════════════════════════════════════════════════

async function _renderChildDashboard(container, user) {
  container.innerHTML = `
    <div class="auth-page" style="min-height:100vh;">
      <div style="width:100%;max-width:540px;padding:var(--space-6);">

        <!-- Welcome Header -->
        <div style="text-align:center;margin-bottom:var(--space-8);">
          <div class="avatar avatar-xl" style="background:${user.avatar_color || '#06b6d4'};margin:0 auto var(--space-4);width:72px;height:72px;font-size:28px;">
            ${getInitials(user.name || 'Child')}
          </div>
          <h1 style="font-size:var(--font-2xl);font-weight:var(--weight-bold);color:var(--text-primary);margin:0;">
            Hey, <span class="gradient-text">${escapeHtml(user.name || 'there')}</span>!
          </h1>
          <p style="color:var(--text-muted);margin-top:var(--space-2);font-size:var(--font-sm);">
            ${_formatToday()}
          </p>
        </div>

        <!-- Link Code Section -->
        <div class="glass-card animate-slide-up" style="padding:var(--space-8);text-align:center;margin-bottom:var(--space-6);">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-4);">
            <i data-lucide="link" style="width:24px;height:24px;color:var(--color-primary);"></i>
          </div>
          <h2 style="font-size:var(--font-lg);font-weight:var(--weight-semibold);color:var(--text-primary);margin:0 0 var(--space-2);">
            Link to Your Parent
          </h2>
          <p style="color:var(--text-muted);font-size:var(--font-sm);margin:0 0 var(--space-6);line-height:1.6;">
            Generate a link code and share it with your parent so they can monitor your screen time and set healthy limits.
          </p>

          <div id="link-code-display" style="display:none;margin-bottom:var(--space-5);">
            <div style="background:rgba(6,182,212,0.08);border:2px dashed var(--color-primary);border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-3);">
              <p style="color:var(--text-muted);font-size:var(--font-xs);text-transform:uppercase;letter-spacing:1px;margin:0 0 var(--space-2);">Your Link Code</p>
              <p id="link-code-value" style="font-size:36px;font-weight:var(--weight-bold);color:var(--color-primary);letter-spacing:8px;margin:0;font-family:'Courier New',monospace;">------</p>
            </div>
            <p style="color:var(--text-muted);font-size:var(--font-xs);">
              Share this code with your parent. They can enter it in Settings → Child Accounts → Link Code.
            </p>
          </div>

          <button class="btn btn-primary" id="generate-link-btn" style="width:100%;padding:var(--space-4);font-size:var(--font-md);">
            <i data-lucide="key" style="width:18px;height:18px;"></i>
            Generate Link Code
          </button>
        </div>

        <!-- Track My Activity Button -->
        <div class="glass-card animate-slide-up" style="padding:var(--space-6);text-align:center;margin-bottom:var(--space-6);animation-delay:0.05s;background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(139,92,246,0.1));border:1px solid rgba(6,182,212,0.2);">
          <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-2);margin-bottom:var(--space-3);">
            <span style="font-size:24px;">📱</span>
            <h2 style="font-size:var(--font-lg);font-weight:var(--weight-bold);color:var(--text-primary);margin:0;">
              Track My Activity
            </h2>
          </div>
          <p style="color:var(--text-muted);font-size:var(--font-sm);margin:0 0 var(--space-4);line-height:1.5;">
            Tap apps you're using so your parent can see your activity in real-time!
          </p>
          <button class="btn btn-primary" id="open-tracker-btn" style="width:100%;padding:var(--space-4);font-size:var(--font-md);background:linear-gradient(135deg,#06b6d4,#8b5cf6);border:none;">
            <i data-lucide="activity" style="width:18px;height:18px;"></i>
            Open Activity Tracker
          </button>
        </div>

        <!-- Auto-Tracking Status -->
        <div class="glass-card animate-slide-up" style="padding:var(--space-4);margin-bottom:var(--space-4);animation-delay:0.07s;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.06);">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <span class="live-dot" style="width:10px;height:10px;background:#10b981;"></span>
            <div>
              <div style="font-size:var(--font-sm);font-weight:var(--weight-semibold);color:#10b981;">Auto-Tracking Active</div>
              <div style="font-size:var(--font-xs);color:var(--text-muted);">Your screen time is being monitored automatically. Your parent can see when you're online.</div>
            </div>
            <i data-lucide="shield-check" style="width:24px;height:24px;color:#10b981;flex-shrink:0;"></i>
          </div>
        </div>

        <!-- PWA Install Banner -->
        <div class="glass-card animate-slide-up" id="pwa-install-card" style="display:none;padding:var(--space-5);text-align:center;margin-bottom:var(--space-6);animation-delay:0.08s;border:1px solid rgba(139,92,246,0.3);background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(6,182,212,0.08));">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-3);">
            <i data-lucide="download" style="width:24px;height:24px;color:#8b5cf6;"></i>
          </div>
          <h3 style="font-size:var(--font-md);font-weight:var(--weight-bold);color:var(--text-primary);margin:0 0 var(--space-2);">Install Sentinel</h3>
          <p style="font-size:var(--font-xs);color:var(--text-muted);margin:0 0 var(--space-4);line-height:1.5;">
            Install this app on your phone for <strong>background monitoring</strong>. It works even when you switch to other apps!
          </p>
          <button class="btn btn-primary" id="pwa-install-btn" style="width:100%;padding:var(--space-3);background:linear-gradient(135deg,#8b5cf6,#06b6d4);border:none;">
            <i data-lucide="smartphone" style="width:16px;height:16px;"></i>
            Install on My Phone
          </button>
        </div>
        <!-- Usage Summary (if linked) -->
        <div class="glass-card animate-slide-up" id="child-usage-card" style="padding:var(--space-6);animation-delay:0.1s;margin-bottom:var(--space-6);">
          <h3 style="font-size:var(--font-md);font-weight:var(--weight-semibold);color:var(--text-primary);margin:0 0 var(--space-4);">
            <i data-lucide="bar-chart-3" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px;"></i>
            My Usage Today
          </h3>
          <div id="child-usage-content">
            <div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div>
          </div>
        </div>

        <!-- Logout -->
        <div style="text-align:center;">
          <button class="btn btn-secondary" id="child-logout-btn" style="padding:var(--space-3) var(--space-6);">
            <i data-lucide="log-out" style="width:16px;height:16px;"></i>
            Sign Out
          </button>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  // ── Generate Link Code handler ─────────────────────────────
  const generateBtn = container.querySelector('#generate-link-btn');
  const codeDisplay = container.querySelector('#link-code-display');
  const codeValue   = container.querySelector('#link-code-value');

  generateBtn?.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="btn-spinner"></span> Generating…';

    try {
      const res = await api.post('/api/auth/generate-link-code');
      if (res.error) throw new Error(res.error);

      codeValue.textContent = res.linkCode || '------';
      codeDisplay.style.display = 'block';
      generateBtn.innerHTML = '<i data-lucide="refresh-cw" style="width:18px;height:18px;"></i> Regenerate Code';
      if (window.lucide) window.lucide.createIcons({ nodes: [generateBtn] });
    } catch (err) {
      showToast(err.message || 'Failed to generate link code', 'error');
      generateBtn.innerHTML = '<i data-lucide="key" style="width:18px;height:18px;"></i> Generate Link Code';
      if (window.lucide) window.lucide.createIcons({ nodes: [generateBtn] });
    }

    generateBtn.disabled = false;
  });

  // ── Fetch child's own usage ────────────────────────────────
  const usageContent = container.querySelector('#child-usage-content');
  try {
    const dailyRes = await api.get(`/api/analytics/daily/${user.id}`);
    if (dailyRes && !dailyRes.error) {
      usageContent.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-4);">
          <div style="background:rgba(6,182,212,0.08);border-radius:var(--radius-md);padding:var(--space-4);text-align:center;">
            <p style="color:var(--text-muted);font-size:var(--font-xs);margin:0 0 4px;">Screen Time</p>
            <p style="color:var(--color-primary);font-size:var(--font-xl);font-weight:var(--weight-bold);margin:0;">
              ${formatMinutes(dailyRes.total_minutes || 0)}
            </p>
          </div>
          <div style="background:rgba(16,185,129,0.08);border-radius:var(--radius-md);padding:var(--space-4);text-align:center;">
            <p style="color:var(--text-muted);font-size:var(--font-xs);margin:0 0 4px;">Sessions</p>
            <p style="color:var(--color-success);font-size:var(--font-xl);font-weight:var(--weight-bold);margin:0;">
              ${dailyRes.session_count || 0}
            </p>
          </div>
          <div style="background:rgba(139,92,246,0.08);border-radius:var(--radius-md);padding:var(--space-4);text-align:center;">
            <p style="color:var(--text-muted);font-size:var(--font-xs);margin:0 0 4px;">Top App</p>
            <p style="color:var(--color-accent);font-size:var(--font-sm);font-weight:var(--weight-semibold);margin:0;">
              ${escapeHtml(dailyRes.top_app?.name || 'None')}
            </p>
          </div>
          <div style="background:rgba(245,158,11,0.08);border-radius:var(--radius-md);padding:var(--space-4);text-align:center;">
            <p style="color:var(--text-muted);font-size:var(--font-xs);margin:0 0 4px;">Top Category</p>
            <p style="color:var(--color-warning);font-size:var(--font-sm);font-weight:var(--weight-semibold);margin:0;">
              ${escapeHtml(dailyRes.top_category?.name || 'None')}
            </p>
          </div>
        </div>
      `;
    } else {
      usageContent.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-sm);text-align:center;">No usage data yet today.</p>';
    }
  } catch (err) {
    usageContent.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-sm);text-align:center;">Unable to load usage data.</p>';
  }

  // ── Open Tracker handler ────────────────────────────────────
  container.querySelector('#open-tracker-btn')?.addEventListener('click', () => {
    router.navigate('/tracker');
  });

  // ── PWA Install handler ─────────────────────────────────────
  let deferredPrompt = null;
  const installCard = container.querySelector('#pwa-install-card');
  const installBtn = container.querySelector('#pwa-install-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installCard) installCard.style.display = 'block';
    if (window.lucide) window.lucide.createIcons({ nodes: [installCard] });
  });

  // Also show install card if not already installed (standalone check)
  if (installCard && !window.matchMedia('(display-mode: standalone)').matches) {
    // On Android Chrome, beforeinstallprompt fires. On iOS, show manual instructions.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      installCard.style.display = 'block';
      const btn = installCard.querySelector('#pwa-install-btn');
      if (btn) {
        btn.textContent = 'Tap Share → Add to Home Screen';
        btn.disabled = true;
        btn.style.opacity = '0.7';
      }
      if (window.lucide) window.lucide.createIcons({ nodes: [installCard] });
    }
  }

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      showToast('Sentinel installed! It will track in the background.', 'success');
      installCard.style.display = 'none';
    }
    deferredPrompt = null;
  });

  // ── Logout handler ─────────────────────────────────────────
  const { logout } = await import('../services/auth.js');
  container.querySelector('#child-logout-btn')?.addEventListener('click', () => {
    logout();
    router.navigate('/login');
  });
}


// ═══════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════

/** Format today's date nicely */
function _formatToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Renders a "Verified Screen Time" section showing trust scores
 * for each child. Compares verified (heartbeat) vs self-reported time.
 */
async function _renderVerifiedSection(inner, children) {
  // Create container after children-grid
  const childrenGrid = inner.querySelector('#children-grid');
  if (!childrenGrid) return;

  const section = document.createElement('div');
  section.style.marginTop = 'var(--space-6)';
  section.innerHTML = `
    <div class="section-header" style="margin-bottom:var(--space-4);">
      <div>
        <h2 class="section-title">
          <i data-lucide="shield-check" style="width:20px;height:20px;display:inline;vertical-align:middle;margin-right:6px;color:#10b981;"></i>
          Verified Screen Time
        </h2>
        <p class="section-subtitle">Auto-tracked vs self-reported · Detect discrepancies</p>
      </div>
    </div>
    <div id="verified-cards" class="children-grid"></div>
  `;
  childrenGrid.after(section);
  if (window.lucide) window.lucide.createIcons({ nodes: [section] });

  const cardsContainer = section.querySelector('#verified-cards');

  // Fetch screen time data for each child
  const results = await Promise.allSettled(
    children.map(child =>
      api.get(`/api/usage/track/screentime/${child.id}`)
        .then(res => ({ child, data: res }))
    )
  );

  results.forEach(result => {
    if (result.status !== 'fulfilled') return;
    const { child, data } = result.value;
    if (data.error) return;

    const verified = data.verified_minutes || 0;
    const reported = data.self_reported_minutes || 0;
    const unreported = data.unreported_minutes || 0;
    const trustScore = data.trust_score ?? 100;
    const isOnline = data.is_online;

    // Trust color
    let trustColor = '#10b981'; // green
    let trustLabel = 'Honest';
    let trustBg = 'rgba(16,185,129,0.1)';
    let trustBorder = 'rgba(16,185,129,0.3)';

    if (trustScore < 50) {
      trustColor = '#ef4444'; trustLabel = 'Low Trust';
      trustBg = 'rgba(239,68,68,0.1)'; trustBorder = 'rgba(239,68,68,0.3)';
    } else if (trustScore < 80) {
      trustColor = '#f59e0b'; trustLabel = 'Suspicious';
      trustBg = 'rgba(245,158,11,0.1)'; trustBorder = 'rgba(245,158,11,0.3)';
    }

    const card = document.createElement('div');
    card.className = 'glass-card animate-slide-up';
    card.style.padding = 'var(--space-5)';

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div class="avatar" style="background:${child.avatar_color || '#06b6d4'};width:36px;height:36px;font-size:14px;">
            ${getInitials(child.name)}
          </div>
          <div>
            <div style="font-size:var(--font-sm);font-weight:var(--weight-semibold);color:var(--text-primary);">${escapeHtml(child.name)}</div>
            <div style="font-size:var(--font-xs);color:${isOnline ? '#10b981' : 'var(--text-muted)'};">
              ${isOnline ? '🟢 Online now' : '⚫ Offline'}
            </div>
          </div>
        </div>
        <div style="text-align:center;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:${trustBg};border:1px solid ${trustBorder};">
          <div style="font-size:var(--font-lg);font-weight:var(--weight-bold);color:${trustColor};">${trustScore}%</div>
          <div style="font-size:9px;color:${trustColor};text-transform:uppercase;letter-spacing:0.5px;">${trustLabel}</div>
        </div>
      </div>

      <!-- Comparison bars -->
      <div style="margin-bottom:var(--space-3);">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:var(--font-xs);color:var(--text-muted);">
            <i data-lucide="shield-check" style="width:12px;height:12px;display:inline;vertical-align:middle;color:#10b981;"></i>
            Verified (auto)
          </span>
          <span style="font-size:var(--font-xs);font-weight:var(--weight-semibold);color:#10b981;">${formatMinutes(verified)}</span>
        </div>
        <div class="progress-bar progress-bar-sm" style="margin-bottom:var(--space-2);">
          <div class="progress-bar-fill" style="width:${verified > 0 ? 100 : 0}%;background:#10b981;"></div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:var(--font-xs);color:var(--text-muted);">
            <i data-lucide="user" style="width:12px;height:12px;display:inline;vertical-align:middle;color:var(--color-primary);"></i>
            Self-Reported
          </span>
          <span style="font-size:var(--font-xs);font-weight:var(--weight-semibold);color:var(--color-primary);">${formatMinutes(reported)}</span>
        </div>
        <div class="progress-bar progress-bar-sm">
          <div class="progress-bar-fill" style="width:${verified > 0 ? Math.min(100, (reported / verified) * 100) : 0}%;background:var(--color-primary);"></div>
        </div>
      </div>

      ${unreported > 0 ? `
        <div style="background:rgba(245,158,11,0.08);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:var(--space-2);">
          <i data-lucide="alert-triangle" style="width:14px;height:14px;color:#f59e0b;flex-shrink:0;"></i>
          <span style="font-size:var(--font-xs);color:#f59e0b;font-weight:var(--weight-medium);">
            ${formatMinutes(unreported)} of screen time was NOT reported by ${escapeHtml(child.name)}
          </span>
        </div>
      ` : verified > 0 ? `
        <div style="background:rgba(16,185,129,0.08);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:var(--space-2);">
          <i data-lucide="check-circle" style="width:14px;height:14px;color:#10b981;flex-shrink:0;"></i>
          <span style="font-size:var(--font-xs);color:#10b981;font-weight:var(--weight-medium);">
            All screen time has been honestly reported ✓
          </span>
        </div>
      ` : `
        <div style="background:rgba(100,116,139,0.08);border-radius:var(--radius-sm);padding:8px 12px;display:flex;align-items:center;gap:var(--space-2);">
          <i data-lucide="info" style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0;"></i>
          <span style="font-size:var(--font-xs);color:var(--text-muted);">
            No verified screen time data yet. Child needs to open the Activity Tracker.
          </span>
        </div>
      `}
    `;

    cardsContainer.appendChild(card);
    if (window.lucide) window.lucide.createIcons({ nodes: [card] });
  });
}

/** Generate skeleton card placeholders */
function _skeletonCards(count, cls = '') {
  return Array.from({ length: count }, () =>
    `<div class="skeleton ${cls}" style="height:140px;border-radius:var(--radius-lg);"></div>`
  ).join('');
}

/** Render a single child card */
function _renderChildCard(child, index) {
  const name      = child.name || 'Child';
  const initials  = getInitials(name);
  const color     = child.avatar_color || '#06b6d4';
  const todayMin  = child.today?.total_minutes || 0;
  const sessions  = child.today?.session_count || 0;
  const limitMin  = child.today?.limit_minutes || 120;
  const pct       = getPercentage(todayMin, limitMin);
  const topCat    = child.today?.top_category || 'None';
  const weeklyAvg = child.weekly?.avg_daily || 0;

  // Ring colors based on percentage
  let ringColor = 'var(--color-success)';
  if (pct > 90)      ringColor = 'var(--color-danger)';
  else if (pct > 70) ringColor = 'var(--color-warning)';
  else if (pct > 50) ringColor = 'var(--color-primary)';

  const circumference = 2 * Math.PI * 33; // r=33
  const offset        = circumference * (1 - pct / 100);

  const card = document.createElement('div');
  card.className = 'glass-card glass-card-hover child-card animate-slide-up';
  card.style.animationDelay = `${index * 0.1}s`;

  card.innerHTML = `
    <div class="child-card-header">
      <div class="avatar avatar-lg" style="background: ${color};">${initials}</div>
      <div class="child-card-info">
        <div class="child-card-name">${escapeHtml(name)}</div>
        <div class="child-card-status active">
          <span class="live-dot" style="width:6px;height:6px;"></span>
          Active now
        </div>
      </div>
      <i data-lucide="chevron-right" style="width:20px;height:20px;color:var(--text-muted);"></i>
    </div>

    <div class="child-card-body">
      <div class="child-card-details">
        <div class="child-card-usage-text">
          <strong>${formatMinutes(todayMin)}</strong> of ${formatMinutes(limitMin)} today
        </div>
        <div class="child-card-chips">
          <span class="chip">
            <i data-lucide="clock" style="width:12px;height:12px;"></i>
            ${sessions} sessions
          </span>
          <span class="chip">
            <i data-lucide="${getCategoryIcon(topCat)}" style="width:12px;height:12px;"></i>
            ${escapeHtml(topCat)}
          </span>
          <span class="chip">
            <i data-lucide="bar-chart-3" style="width:12px;height:12px;"></i>
            Avg ${formatMinutes(Math.round(weeklyAvg))}
          </span>
        </div>
      </div>
      <div class="usage-ring">
        <svg viewBox="0 0 80 80">
          <circle class="usage-ring-bg" cx="40" cy="40" r="33"></circle>
          <circle class="usage-ring-fill"
                  cx="40" cy="40" r="33"
                  stroke="${ringColor}"
                  stroke-dasharray="${circumference}"
                  stroke-dashoffset="${offset}">
          </circle>
        </svg>
        <div class="usage-ring-text">
          <span class="usage-ring-percent">${pct}%</span>
          <span class="usage-ring-label">used</span>
        </div>
      </div>
    </div>
  `;

  // Navigate to child profile on click
  card.addEventListener('click', () => {
    router.navigate(`/child/${child.id}`);
  });

  if (window.lucide) window.lucide.createIcons({ nodes: [card] });
  return card;
}

/** Render the activity feed from today's usage */
function _renderActivityFeed(feedContainer, todayUsage, comparisonData) {
  feedContainer.innerHTML = '';

  const sessions = todayUsage?.sessions || [];
  const recentSessions = sessions.slice(-8).reverse();

  if (recentSessions.length === 0) {
    feedContainer.innerHTML = `
      <div style="padding: var(--space-6); text-align: center; color: var(--text-muted); font-size: var(--font-sm);">
        <i data-lucide="activity" style="width:32px;height:32px;opacity:0.3;margin:0 auto var(--space-3);display:block;"></i>
        No activity recorded today yet
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ nodes: [feedContainer] });
    return;
  }

  recentSessions.forEach(session => {
    const item = _createActivityItem(session);
    feedContainer.appendChild(item);
  });

  if (window.lucide) window.lucide.createIcons({ nodes: [feedContainer] });
}

/** Create a single activity item element */
function _createActivityItem(session) {
  const cat      = session.app_category || 'other';
  const catColor = getCategoryColor(cat);
  const catIcon  = getCategoryIcon(cat);

  const item = document.createElement('div');
  item.className = 'activity-item';

  item.innerHTML = `
    <div class="activity-item-icon" style="background: ${catColor}22; color: ${catColor};">
      <i data-lucide="${catIcon}"></i>
    </div>
    <div class="activity-item-content">
      <div class="activity-item-title">
        <strong>${escapeHtml(session.app_name || 'Unknown')}</strong> &middot; ${escapeHtml(APP_CATEGORIES[cat]?.label || cat)}
      </div>
      <div class="activity-item-meta">
        ${session.duration_minutes ? `<span>${formatMinutes(session.duration_minutes)}</span>` : ''}
        ${session.start_time ? `<span>${timeAgo(session.start_time)}</span>` : ''}
      </div>
    </div>
  `;

  return item;
}

/** Render the category doughnut chart */
function _renderCategoryChart(todayUsage, comparisonData) {
  const canvas = document.getElementById('category-chart');
  if (!canvas) return;

  // Aggregate categories from today's usage
  const catMap = {};
  const sessions = todayUsage?.sessions || [];

  sessions.forEach(s => {
    const cat = s.app_category || 'other';
    catMap[cat] = (catMap[cat] || 0) + (s.duration_minutes || 0);
  });

  // Also try by_hour if sessions are empty but by_hour is present
  if (Object.keys(catMap).length === 0 && todayUsage?.by_hour) {
    catMap['other'] = todayUsage.total_minutes || 0;
  }

  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    // Show empty placeholder
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 320;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('No category data yet', 160, 160);
    return;
  }

  const labels = entries.map(([cat]) => APP_CATEGORIES[cat]?.label || cat);
  const data   = entries.map(([, min]) => min);
  const colors = entries.map(([cat]) => getCategoryColor(cat));

  try {
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: 'rgba(10, 14, 26, 0.8)',
          borderWidth: 3,
          hoverBorderColor: 'rgba(255,255,255,0.2)',
          hoverBorderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 12, family: 'Inter, sans-serif' }
            }
          },
          tooltip: {
            backgroundColor: CHART_COLORS.tooltipBg,
            titleColor: CHART_COLORS.tooltipColor,
            bodyColor: CHART_COLORS.tooltipColor,
            borderColor: CHART_COLORS.tooltipBorder,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatMinutes(ctx.raw)}`
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Chart creation error:', err);
  }

  // Custom legend below chart
  const legendContainer = document.getElementById('category-legend');
  if (legendContainer) {
    const total = data.reduce((a, b) => a + b, 0);
    legendContainer.innerHTML = entries.map(([cat, min]) => {
      const pct = total > 0 ? Math.round((min / total) * 100) : 0;
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:4px 0;">
          <span style="width:10px;height:10px;border-radius:50%;background:${getCategoryColor(cat)};flex-shrink:0;"></span>
          <span style="flex:1;font-size:var(--font-sm);color:var(--text-secondary);">${escapeHtml(APP_CATEGORIES[cat]?.label || cat)}</span>
          <span style="font-size:var(--font-sm);color:var(--text-muted);font-weight:var(--weight-medium);">${formatMinutes(min)}</span>
          <span style="font-size:var(--font-xs);color:var(--text-muted);min-width:32px;text-align:right;">${pct}%</span>
        </div>
      `;
    }).join('');
  }
}
