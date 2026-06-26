/* ============================================================
   SENTINEL — Child Profile Page
   ============================================================ */

import { renderSidebar, createSidebarOverlay, toggleSidebar } from '../components/sidebar.js';
import { renderNavbar, updateBreadcrumb } from '../components/navbar.js';
import { renderStatsGrid } from '../components/statsCard.js';
import { api } from '../services/api.js';
import { getUser } from '../services/auth.js';
import {
  formatMinutes, getInitials, getCategoryColor, getCategoryIcon,
  escapeHtml, getPercentage, getTodayISO
} from '../utils/helpers.js';
import { CHART_COLORS, APP_CATEGORIES } from '../utils/constants.js';
import router from '../utils/router.js';

/**
 * Render the child profile page with detailed analytics,
 * trend charts, top apps, and limit display.
 */
export async function renderChildProfilePage(container, params) {
  const childId = params?.id;
  if (!childId) { router.navigate('/dashboard'); return; }

  const user = await getUser();
  if (!user) return;

  // ── Layout ─────────────────────────────────────────────────
  container.innerHTML = '<div class="app-layout"><div class="main-content" id="main-content"></div></div>';
  const layout = container.querySelector('.app-layout');
  const main   = container.querySelector('#main-content');

  renderSidebar(layout, '');
  createSidebarOverlay(layout);
  const navbar = renderNavbar(main, { onHamburgerClick: toggleSidebar });

  const inner = document.createElement('div');
  inner.className = 'main-content-inner page-enter';
  main.appendChild(inner);

  // ── Skeleton ───────────────────────────────────────────────
  inner.innerHTML = `
    <div class="glass-card profile-header" id="profile-header">
      <div class="skeleton skeleton-circle" style="width:72px;height:72px;"></div>
      <div style="flex:1;">
        <div class="skeleton skeleton-heading" style="width:200px;"></div>
        <div class="skeleton skeleton-text" style="width:160px;"></div>
      </div>
    </div>
    <div class="stats-grid" id="stats-grid">
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card"></div>
    </div>
    <div class="dashboard-grid">
      <div class="glass-card skeleton" style="height:340px;"></div>
      <div class="glass-card skeleton" style="height:340px;"></div>
    </div>
  `;

  // ── Fetch data ─────────────────────────────────────────────
  let daily, weekly, categories, sessions, limits;

  try {
    const today = getTodayISO();
    const [dRes, wRes, cRes, sRes, lRes] = await Promise.all([
      api.get(`/api/analytics/daily/${childId}`),
      api.get(`/api/analytics/weekly/${childId}`),
      api.get(`/api/analytics/categories/${childId}?days=7`),
      api.get(`/api/usage/sessions/${childId}?date=${today}`),
      api.get(`/api/settings/limits/${childId}`)
    ]);

    daily      = dRes.error ? {} : dRes;
    weekly     = wRes.error ? {} : wRes;
    categories = cRes.error ? {} : cRes;
    sessions   = sRes.error ? {} : sRes;
    limits     = lRes.error ? [] : (Array.isArray(lRes) ? lRes : []);
  } catch (err) {
    console.error('Child profile fetch error:', err);
    daily = {}; weekly = {}; categories = {}; sessions = {}; limits = [];
  }

  // ── Derive child info ──────────────────────────────────────
  const childName  = daily.child_name || weekly.child_name || `Child #${childId}`;
  const avatarColor = daily.avatar_color || '#06b6d4';
  const initials   = getInitials(childName);

  updateBreadcrumb(navbar, childName);

  // ── Render page ────────────────────────────────────────────
  const todayMin   = daily.total_minutes || 0;
  const sessionCt  = daily.session_count || 0;
  const topApp     = daily.top_app?.name || 'N/A';
  const topAppMin  = daily.top_app?.minutes || 0;
  const limitMin   = limits[0]?.daily_limit_minutes || 120;
  const limitPct   = getPercentage(todayMin, limitMin);
  const comparison = daily.comparison || {};
  const diffDir    = comparison.direction || 'neutral';
  const pctChange  = comparison.percent_change || 0;

  // Status color for limit
  let limitStatus = 'success';
  let limitLabel  = 'Within Limit';
  if (limitPct > 100)     { limitStatus = 'danger';  limitLabel = 'Exceeded'; }
  else if (limitPct > 80) { limitStatus = 'warning'; limitLabel = 'Approaching'; }

  inner.innerHTML = `
    <!-- Profile Header -->
    <div class="glass-card profile-header animate-slide-up">
      <div class="avatar avatar-xl" style="background: ${avatarColor}; box-shadow: 0 0 24px ${avatarColor}44;">
        ${initials}
      </div>
      <div>
        <h1 class="profile-name">${escapeHtml(childName)}</h1>
        <div class="profile-meta">
          <span class="badge badge-${limitStatus}">
            <i data-lucide="${limitStatus === 'danger' ? 'alert-triangle' : limitStatus === 'warning' ? 'alert-circle' : 'check-circle'}" style="width:12px;height:12px;"></i>
            ${limitLabel}
          </span>
          <span style="display:flex;align-items:center;gap:4px;">
            <i data-lucide="monitor" style="width:14px;height:14px;opacity:0.5;"></i>
            ${limits.length} device rule${limits.length !== 1 ? 's' : ''}
          </span>
          <span style="display:flex;align-items:center;gap:4px;">
            <i data-lucide="calendar" style="width:14px;height:14px;opacity:0.5;"></i>
            ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div id="stats-anchor"></div>

    <!-- Charts Section -->
    <div class="dashboard-grid" style="animation: slideUp 0.5s ease-out 0.3s both;">
      <!-- 7-day trend -->
      <div class="glass-card chart-container">
        <div class="chart-container-header">
          <h3 class="chart-container-title">7-Day Trend</h3>
          <span class="badge badge-primary">${weekly.trend || 'stable'}</span>
        </div>
        <div class="chart-wrapper" style="height:260px;">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>

      <!-- Category breakdown -->
      <div class="glass-card chart-container">
        <div class="chart-container-header">
          <h3 class="chart-container-title">Categories (7 days)</h3>
        </div>
        <div class="chart-wrapper" style="max-width:280px;margin:0 auto;">
          <canvas id="cat-chart" width="280" height="280"></canvas>
        </div>
      </div>
    </div>

    <!-- Top Apps -->
    <div class="glass-card p-6 animate-slide-up" style="animation-delay:0.4s; margin-bottom: var(--space-8);">
      <div class="section-header" style="margin-bottom: var(--space-5);">
        <h3 class="section-title">Top Apps Today</h3>
      </div>
      <div class="top-apps-list" id="top-apps-list"></div>
    </div>

    <!-- Screen Time Limit -->
    <div class="glass-card p-6 animate-slide-up" style="animation-delay:0.5s;">
      <div class="section-header" style="margin-bottom: var(--space-4);">
        <h3 class="section-title">Screen Time Limit</h3>
        <button class="btn btn-sm btn-secondary" onclick="window.router.navigate('/settings')">
          <i data-lucide="settings" style="width:14px;height:14px;"></i>
          Manage
        </button>
      </div>
      <div class="limit-control">
        <div class="limit-control-header">
          <span class="limit-control-label">Daily limit</span>
          <span class="limit-control-value">${formatMinutes(limitMin)}</span>
        </div>
        <div class="progress-bar progress-bar-${limitStatus}">
          <div class="progress-bar-fill" style="width: ${Math.min(limitPct, 100)}%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:var(--font-xs);color:var(--text-muted);">
          <span>${formatMinutes(todayMin)} used</span>
          <span>${formatMinutes(Math.max(0, limitMin - todayMin))} remaining</span>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [inner] });

  // ── Stats grid ─────────────────────────────────────────────
  const statsAnchor = inner.querySelector('#stats-anchor');
  renderStatsGrid(statsAnchor.parentNode, [
    {
      title: "Today's Usage",
      value: formatMinutes(todayMin),
      icon: 'clock',
      color: 'cyan',
      numericValue: todayMin,
      trend: diffDir === 'up' ? 'up' : diffDir === 'down' ? 'down' : 'neutral',
      trendValue: pctChange ? `${pctChange}%` : ''
    },
    {
      title: 'Sessions',
      value: String(sessionCt),
      icon: 'activity',
      color: 'green',
      numericValue: sessionCt
    },
    {
      title: 'Top App',
      value: topApp,
      icon: 'star',
      color: 'amber',
      animate: false
    },
    {
      title: 'Limit Status',
      value: `${limitPct}%`,
      icon: 'gauge',
      color: 'purple',
      numericValue: limitPct,
      trend: limitPct > 90 ? 'up' : 'neutral',
      trendValue: limitPct > 90 ? 'Near limit' : ''
    }
  ]);
  // Insert the stats grid after the stats anchor (before charts)
  const statsGrid = statsAnchor.parentNode.querySelector('.stats-grid:last-of-type');
  if (statsGrid) statsAnchor.parentNode.insertBefore(statsGrid, statsAnchor.nextSibling);
  statsAnchor.remove();

  // ── 7-day Trend Chart ─────────────────────────────────────
  const trendCanvas = document.getElementById('trend-chart');
  if (trendCanvas) {
    const dailyTotals = weekly.daily_totals || [];
    const labels = dailyTotals.map(d => d.day_name || d.date || '');
    const data   = dailyTotals.map(d => d.total_minutes || 0);

    try {
      new Chart(trendCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Screen Time (min)',
            data,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#06b6d4',
            pointBorderColor: '#0a0e1a',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHoverBorderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          scales: {
            x: {
              grid: { color: CHART_COLORS.gridColor, drawBorder: false },
              ticks: { color: CHART_COLORS.tickColor, font: { size: 11 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: CHART_COLORS.gridColor, drawBorder: false },
              ticks: {
                color: CHART_COLORS.tickColor,
                font: { size: 11 },
                callback: (v) => formatMinutes(v)
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: CHART_COLORS.tooltipBg,
              titleColor: CHART_COLORS.tooltipColor,
              bodyColor: CHART_COLORS.tooltipColor,
              borderColor: CHART_COLORS.tooltipBorder,
              borderWidth: 1,
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                label: (ctx) => `  ${formatMinutes(ctx.raw)}`
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Trend chart error:', err);
    }
  }

  // ── Category Doughnut ──────────────────────────────────────
  const catCanvas = document.getElementById('cat-chart');
  if (catCanvas) {
    const cats = categories.categories || [];

    if (cats.length > 0) {
      const labels = cats.map(c => APP_CATEGORIES[c.category]?.label || c.category);
      const data   = cats.map(c => c.total_minutes || 0);
      const colors = cats.map(c => getCategoryColor(c.category));

      try {
        new Chart(catCanvas, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: colors,
              borderColor: 'rgba(10, 14, 26, 0.8)',
              borderWidth: 3,
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
                  padding: 14,
                  usePointStyle: true,
                  pointStyleWidth: 10,
                  font: { size: 11, family: 'Inter, sans-serif' }
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
        console.error('Category chart error:', err);
      }
    } else {
      const ctx = catCanvas.getContext('2d');
      ctx.font = '13px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', 140, 140);
    }
  }

  // ── Top Apps List ──────────────────────────────────────────
  const appsList = inner.querySelector('#top-apps-list');
  if (appsList) {
    const sessionList = sessions.sessions || [];

    // Aggregate by app
    const appMap = {};
    sessionList.forEach(s => {
      const name = s.app_name || 'Unknown';
      if (!appMap[name]) appMap[name] = { minutes: 0, category: s.app_category || 'other' };
      appMap[name].minutes += s.duration_minutes || 0;
    });

    const sorted = Object.entries(appMap)
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 8);

    if (sorted.length === 0) {
      appsList.innerHTML = `
        <div style="text-align:center;padding:var(--space-6);color:var(--text-muted);font-size:var(--font-sm);">
          No apps used today yet
        </div>
      `;
    } else {
      const maxMin = sorted[0][1].minutes || 1;

      appsList.innerHTML = sorted.map(([name, data], i) => {
        const pct   = Math.round((data.minutes / maxMin) * 100);
        const color = getCategoryColor(data.category);
        return `
          <div class="top-app-item animate-slide-up" style="animation-delay:${i * 0.05}s;">
            <span class="top-app-rank">${i + 1}</span>
            <div class="top-app-info">
              <div class="top-app-name">${escapeHtml(name)}</div>
              <div class="top-app-bar-container">
                <div class="top-app-bar">
                  <div class="top-app-bar-fill" style="width:${pct}%;background:${color};"></div>
                </div>
              </div>
            </div>
            <span class="top-app-time">${formatMinutes(data.minutes)}</span>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons({ nodes: [appsList] });
  }
}
