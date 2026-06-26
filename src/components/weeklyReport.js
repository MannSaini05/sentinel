/* ============================================================
   SENTINEL — Weekly Report Component
   ============================================================ */

import { formatMinutes, getCategoryColor, getCategoryIcon, escapeHtml } from '../utils/helpers.js';
import { APP_CATEGORIES } from '../utils/constants.js';

/**
 * Render the weekly summary card.
 *
 * @param {HTMLElement} container – Target DOM element
 * @param {Object} data
 * @param {number}  data.avg_daily           – Average daily screen time in minutes
 * @param {number}  data.total_minutes       – Total screen time this week
 * @param {Object}  data.busiest_day         – { day_name, total_minutes }
 * @param {number}  data.trend               – Percentage change from last week (positive = up)
 * @param {Array}   data.category_breakdown  – [{ category, percentage }]
 */
export function renderWeeklyReport(container, data) {
  const {
    avg_daily          = 0,
    total_minutes      = 0,
    busiest_day        = { day_name: '—', total_minutes: 0 },
    trend              = 0,
    category_breakdown = [],
  } = data || {};

  const trendUp     = trend > 0;
  const trendDown   = trend < 0;
  const trendIcon   = trendUp ? 'trending-up' : trendDown ? 'trending-down' : 'minus';
  const trendColor  = trendUp ? '#ef4444' : trendDown ? '#10b981' : 'var(--text-muted, #64748b)';
  const trendLabel  = trendUp
    ? `${Math.abs(trend)}% more than last week`
    : trendDown
      ? `${Math.abs(trend)}% less than last week`
      : 'Same as last week';

  // Top 3 categories
  const topCategories = category_breakdown.slice(0, 3);

  const card = document.createElement('div');
  card.className = 'glass-card weekly-report';
  card.style.cssText = 'overflow:hidden;';

  card.innerHTML = `
    <!-- Gradient accent bar -->
    <div style="
      height:4px;
      background:linear-gradient(90deg, #06b6d4, #8b5cf6);
      border-radius:var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
    "></div>

    <!-- Content body -->
    <div style="padding:24px;">
      <!-- Title row -->
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:24px;">
        <div style="
          display:flex; align-items:center; justify-content:center;
          width:36px; height:36px; border-radius:var(--radius-md, 10px);
          background:rgba(139,92,246,0.12);
        ">
          <i data-lucide="calendar" style="width:18px;height:18px;color:#8b5cf6;"></i>
        </div>
        <span style="
          font-size:var(--font-lg, 18px);
          font-weight:var(--weight-semibold, 600);
          color:var(--text-primary, #e2e8f0);
        ">Weekly Summary</span>
      </div>

      <!-- Metric grid: 3 columns -->
      <div style="
        display:grid;
        grid-template-columns:repeat(3, 1fr);
        gap:16px;
        margin-bottom:20px;
      ">
        ${_metricCell('Average Daily', formatMinutes(avg_daily), 'clock', '#06b6d4')}
        ${_metricCell('Total Week', formatMinutes(total_minutes), 'bar-chart-3', '#8b5cf6')}
        ${_metricCell('Busiest Day', escapeHtml(busiest_day.day_name), 'flame', '#f59e0b',
                      formatMinutes(busiest_day.total_minutes))}
      </div>

      <!-- Trend line -->
      <div style="
        display:flex; align-items:center; gap:8px;
        padding:12px 16px;
        background:rgba(255,255,255,0.03);
        border-radius:var(--radius-md, 10px);
        margin-bottom:20px;
      ">
        <i data-lucide="${trendIcon}" style="width:18px;height:18px;color:${trendColor};"></i>
        <span style="
          font-size:var(--font-sm, 14px);
          color:${trendColor};
          font-weight:var(--weight-medium, 500);
        ">${trendLabel}</span>
      </div>

      <!-- Top categories -->
      ${topCategories.length > 0 ? `
        <div>
          <span style="
            font-size:var(--font-xs, 12px);
            text-transform:uppercase;
            letter-spacing:0.05em;
            color:var(--text-muted, #64748b);
            font-weight:var(--weight-medium, 500);
            display:block;
            margin-bottom:10px;
          ">Top Categories</span>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${topCategories.map(cat => {
              const catKey   = cat.category || 'other';
              const catMeta  = APP_CATEGORIES[catKey] || APP_CATEGORIES.other;
              const catColor = getCategoryColor(catKey);
              const catIcon  = getCategoryIcon(catKey);
              return `
                <span class="chip" style="
                  border:1px solid ${catColor}30;
                  background:${catColor}15;
                  gap:6px; padding:5px 12px;
                ">
                  <i data-lucide="${catIcon}" style="width:12px;height:12px;color:${catColor};"></i>
                  <span style="color:${catColor}; font-weight:500;">${escapeHtml(catMeta.label)}</span>
                  <span style="
                    color:var(--text-muted, #64748b);
                    font-size:11px;
                    margin-left:2px;
                  ">${cat.percentage}%</span>
                </span>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  container.appendChild(card);

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [card] });
  }

  return card;
}

/* ---- Private helpers ---- */

/**
 * Render a single metric cell for the 3-column grid.
 */
function _metricCell(label, value, icon, color, subtitle = '') {
  return `
    <div style="
      display:flex; flex-direction:column; align-items:center;
      padding:14px 8px;
      background:rgba(255,255,255,0.03);
      border-radius:var(--radius-md, 10px);
      text-align:center;
    ">
      <i data-lucide="${icon}" style="
        width:16px; height:16px; color:${color};
        margin-bottom:8px; opacity:0.8;
      "></i>
      <span style="
        font-size:var(--font-lg, 18px);
        font-weight:var(--weight-bold, 700);
        color:var(--text-primary, #e2e8f0);
        line-height:1;
      ">${value}</span>
      ${subtitle ? `
        <span style="
          font-size:var(--font-xs, 12px);
          color:var(--text-muted, #64748b);
          margin-top:2px;
        ">${subtitle}</span>
      ` : ''}
      <span style="
        font-size:var(--font-xs, 12px);
        color:var(--text-muted, #64748b);
        margin-top:6px;
        text-transform:uppercase;
        letter-spacing:0.03em;
      ">${label}</span>
    </div>
  `;
}
