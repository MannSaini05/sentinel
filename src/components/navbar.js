/* ============================================================
   SENTINEL — Navbar Component
   ============================================================ */

import { api } from '../services/api.js';
import { logout, getCachedUser } from '../services/auth.js';
import { getInitials } from '../utils/helpers.js';
import router from '../utils/router.js';

/**
 * Render the top navigation bar
 */
export function renderNavbar(container, { onHamburgerClick, alertCount = 0 } = {}) {
  const user = getCachedUser();
  const initials = getInitials(user?.name || 'User');

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.innerHTML = `
    <div class="top-bar-left">
      <button class="hamburger-btn" aria-label="Toggle sidebar">
        <i data-lucide="menu"></i>
      </button>
      <div class="top-bar-breadcrumb">
        <a href="/dashboard" data-link>Sentinel</a>
        <span class="separator">/</span>
        <span class="breadcrumb-current">Dashboard</span>
      </div>
    </div>
    <div class="top-bar-right">
      <div class="top-bar-search">
        <i data-lucide="search"></i>
        <input type="text" placeholder="Search..." class="input" />
      </div>
      <button class="notification-btn" aria-label="Notifications" data-tooltip="Notifications">
        <i data-lucide="bell"></i>
        ${alertCount > 0 ? `<span class="alert-count">${alertCount > 99 ? '99+' : alertCount}</span>` : ''}
      </button>
      <div class="user-menu dropdown">
        <button class="user-menu-trigger" aria-label="User menu">
          <div class="avatar avatar-sm" style="background:linear-gradient(135deg, var(--color-primary), var(--color-accent))">
            ${initials}
          </div>
          <i data-lucide="chevron-down" class="chevron"></i>
        </button>
        <div class="dropdown-menu">
          <div style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); margin-bottom: 4px;">
            <div style="font-size: var(--font-sm); font-weight: var(--weight-medium); color: var(--text-primary);">${user?.name || 'User'}</div>
            <div style="font-size: var(--font-xs); color: var(--text-muted);">${user?.email || ''}</div>
          </div>
          <button class="dropdown-item" data-action="settings">
            <i data-lucide="settings"></i>
            Settings
          </button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" data-action="logout" style="color: var(--color-danger);">
            <i data-lucide="log-out"></i>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  `;

  container.prepend(topBar);

  // Hamburger
  const hamburger = topBar.querySelector('.hamburger-btn');
  if (hamburger && onHamburgerClick) {
    hamburger.addEventListener('click', onHamburgerClick);
  }

  // User menu dropdown
  const trigger = topBar.querySelector('.user-menu-trigger');
  const menu = topBar.querySelector('.dropdown-menu');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open');
    trigger.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
    trigger.classList.remove('open');
  });

  // Dropdown actions
  topBar.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
    router.navigate('/settings');
  });

  topBar.querySelector('[data-action="logout"]')?.addEventListener('click', () => {
    logout();
  });

  // Initialize icons
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [topBar] });
  }

  return topBar;
}

/**
 * Update the breadcrumb text
 */
export function updateBreadcrumb(topBar, text) {
  const crumb = topBar?.querySelector('.breadcrumb-current');
  if (crumb) crumb.textContent = text;
}

/**
 * Update alert count badge
 */
export function updateAlertCount(topBar, count) {
  const btn = topBar?.querySelector('.notification-btn');
  if (!btn) return;

  const existing = btn.querySelector('.alert-count');
  if (existing) existing.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'alert-count';
    badge.textContent = count > 99 ? '99+' : count;
    btn.appendChild(badge);
  }
}
