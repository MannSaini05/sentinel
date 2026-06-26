/* ============================================================
   SENTINEL — Child Card Component
   ============================================================ */

import { formatMinutes, getInitials, getPercentage, getCategoryColor, getCategoryIcon, escapeHtml } from '../utils/helpers.js';
import { APP_CATEGORIES } from '../utils/constants.js';
import router from '../utils/router.js';

/**
 * Get the ring colour based on limit percentage.
 * Green (<60%), Amber (60-90%), Red (>90%)
 */
function _getRingColor(percentage) {
  if (percentage >= 90) return '#ef4444';
  if (percentage >= 60) return '#f59e0b';
  return '#10b981';
}

/**
 * Render a child summary card.
 *
 * @param {HTMLElement} container – Target DOM element to render into
 * @param {Object} child
 * @param {string}  child.id
 * @param {string}  child.name
 * @param {string}  child.avatar_color
 * @param {Object}  child.today          – { total_minutes, session_count, limit_minutes, limit_percentage, top_category }
 * @param {Object}  child.weekly         – { avg_daily, total_minutes }
 */
export function renderChildCard(container, child) {
  const {
    id,
    name,
    avatar_color = '#06b6d4',
    today = {},
    weekly = {},
  } = child;

  const totalMinutes  = today.total_minutes  ?? 0;
  const limitMinutes  = today.limit_minutes  ?? 120;
  const percentage    = today.limit_percentage ?? getPercentage(totalMinutes, limitMinutes);
  const topCategory   = today.top_category   || null;
  const avgDaily      = weekly.avg_daily     ?? 0;

  const initials   = getInitials(name);
  const ringColor  = _getRingColor(percentage);
  const usageText  = formatMinutes(totalMinutes);
  const limitText  = formatMinutes(limitMinutes);

  /* ---- SVG Ring Calculations ---- */
  const svgSize    = 120;
  const strokeW    = 8;
  const radius     = (svgSize - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress   = Math.min(percentage, 100) / 100;
  const dashOffset = circumference * (1 - progress);

  /* ---- Category chip ---- */
  let categoryChip = '';
  if (topCategory) {
    const catMeta  = APP_CATEGORIES[topCategory] || APP_CATEGORIES.other;
    const catColor = getCategoryColor(topCategory);
    const catIcon  = getCategoryIcon(topCategory);
    categoryChip = `
      <span class="chip" style="border-color:${catColor}20;">
        <i data-lucide="${catIcon}" style="width:12px;height:12px;color:${catColor};"></i>
        <span style="color:${catColor};">${escapeHtml(catMeta.label)}</span>
      </span>
    `;
  }

  /* ---- Card markup ---- */
  const card = document.createElement('div');
  card.className = 'glass-card glass-card-hover child-card';
  card.style.cssText = 'cursor:pointer; padding:24px; display:flex; flex-direction:column; align-items:center; gap:16px;';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View ${escapeHtml(name)}'s details`);

  card.innerHTML = `
    <!-- Header: Avatar + Name -->
    <div style="display:flex; align-items:center; gap:12px; width:100%;">
      <div class="avatar avatar-md" style="background:${avatar_color}; font-size:var(--font-sm);">
        ${escapeHtml(initials)}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="
          font-weight:var(--weight-semibold, 600);
          color:var(--text-primary, #e2e8f0);
          font-size:var(--font-md, 16px);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        ">${escapeHtml(name)}</div>
        <div class="live-indicator" style="margin-top:2px;">
          <span class="live-dot"></span>
          Active
        </div>
      </div>
    </div>

    <!-- Usage Ring -->
    <div style="position:relative; width:${svgSize}px; height:${svgSize}px;">
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="transform:rotate(-90deg);">
        <!-- Background track -->
        <circle
          cx="${svgSize / 2}" cy="${svgSize / 2}" r="${radius}"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          stroke-width="${strokeW}"
        />
        <!-- Progress arc -->
        <circle
          class="child-card-ring"
          cx="${svgSize / 2}" cy="${svgSize / 2}" r="${radius}"
          fill="none"
          stroke="${ringColor}"
          stroke-width="${strokeW}"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          style="transition: stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1);"
        />
      </svg>
      <!-- Center text overlay -->
      <div style="
        position:absolute; inset:0;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
      ">
        <span style="
          font-size:var(--font-xl, 20px);
          font-weight:var(--weight-bold, 700);
          color:var(--text-primary, #e2e8f0);
          line-height:1;
        ">${usageText}</span>
        <span style="
          font-size:var(--font-xs, 12px);
          color:var(--text-muted, #64748b);
          margin-top:4px;
        ">of ${limitText} limit</span>
      </div>
    </div>

    <!-- Bottom stats -->
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      width:100%; gap:12px; flex-wrap:wrap;
    ">
      ${categoryChip || '<span></span>'}
      <span style="
        font-size:var(--font-xs, 12px);
        color:var(--text-muted, #64748b);
        display:flex; align-items:center; gap:4px;
      ">
        <i data-lucide="calendar" style="width:12px;height:12px;opacity:0.6;"></i>
        Avg ${formatMinutes(avgDaily)}/day
      </span>
    </div>
  `;

  container.appendChild(card);

  /* ---- Animate ring on mount ---- */
  requestAnimationFrame(() => {
    const ring = card.querySelector('.child-card-ring');
    if (ring) {
      ring.setAttribute('stroke-dashoffset', String(dashOffset));
    }
  });

  /* ---- Navigation ---- */
  const navigate = () => router.navigate(`/child/${id}`);
  card.addEventListener('click', navigate);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate();
    }
  });

  /* ---- Lucide icons ---- */
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [card] });
  }

  return card;
}
