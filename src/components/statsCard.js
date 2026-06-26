/* ============================================================
   SENTINEL — Stats Card Component
   ============================================================ */

import { animateValue } from '../utils/helpers.js';

/**
 * Render a stat card
 * @param {HTMLElement} container - Target container
 * @param {Object} options
 * @param {string} options.title - Card label
 * @param {string|number} options.value - Display value
 * @param {string} options.icon - Lucide icon name
 * @param {string} options.trend - 'up' | 'down' | 'neutral'
 * @param {string} options.trendValue - e.g., "12%"
 * @param {string} options.color - 'cyan' | 'green' | 'amber' | 'purple'
 * @param {boolean} options.animate - Whether to animate the value
 * @param {number} options.numericValue - Numeric value for animation
 */
export function renderStatsCard(container, {
  title,
  value,
  icon = 'activity',
  trend = 'neutral',
  trendValue = '',
  color = 'cyan',
  animate = true,
  numericValue = null
} = {}) {
  const card = document.createElement('div');
  card.className = `glass-card stat-card stat-card-${color}`;

  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus';
  const trendClass = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-neutral';
  const trendLabel = trend === 'up' ? 'vs last week' : trend === 'down' ? 'vs last week' : '';

  card.innerHTML = `
    <div class="stat-card-header">
      <div class="stat-card-icon stat-card-icon-${color}">
        <i data-lucide="${icon}"></i>
      </div>
      <span class="stat-card-label">${title}</span>
    </div>
    <div class="stat-card-value" data-value="${numericValue ?? ''}">${value}</div>
    ${trendValue ? `
      <div class="stat-card-footer">
        <span class="trend-indicator ${trendClass}">
          <i data-lucide="${trendIcon}"></i>
          ${trendValue}
        </span>
        ${trendLabel ? `<span class="trend-label">${trendLabel}</span>` : ''}
      </div>
    ` : ''}
  `;

  container.appendChild(card);

  // Animate the numeric value counting up
  if (animate && numericValue != null && !isNaN(numericValue)) {
    const valueEl = card.querySelector('.stat-card-value');
    const displayText = value;
    // Extract suffix (like "h 30m", "%", etc)
    const numStr = String(numericValue);
    const suffix = displayText.replace(/[\d.]+/, '').trim();

    if (valueEl && typeof numericValue === 'number') {
      valueEl.textContent = '0';
      requestAnimationFrame(() => {
        animateValue(valueEl, 0, numericValue, 1000);
        // Restore full text after animation
        setTimeout(() => {
          valueEl.textContent = displayText;
        }, 1050);
      });
    }
  }

  // Init icons
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [card] });
  }

  return card;
}

/**
 * Render a grid of stat cards
 */
export function renderStatsGrid(container, stats) {
  const grid = document.createElement('div');
  grid.className = 'stats-grid';

  stats.forEach((stat, i) => {
    const wrapper = document.createElement('div');
    wrapper.style.animationDelay = `${i * 0.1}s`;
    wrapper.className = 'animate-slide-up';
    renderStatsCard(wrapper, stat);
    grid.appendChild(wrapper.firstElementChild || wrapper);
  });

  container.appendChild(grid);
  return grid;
}
