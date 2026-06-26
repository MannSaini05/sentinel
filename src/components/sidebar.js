/* ============================================================
   SENTINEL — Sidebar Component
   ============================================================ */

import { api } from '../services/api.js';
import { logout, getCachedUser } from '../services/auth.js';
import { getInitials } from '../utils/helpers.js';
import { NAV_ITEMS } from '../utils/constants.js';
import router from '../utils/router.js';

/**
 * Render the sidebar navigation
 */
export function renderSidebar(container, activePath = '/dashboard') {
  const user = getCachedUser();
  const initials = getInitials(user?.name || 'User');

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon">
        <i data-lucide="shield"></i>
      </div>
      <span class="sidebar-brand-text">Sentinel</span>
      <span class="sidebar-brand-badge">Pro</span>
    </div>

    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <div class="sidebar-section-label">Menu</div>
        ${NAV_ITEMS.map(item => `
          <button class="sidebar-link ${activePath === item.path ? 'active' : ''}" data-path="${item.path}">
            <i data-lucide="${item.icon}"></i>
            <span>${item.label}</span>
          </button>
        `).join('')}
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-label">Children</div>
        <div class="sidebar-children" id="sidebar-children">
          <div class="skeleton skeleton-text" style="margin: 8px 12px;"></div>
          <div class="skeleton skeleton-text" style="margin: 8px 12px; width: 70%;"></div>
        </div>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="avatar avatar-sm" style="background: linear-gradient(135deg, var(--color-primary), var(--color-accent))">
          ${initials}
        </div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${user?.name || 'User'}</div>
          <div class="sidebar-user-role">${user?.role || 'Parent'}</div>
        </div>
        <button class="sidebar-logout" aria-label="Logout" data-tooltip="Sign out">
          <i data-lucide="log-out" style="width:18px;height:18px;"></i>
        </button>
      </div>
    </div>
  `;

  container.prepend(sidebar);

  // Nav link clicks
  sidebar.querySelectorAll('.sidebar-link[data-path]').forEach(link => {
    link.addEventListener('click', () => {
      const path = link.dataset.path;
      router.navigate(path);
    });
  });

  // Logout
  sidebar.querySelector('.sidebar-logout')?.addEventListener('click', () => {
    logout();
  });

  // Initialize icons
  if (window.lucide) {
    window.lucide.createIcons({ nodes: [sidebar] });
  }

  // Fetch children and populate
  loadSidebarChildren(sidebar);

  return sidebar;
}

/**
 * Load children list into sidebar
 */
async function loadSidebarChildren(sidebar) {
  const childrenContainer = sidebar.querySelector('#sidebar-children');
  if (!childrenContainer) return;

  const result = await api.get('/api/settings/children');

  if (result.error || !Array.isArray(result)) {
    childrenContainer.innerHTML = `
      <div style="padding: 8px 12px; font-size: var(--font-xs); color: var(--text-muted);">
        No children linked
      </div>
    `;
    return;
  }

  if (result.length === 0) {
    childrenContainer.innerHTML = `
      <div style="padding: 8px 12px; font-size: var(--font-xs); color: var(--text-muted);">
        No children linked yet
      </div>
    `;
    return;
  }

  childrenContainer.innerHTML = result.map(child => {
    const childInitials = getInitials(child.name);
    const isActive = child.isActive || false;
    const color = child.avatarColor || '#06b6d4';

    return `
      <button class="sidebar-child-link" data-child-id="${child.id}">
        <div class="avatar" style="background: ${color}; width: 28px; height: 28px; font-size: 11px;">
          ${childInitials}
        </div>
        <span>${child.name}</span>
        <span class="sidebar-child-status ${isActive ? 'online' : 'offline'}"></span>
      </button>
    `;
  }).join('');

  // Child link clicks
  childrenContainer.querySelectorAll('.sidebar-child-link').forEach(link => {
    link.addEventListener('click', () => {
      const childId = link.dataset.childId;
      router.navigate(`/child/${childId}`);
    });
  });
}

/**
 * Toggle sidebar open/closed (mobile)
 */
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebar) {
    sidebar.classList.toggle('open');
  }
  if (overlay) {
    overlay.classList.toggle('open');
  }
}

/**
 * Create the sidebar overlay for mobile
 */
export function createSidebarOverlay(container) {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.addEventListener('click', toggleSidebar);
  container.appendChild(overlay);
  return overlay;
}
