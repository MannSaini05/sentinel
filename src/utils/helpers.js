/* ============================================================
   SENTINEL — Utility / Helper Functions
   ============================================================ */

/**
 * Format minutes into human-readable string: "2h 15m"
 */
export function formatMinutes(min) {
  if (min == null || isNaN(min)) return '0m';
  min = Math.round(min);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format ISO string to time: "2:30 PM"
 */
export function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Format ISO string to short date: "Mon, Jun 2"
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format ISO string to full date: "June 2, 2025"
 */
export function formatDateFull(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Relative time: "5 min ago", "2 hours ago"
 */
export function timeAgo(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(isoString);
}

/**
 * Calculate percentage (clamped to 0-100)
 */
export function getPercentage(value, total) {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

/**
 * Get a consistent color for an app category
 */
export function getCategoryColor(category) {
  const colors = {
    social:        '#8b5cf6',
    entertainment: '#f59e0b',
    education:     '#10b981',
    gaming:        '#ef4444',
    productivity:  '#06b6d4',
    communication: '#3b82f6',
    browser:       '#6366f1',
    utilities:     '#64748b',
    health:        '#14b8a6',
    news:          '#f97316',
    shopping:      '#ec4899',
    other:         '#94a3b8'
  };
  return colors[category?.toLowerCase()] || colors.other;
}

/**
 * Get a Lucide icon name for each category
 */
export function getCategoryIcon(category) {
  const icons = {
    social:        'users',
    entertainment: 'tv',
    education:     'graduation-cap',
    gaming:        'gamepad-2',
    productivity:  'briefcase',
    communication: 'message-circle',
    browser:       'globe',
    utilities:     'settings',
    health:        'heart-pulse',
    news:          'newspaper',
    shopping:      'shopping-bag',
    other:         'grid-3x3'
  };
  return icons[category?.toLowerCase()] || icons.other;
}

/**
 * Get color for alert type
 */
export function getAlertColor(type) {
  const colors = {
    warning:  '#f59e0b',
    exceeded: '#ef4444',
    critical: '#dc2626',
    info:     '#3b82f6'
  };
  return colors[type] || colors.info;
}

/**
 * Debounce a function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Animate a numeric value counting up inside an element
 */
export function animateValue(element, start, end, duration = 800) {
  if (!element) return;
  const startTime = performance.now();
  const diff = end - start;

  function tick(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * eased);
    element.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

/**
 * Create a ripple effect on a click event
 */
export function createRipple(event) {
  const element = event.currentTarget;
  const existing = element.querySelector('.ripple');
  if (existing) existing.remove();

  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
  element.appendChild(ripple);

  ripple.addEventListener('animationend', () => ripple.remove());
}

/**
 * Generate initials from a name
 */
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Simple ID generator
 */
export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: 'check-circle',
    error:   'x-circle',
    warning: 'alert-triangle',
    info:    'info'
  };

  toast.innerHTML = `
    <i data-lucide="${iconMap[type] || 'info'}" style="width:18px;height:18px;color:var(--color-${type === 'error' ? 'danger' : type});flex-shrink:0;"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Dismiss">
      <i data-lucide="x" style="width:14px;height:14px;"></i>
    </button>
  `;

  container.appendChild(toast);

  // Initialize Lucide icons in toast
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [toast] });
  }

  const dismiss = () => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}
