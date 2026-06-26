/* ============================================================
   SENTINEL — Activity Feed Component
   ============================================================ */

import { timeAgo, formatMinutes, getCategoryColor, getCategoryIcon, escapeHtml } from '../utils/helpers.js';
import { APP_CATEGORIES } from '../utils/constants.js';

/**
 * Build the HTML for a single activity item.
 *
 * @param {Object} activity
 * @param {string}  activity.app_name
 * @param {string}  activity.app_category
 * @param {number}  activity.duration_minutes
 * @param {string}  activity.start_time       – ISO string
 * @param {string}  activity.child_name
 * @param {string}  activity.child_id
 * @param {boolean} animated – Whether to add slideIn class
 * @returns {string} HTML string
 */
function _activityItemHTML(activity, animated = false) {
  const {
    app_name       = 'Unknown App',
    app_category   = 'other',
    duration_minutes = 0,
    start_time     = new Date().toISOString(),
    child_name     = '',
  } = activity;

  const catColor = getCategoryColor(app_category);
  const catIcon  = getCategoryIcon(app_category);
  const catMeta  = APP_CATEGORIES[app_category] || APP_CATEGORIES.other;
  const animClass = animated ? ' animate-slide-up' : '';

  return `
    <div class="activity-item${animClass}" style="
      display:flex; align-items:center; gap:12px;
      padding:12px 16px;
      border-bottom:1px solid rgba(255,255,255,0.04);
      transition:background 0.15s ease;
    ">
      <!-- Category icon -->
      <div style="
        width:36px; height:36px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:${catColor}20; flex-shrink:0;
      ">
        <i data-lucide="${catIcon}" style="width:16px;height:16px;color:${catColor};"></i>
      </div>

      <!-- Details -->
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="
            font-size:var(--font-sm, 14px);
            font-weight:var(--weight-medium, 500);
            color:var(--text-primary, #e2e8f0);
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          ">${escapeHtml(app_name)}</span>

          ${child_name ? `
            <span class="badge badge-neutral" style="font-size:10px; padding:2px 8px;">
              ${escapeHtml(child_name)}
            </span>
          ` : ''}
        </div>
        <div style="
          font-size:var(--font-xs, 12px);
          color:var(--text-muted, #64748b);
          margin-top:2px;
          display:flex; align-items:center; gap:6px;
        ">
          <span>${escapeHtml(catMeta.label)}</span>
        </div>
      </div>

      <!-- Right: duration + timestamp -->
      <div style="
        display:flex; flex-direction:column; align-items:flex-end;
        gap:2px; flex-shrink:0;
      ">
        <span style="
          font-size:var(--font-sm, 14px);
          font-weight:var(--weight-medium, 500);
          color:var(--text-secondary, #cbd5e1);
        ">${formatMinutes(duration_minutes)}</span>
        <span style="
          font-size:var(--font-xs, 12px);
          color:var(--text-muted, #64748b);
        ">${timeAgo(start_time)}</span>
      </div>
    </div>
  `;
}

/**
 * Render the live activity feed.
 *
 * @param {HTMLElement} container   – Target element
 * @param {Array}       activities – Array of activity objects
 */
export function renderActivityFeed(container, activities = []) {
  const wrapper = document.createElement('div');
  wrapper.className = 'glass-card activity-feed';
  wrapper.style.cssText = 'overflow:hidden;';

  const hasActivities = activities.length > 0;

  wrapper.innerHTML = `
    <!-- Header -->
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      padding:18px 20px 14px;
      border-bottom:1px solid rgba(255,255,255,0.06);
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <i data-lucide="activity" style="width:18px;height:18px;color:var(--color-primary, #06b6d4);"></i>
        <span style="
          font-size:var(--font-md, 16px);
          font-weight:var(--weight-semibold, 600);
          color:var(--text-primary, #e2e8f0);
        ">Live Activity</span>
      </div>
      <div class="live-indicator">
        <span class="live-dot"></span>
        Live
      </div>
    </div>

    <!-- Feed list -->
    <div class="activity-feed-list" style="
      max-height:400px;
      overflow-y:auto;
      scrollbar-width:thin;
      scrollbar-color:rgba(255,255,255,0.08) transparent;
    ">
      ${hasActivities
        ? activities.map(a => _activityItemHTML(a, false)).join('')
        : `
          <div class="empty-state" style="padding:48px 24px;">
            <i data-lucide="inbox" class="empty-state-icon" style="width:40px;height:40px;"></i>
            <p class="empty-state-title" style="font-size:var(--font-sm,14px);">No recent activity</p>
            <p class="empty-state-text" style="font-size:var(--font-xs,12px);">
              Activity will appear here in real time.
            </p>
          </div>
        `
      }
    </div>
  `;

  container.appendChild(wrapper);

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [wrapper] });
  }

  return wrapper;
}

/**
 * Prepend a single new activity item with animation.
 *
 * @param {HTMLElement} feedContainer – The .activity-feed element (returned from renderActivityFeed)
 * @param {Object}      activity     – Activity data object
 */
export function addActivityItem(feedContainer, activity) {
  const list = feedContainer?.querySelector('.activity-feed-list');
  if (!list) return;

  // Remove empty state if present
  const emptyState = list.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  // Create the new item
  const temp = document.createElement('div');
  temp.innerHTML = _activityItemHTML(activity, true);
  const item = temp.firstElementChild;

  // Prepend with animation
  list.prepend(item);

  // Initialize Lucide icons in the new item
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [item] });
  }

  return item;
}
