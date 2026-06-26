/* ============================================================
   SENTINEL — Analytics Page
   ============================================================ */

import { renderSidebar, createSidebarOverlay, toggleSidebar } from '../components/sidebar.js';
import { renderNavbar, updateBreadcrumb } from '../components/navbar.js';
import { api } from '../services/api.js';
import { getUser } from '../services/auth.js';
import {
  formatMinutes, getCategoryColor, escapeHtml, getPercentage
} from '../utils/helpers.js';
import { CHART_COLORS, APP_CATEGORIES, DAYS_SHORT } from '../utils/constants.js';

/**
 * Render the analytics page with child selector, time range toggle,
 * usage trend, category breakdown, day-of-week heatmap, and weekly summary.
 */
export async function renderAnalyticsPage(container) {
  const user = await getUser();
  if (!user) return;

  // ── Layout ─────────────────────────────────────────────────
  container.innerHTML = '<div class="app-layout"><div class="main-content" id="main-content"></div></div>';
  const layout = container.querySelector('.app-layout');
  const main   = container.querySelector('#main-content');

  renderSidebar(layout, '/analytics');
  createSidebarOverlay(layout);
  const navbar = renderNavbar(main, { onHamburgerClick: toggleSidebar });
  updateBreadcrumb(navbar, 'Analytics');

  const inner = document.createElement('div');
  inner.className = 'main-content-inner page-enter';
  main.appendChild(inner);

  // ── Skeleton ───────────────────────────────────────────────
  inner.innerHTML = `
    <div class="page-header">
      <h1 class="page-greeting">Analytics</h1>
      <p class="page-greeting-date">Deep dive into screen time patterns</p>
    </div>

    <!-- Filters -->
    <div class="analytics-filters" id="analytics-filters">
      <select class="select" id="child-select">
        <option value="">Loading children...</option>
      </select>
      <div style="display:flex;gap:var(--space-2);">
        <button class="btn btn-sm btn-primary" data-range="7" id="range-7">7 Days</button>
        <button class="btn btn-sm btn-secondary" data-range="30" id="range-30">30 Days</button>
      </div>
    </div>

    <!-- Charts area (skeleton) -->
    <div id="analytics-content">
      <div class="dashboard-grid">
        <div class="glass-card skeleton" style="height:340px;"></div>
        <div class="glass-card skeleton" style="height:340px;"></div>
      </div>
      <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);margin-bottom:var(--space-8);"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>
    </div>
  `;

  // ── Fetch children list ────────────────────────────────────
  let children = [];
  try {
    const res = await api.get('/api/settings/children');
    if (res?.children && Array.isArray(res.children)) children = res.children;
    else if (Array.isArray(res)) children = res;
  } catch (err) {
    console.error('Failed to fetch children:', err);
  }

  // Populate child selector
  const childSelect = inner.querySelector('#child-select');
  if (children.length === 0) {
    childSelect.innerHTML = '<option value="">No children linked</option>';
    // Show empty state instead of skeleton
    const contentArea = inner.querySelector('#analytics-content');
    contentArea.innerHTML = `
      <div class="glass-card p-8" style="text-align:center;padding:var(--space-12);">
        <i data-lucide="user-plus" style="width:48px;height:48px;color:var(--text-muted);opacity:0.4;margin:0 auto var(--space-4);display:block;"></i>
        <p style="font-size:var(--font-md);color:var(--text-primary);margin:0 0 var(--space-2);">No children linked yet</p>
        <p style="font-size:var(--font-sm);color:var(--text-muted);margin:0 0 var(--space-4);">Link a child account in Settings to see analytics.</p>
        <button class="btn btn-primary" onclick="window.router?.navigate('/settings')">
          <i data-lucide="settings" style="width:16px;height:16px;"></i>
          Go to Settings
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ nodes: [contentArea] });
  } else {
    childSelect.innerHTML = children.map(c =>
      `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ).join('');
  }

  // ── State ──────────────────────────────────────────────────
  let currentChildId = children[0]?.id || null;
  let currentRange   = 7;
  let trendChart     = null;
  let catChart       = null;

  // ── Range toggle ───────────────────────────────────────────
  const btn7  = inner.querySelector('#range-7');
  const btn30 = inner.querySelector('#range-30');

  function setRange(range) {
    currentRange = range;
    btn7.className  = `btn btn-sm ${range === 7 ? 'btn-primary' : 'btn-secondary'}`;
    btn30.className = `btn btn-sm ${range === 30 ? 'btn-primary' : 'btn-secondary'}`;
    loadAnalytics();
  }

  btn7.addEventListener('click', () => setRange(7));
  btn30.addEventListener('click', () => setRange(30));

  childSelect.addEventListener('change', () => {
    currentChildId = childSelect.value;
    loadAnalytics();
  });

  // ── Data loading + rendering ───────────────────────────────
  async function loadAnalytics() {
    if (!currentChildId) return;

    const contentArea = inner.querySelector('#analytics-content');
    contentArea.innerHTML = `
      <div class="dashboard-grid">
        <div class="glass-card skeleton" style="height:340px;"></div>
        <div class="glass-card skeleton" style="height:340px;"></div>
      </div>
      <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);margin-bottom:var(--space-8);"></div>
      <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>
    `;

    let weekly, categories;
    try {
      const [wRes, cRes] = await Promise.all([
        api.get(`/api/analytics/weekly/${currentChildId}`),
        api.get(`/api/analytics/categories/${currentChildId}?days=${currentRange}`)
      ]);
      weekly     = wRes.error ? {} : wRes;
      categories = cRes.error ? {} : cRes;
    } catch (err) {
      console.error('Analytics fetch error:', err);
      weekly = {}; categories = {};
    }

    // Destroy old charts
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    if (catChart) { catChart.destroy(); catChart = null; }

    const dailyTotals = weekly.daily_totals || [];
    const cats = categories.categories || [];
    const totalMin = weekly.total_minutes || categories.total_minutes || 0;
    const avgDaily = weekly.avg_daily || 0;
    const busiestDay = weekly.busiest_day || 'N/A';

    contentArea.innerHTML = `
      <!-- Charts row -->
      <div class="dashboard-grid" style="margin-bottom: var(--space-8);">
        <!-- Usage trend -->
        <div class="glass-card chart-container animate-slide-up">
          <div class="chart-container-header">
            <h3 class="chart-container-title">Usage Trend</h3>
          </div>
          <div class="chart-wrapper" style="height:280px;">
            <canvas id="analytics-trend-chart"></canvas>
          </div>
        </div>

        <!-- Category breakdown -->
        <div class="glass-card chart-container animate-slide-up" style="animation-delay:0.1s;">
          <div class="chart-container-header">
            <h3 class="chart-container-title">Category Breakdown</h3>
          </div>
          <div class="chart-wrapper" style="max-width:260px;margin:0 auto;">
            <canvas id="analytics-cat-chart" width="260" height="260"></canvas>
          </div>
          <div id="cat-legend" style="margin-top: var(--space-4);"></div>
        </div>
      </div>

      <!-- Day-of-week heatmap -->
      <div class="glass-card p-6 animate-slide-up" style="animation-delay:0.2s; margin-bottom: var(--space-8);">
        <div class="section-header" style="margin-bottom: var(--space-5);">
          <h3 class="section-title">Day-of-Week Summary</h3>
        </div>
        <div class="heatmap-grid" id="heatmap-grid"></div>
      </div>

      <!-- Weekly summary -->
      <div class="glass-card weekly-summary animate-slide-up" style="animation-delay:0.3s;">
        <div class="weekly-summary-header">
          <h3>Weekly Report</h3>
          <p>Overview for the selected period</p>
        </div>
        <div class="weekly-summary-body">
          <div class="weekly-summary-metrics">
            <div class="weekly-metric">
              <div class="weekly-metric-value stat-value-cyan">${formatMinutes(totalMin)}</div>
              <div class="weekly-metric-label">Total Time</div>
            </div>
            <div class="weekly-metric">
              <div class="weekly-metric-value stat-value-purple">${formatMinutes(Math.round(avgDaily))}</div>
              <div class="weekly-metric-label">Daily Average</div>
            </div>
            <div class="weekly-metric">
              <div class="weekly-metric-value stat-value-amber">${escapeHtml(busiestDay)}</div>
              <div class="weekly-metric-label">Busiest Day</div>
            </div>
          </div>

          <!-- Category bars -->
          <div id="summary-categories"></div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ nodes: [contentArea] });

    // ── Trend line chart ─────────────────────────────────────
    const trendCanvas = document.getElementById('analytics-trend-chart');
    if (trendCanvas && dailyTotals.length > 0) {
      const labels = dailyTotals.map(d => d.day_name || d.date || '');
      const data   = dailyTotals.map(d => d.total_minutes || 0);

      try {
        trendChart = new Chart(trendCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Screen Time',
              data,
              borderColor: '#06b6d4',
              backgroundColor: _createGradient(trendCanvas, '#06b6d4'),
              borderWidth: 2.5,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#06b6d4',
              pointBorderColor: '#0a0e1a',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6
            }]
          },
          options: _lineChartOptions()
        });
      } catch (err) {
        console.error('Trend chart error:', err);
      }
    }

    // ── Category doughnut ────────────────────────────────────
    const catCanvas = document.getElementById('analytics-cat-chart');
    if (catCanvas && cats.length > 0) {
      const labels = cats.map(c => APP_CATEGORIES[c.category]?.label || c.category);
      const data   = cats.map(c => c.total_minutes || 0);
      const colors = cats.map(c => getCategoryColor(c.category));

      try {
        catChart = new Chart(catCanvas, {
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
                  label: (ctx) => ` ${ctx.label}: ${formatMinutes(ctx.raw)}`
                }
              }
            }
          }
        });
      } catch (err) {
        console.error('Cat chart error:', err);
      }

      // Custom legend
      const legend = document.getElementById('cat-legend');
      if (legend) {
        const total = data.reduce((a, b) => a + b, 0);
        legend.innerHTML = cats.map(c => {
          const pct = getPercentage(c.total_minutes, total);
          return `
            <div style="display:flex;align-items:center;gap:var(--space-3);padding:3px 0;">
              <span style="width:8px;height:8px;border-radius:50%;background:${getCategoryColor(c.category)};flex-shrink:0;"></span>
              <span style="flex:1;font-size:var(--font-sm);color:var(--text-secondary);">${escapeHtml(APP_CATEGORIES[c.category]?.label || c.category)}</span>
              <span style="font-size:var(--font-xs);color:var(--text-muted);">${formatMinutes(c.total_minutes)}</span>
              <span style="font-size:var(--font-xs);color:var(--text-muted);min-width:28px;text-align:right;">${pct}%</span>
            </div>
          `;
        }).join('');
      }
    }

    // ── Day-of-week heatmap ──────────────────────────────────
    const heatmapGrid = document.getElementById('heatmap-grid');
    if (heatmapGrid) {
      // Build per-day averages
      const dayMap = {};
      dailyTotals.forEach(d => {
        const dayName = d.day_name || '';
        dayMap[dayName] = d.total_minutes || 0;
      });

      const maxVal = Math.max(...Object.values(dayMap), 1);

      heatmapGrid.innerHTML = DAYS_SHORT.map(day => {
        const val     = dayMap[day] || 0;
        const intensity = Math.max(0.08, val / maxVal);
        const color   = `rgba(6, 182, 212, ${intensity})`;
        const textClr = intensity > 0.5 ? '#fff' : 'var(--text-tertiary)';

        return `
          <div class="heatmap-cell" style="background:${color};">
            <span class="heatmap-day" style="color:${textClr};">${day}</span>
            <span class="heatmap-value" style="color:${textClr};">${formatMinutes(val)}</span>
          </div>
        `;
      }).join('');
    }

    // ── Summary categories ───────────────────────────────────
    const summCats = document.getElementById('summary-categories');
    if (summCats && cats.length > 0) {
      summCats.innerHTML = cats.slice(0, 5).map(c => {
        const pct   = c.percentage || 0;
        const color = getCategoryColor(c.category);
        return `
          <div style="margin-bottom: var(--space-3);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:var(--font-sm);color:var(--text-secondary);">${escapeHtml(APP_CATEGORIES[c.category]?.label || c.category)}</span>
              <span style="font-size:var(--font-sm);color:var(--text-muted);">${formatMinutes(c.total_minutes)} (${Math.round(pct)}%)</span>
            </div>
            <div class="progress-bar progress-bar-sm">
              <div class="progress-bar-fill" style="width:${pct}%;background:${color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Initial load
  if (currentChildId) loadAnalytics();
}


// ═══════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════

function _createGradient(canvas, color) {
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
  gradient.addColorStop(0, color + '33');
  gradient.addColorStop(1, color + '05');
  return gradient;
}

function _lineChartOptions() {
  return {
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
  };
}
