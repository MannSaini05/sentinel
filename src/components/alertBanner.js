/* ============================================================
   SENTINEL — Alert Banner Component
   Real-time alert banners shown at the top of the page.
   ============================================================ */

import { onSSEEvent } from '../services/sse.js';
import { ALERT_TYPES } from '../utils/constants.js';
import { timeAgo, escapeHtml } from '../utils/helpers.js';

let _bannerQueue = [];
let _isShowing = false;

/**
 * Initialize the alert listener.
 * Subscribes to SSE 'alert' events and displays banners
 * in the #alert-container element.
 */
export function initAlertListener() {
  onSSEEvent('alert', (data) => {
    if (!data) return;
    showAlertBanner({
      type: data.type || 'warning',
      message: data.message || 'New alert received',
      childName: data.child_name || '',
      createdAt: data.created_at || new Date().toISOString()
    });
  });
}

/**
 * Display an alert banner at the top of the page.
 * Auto-dismisses after 8 seconds. Queues if another is showing.
 */
export function showAlertBanner({ type = 'warning', message, childName = '', createdAt }) {
  _bannerQueue.push({ type, message, childName, createdAt });
  if (!_isShowing) _showNext();
}

function _showNext() {
  if (_bannerQueue.length === 0) {
    _isShowing = false;
    return;
  }

  _isShowing = true;
  const { type, message, childName, createdAt } = _bannerQueue.shift();
  const alertConfig = ALERT_TYPES[type] || ALERT_TYPES.warning;

  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) return;

  const banner = document.createElement('div');
  banner.className = `alert-banner ${alertConfig.cssClass}`;

  banner.innerHTML = `
    <div class="alert-banner-icon" style="background:${alertConfig.bgDim};color:${alertConfig.color};">
      <i data-lucide="${alertConfig.icon}"></i>
    </div>
    <div class="alert-banner-content">
      ${childName ? `<div class="alert-banner-child" style="color:${alertConfig.color};">${escapeHtml(childName)}</div>` : ''}
      <div class="alert-banner-message">${escapeHtml(message)}</div>
    </div>
    <span class="alert-banner-time">${createdAt ? timeAgo(createdAt) : 'just now'}</span>
    <button class="alert-banner-dismiss" aria-label="Dismiss">
      <i data-lucide="x" style="width:16px;height:16px;"></i>
    </button>
  `;

  alertContainer.appendChild(banner);

  if (window.lucide) {
    window.lucide.createIcons({ nodes: [banner] });
  }

  const dismiss = () => {
    banner.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      banner.remove();
      _showNext();
    }, 300);
  };

  banner.querySelector('.alert-banner-dismiss')?.addEventListener('click', dismiss);

  // Auto dismiss after 8 seconds
  setTimeout(dismiss, 8000);
}
