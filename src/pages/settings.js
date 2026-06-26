/* ============================================================
   SENTINEL — Settings Page
   ============================================================ */

import { renderSidebar, createSidebarOverlay, toggleSidebar } from '../components/sidebar.js';
import { renderNavbar, updateBreadcrumb } from '../components/navbar.js';
import { api } from '../services/api.js';
import { getUser } from '../services/auth.js';
import {
  formatMinutes, getInitials, escapeHtml, showToast
} from '../utils/helpers.js';
import { DEFAULT_LIMITS } from '../utils/constants.js';
import router from '../utils/router.js';

/**
 * Render the settings page with screen time limits, alert rules,
 * child accounts, and account info sections.
 */
export async function renderSettingsPage(container) {
  const user = await getUser();
  if (!user) return;

  // ── Layout ─────────────────────────────────────────────────
  container.innerHTML = '<div class="app-layout"><div class="main-content" id="main-content"></div></div>';
  const layout = container.querySelector('.app-layout');
  const main   = container.querySelector('#main-content');

  renderSidebar(layout, '/settings');
  createSidebarOverlay(layout);
  const navbar = renderNavbar(main, { onHamburgerClick: toggleSidebar });
  updateBreadcrumb(navbar, 'Settings');

  const inner = document.createElement('div');
  inner.className = 'main-content-inner page-enter';
  main.appendChild(inner);

  // ── Skeleton ───────────────────────────────────────────────
  inner.innerHTML = `
    <div class="page-header">
      <h1 class="page-greeting">Settings</h1>
      <p class="page-greeting-date">Manage limits, alerts, and accounts</p>
    </div>
    <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);margin-bottom:var(--space-6);"></div>
    <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);margin-bottom:var(--space-6);"></div>
    <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);margin-bottom:var(--space-6);"></div>
    <div class="skeleton" style="height:140px;border-radius:var(--radius-lg);"></div>
  `;

  // ── Fetch data ─────────────────────────────────────────────
  let children = [];
  let allLimits = {};    // childId → limits[]
  let allRules  = [];

  try {
    const [childRes, rulesRes] = await Promise.all([
      api.get('/api/settings/children'),
      api.get('/api/alerts/rules')
    ]);

    if (childRes?.children && Array.isArray(childRes.children)) children = childRes.children;
    else if (Array.isArray(childRes)) children = childRes;

    if (rulesRes?.rules && Array.isArray(rulesRes.rules)) allRules = rulesRes.rules;
    else if (Array.isArray(rulesRes)) allRules = rulesRes;

    // Fetch limits for each child
    const limitPromises = children.map(c =>
      api.get(`/api/settings/limits/${c.id}`).then(r => ({ id: c.id, limits: r?.limits || r }))
    );
    const limitResults = await Promise.all(limitPromises);
    limitResults.forEach(({ id, limits }) => {
      allLimits[id] = Array.isArray(limits) ? limits : (limits.error ? [] : [limits]);
    });
  } catch (err) {
    console.error('Settings fetch error:', err);
  }

  // ── Render content ─────────────────────────────────────────
  inner.innerHTML = `
    <div class="page-header">
      <h1 class="page-greeting">Settings</h1>
      <p class="page-greeting-date">Manage limits, alerts, and accounts</p>
    </div>

    <!-- 1. Screen Time Limits -->
    <div class="glass-card p-6 settings-section animate-slide-up" style="margin-bottom: var(--space-6);">
      <div class="settings-section-header">
        <i data-lucide="clock"></i>
        <h2 class="settings-section-title">Screen Time Limits</h2>
      </div>
      <div id="limits-section">
        ${children.length === 0
          ? '<p style="color:var(--text-muted);font-size:var(--font-sm);">No children linked. Link a child account first.</p>'
          : children.map(child => _renderLimitCard(child, allLimits[child.id] || [])).join('')
        }
      </div>
    </div>

    <!-- 2. Alert Rules -->
    <div class="glass-card p-6 settings-section animate-slide-up" style="animation-delay:0.1s; margin-bottom: var(--space-6);">
      <div class="settings-section-header">
        <i data-lucide="bell"></i>
        <h2 class="settings-section-title">Alert Rules</h2>
      </div>
      <div id="rules-section">
        ${allRules.length === 0
          ? '<p style="color:var(--text-muted);font-size:var(--font-sm);margin-bottom:var(--space-4);">No alert rules configured yet.</p>'
          : allRules.map(rule => _renderRuleCard(rule, children)).join('')
        }
        <button class="btn btn-sm btn-secondary" id="add-rule-btn" style="margin-top: var(--space-4);">
          <i data-lucide="plus" style="width:14px;height:14px;"></i>
          Add Alert Rule
        </button>
      </div>
    </div>

    <!-- 3. Child Accounts -->
    <div class="glass-card p-6 settings-section animate-slide-up" style="animation-delay:0.2s; margin-bottom: var(--space-6);">
      <div class="settings-section-header">
        <i data-lucide="users"></i>
        <h2 class="settings-section-title">Child Accounts</h2>
      </div>
      <div id="children-section">
        ${children.length === 0
          ? '<p style="color:var(--text-muted);font-size:var(--font-sm);margin-bottom:var(--space-4);">No children linked yet.</p>'
          : `<div style="display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-5);">
              ${children.map(c => _renderChildRow(c)).join('')}
            </div>`
        }
        <div style="padding:var(--space-5);background:rgba(255,255,255,0.02);border-radius:var(--radius-md);border:1px dashed var(--glass-border);">
          <p style="font-size:var(--font-sm);color:var(--text-tertiary);margin-bottom:var(--space-3);">
            <i data-lucide="link" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i>
            Link a new child account
          </p>
          <div style="display:flex;gap:var(--space-3);align-items:center;">
            <input class="input" type="text" id="link-code-input" placeholder="Enter link code" style="max-width:220px;" />
            <button class="btn btn-sm btn-primary" id="link-code-btn">Link</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Account Info -->
    <div class="glass-card p-6 settings-section animate-slide-up" style="animation-delay:0.3s;">
      <div class="settings-section-header">
        <i data-lucide="user"></i>
        <h2 class="settings-section-title">Account Info</h2>
      </div>
      <div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Name</div>
            <div class="settings-row-desc">${escapeHtml(user.name || 'N/A')}</div>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Email</div>
            <div class="settings-row-desc">${escapeHtml(user.email || 'N/A')}</div>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Role</div>
            <div class="settings-row-desc" style="text-transform:capitalize;">${escapeHtml(user.role || 'Parent')}</div>
          </div>
        </div>
        ${user.phone ? `
          <div class="settings-row">
            <div>
              <div class="settings-row-label">Phone</div>
              <div class="settings-row-desc">${escapeHtml(user.phone)}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [inner] });

  // ── Event handlers ─────────────────────────────────────────

  // Save limit buttons
  inner.querySelectorAll('.save-limit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const limitId = btn.dataset.limitId;
      const childId = btn.dataset.childId;
      const slider  = inner.querySelector(`#limit-slider-${childId}`);
      const value   = parseInt(slider?.value || DEFAULT_LIMITS.daily, 10);

      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spinner"></span>';

      try {
        if (limitId) {
          const res = await api.put(`/api/settings/limits/${limitId}`, {
            daily_limit_minutes: value
          });
          if (res.error) throw new Error(res.error);
        } else {
          const res = await api.post('/api/settings/limits', {
            child_id: childId,
            daily_limit_minutes: value
          });
          if (res.error) throw new Error(res.error);
        }
        showToast('Limit saved successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to save limit', 'error');
      }

      btn.disabled = false;
      btn.innerHTML = 'Save';
    });
  });

  // Slider value display
  inner.querySelectorAll('.limit-range-slider').forEach(slider => {
    const display = inner.querySelector(`#limit-value-${slider.dataset.childId}`);
    slider.addEventListener('input', () => {
      if (display) display.textContent = formatMinutes(parseInt(slider.value, 10));
    });
  });

  // Toggle switches for rules
  inner.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      const ruleId = toggle.dataset.ruleId;
      const field  = toggle.dataset.field;
      const value  = toggle.checked;

      try {
        const payload = {};
        payload[field] = value;
        const res = await api.put(`/api/alerts/rules/${ruleId}`, payload);
        if (res.error) throw new Error(res.error);
        showToast('Rule updated', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to update rule', 'error');
        toggle.checked = !value; // revert
      }
    });
  });

  // Add rule button
  inner.querySelector('#add-rule-btn')?.addEventListener('click', async () => {
    if (children.length === 0) {
      showToast('Link a child first to add rules', 'warning');
      return;
    }

    const firstChild = children[0];
    try {
      const res = await api.post('/api/alerts/rules', {
        child_id: firstChild.id,
        threshold_minutes: 120,
        cooldown_minutes: 30,
        is_active: true,
        notify_email: true,
        notify_sms: false
      });

      if (res.error) throw new Error(res.error);
      showToast('Rule created! Reload to see it.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to create rule', 'error');
    }
  });

  // Link code button
  inner.querySelector('#link-code-btn')?.addEventListener('click', async () => {
    const codeInput = inner.querySelector('#link-code-input');
    const code = codeInput?.value.trim().toUpperCase();
    if (!code) {
      showToast('Please enter a link code', 'warning');
      return;
    }

    const btn = inner.querySelector('#link-code-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span>';

    try {
      const res = await api.post('/api/auth/link-child', { linkCode: code });
      if (res.error) throw new Error(res.error);
      showToast(`Child "${res.child?.name || ''}" linked successfully!`, 'success');
      codeInput.value = '';
      // Reload the page to show the newly linked child
      setTimeout(() => router.navigate('/settings'), 1000);
    } catch (err) {
      showToast(err.message || 'Failed to link child. Check the code and try again.', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = 'Link';
  });
}


// ═══════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════

function _renderLimitCard(child, limits) {
  const limit     = limits[0] || {};
  const limitMin  = limit.daily_limit_minutes || DEFAULT_LIMITS.daily;
  const limitId   = limit.id || '';
  const color     = child.avatarColor || '#06b6d4';
  const initials  = getInitials(child.name);

  return `
    <div class="settings-row" style="flex-wrap:wrap;gap:var(--space-4);">
      <div style="display:flex;align-items:center;gap:var(--space-3);min-width:160px;">
        <div class="avatar avatar-sm" style="background:${color};">${initials}</div>
        <div>
          <div style="font-size:var(--font-sm);font-weight:var(--weight-medium);color:var(--text-primary);">${escapeHtml(child.name)}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted);" id="limit-value-${child.id}">${formatMinutes(limitMin)}</div>
        </div>
      </div>
      <div style="flex:1;min-width:200px;display:flex;align-items:center;gap:var(--space-3);">
        <span style="font-size:var(--font-xs);color:var(--text-muted);white-space:nowrap;">${formatMinutes(DEFAULT_LIMITS.min)}</span>
        <input type="range"
               class="limit-range-slider"
               id="limit-slider-${child.id}"
               data-child-id="${child.id}"
               min="${DEFAULT_LIMITS.min}"
               max="${DEFAULT_LIMITS.max}"
               step="${DEFAULT_LIMITS.step}"
               value="${limitMin}"
               style="flex:1;accent-color:var(--color-primary);cursor:pointer;"
        />
        <span style="font-size:var(--font-xs);color:var(--text-muted);white-space:nowrap;">${formatMinutes(DEFAULT_LIMITS.max)}</span>
      </div>
      <button class="btn btn-sm btn-primary save-limit-btn" data-limit-id="${limitId}" data-child-id="${child.id}">
        Save
      </button>
    </div>
  `;
}

function _renderRuleCard(rule, children) {
  const child = children.find(c => c.id === rule.child_id);
  const childName = child?.name || `Child #${rule.child_id}`;

  return `
    <div style="padding:var(--space-4);background:rgba(255,255,255,0.02);border-radius:var(--radius-md);border:1px solid var(--glass-border);margin-bottom:var(--space-3);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);flex-wrap:wrap;gap:var(--space-3);">
        <div>
          <span style="font-size:var(--font-sm);font-weight:var(--weight-medium);color:var(--text-primary);">${escapeHtml(childName)}</span>
          <span style="font-size:var(--font-xs);color:var(--text-muted);margin-left:var(--space-2);">
            Alert at ${formatMinutes(rule.threshold_minutes || 120)} · Cooldown ${rule.cooldown_minutes || 30}min
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-4);">
          <!-- Active toggle -->
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:var(--font-xs);color:var(--text-muted);">Active</span>
            <label class="toggle-switch">
              <input type="checkbox" class="rule-toggle" data-rule-id="${rule.id}" data-field="is_active" ${rule.is_active ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- Email toggle -->
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:var(--font-xs);color:var(--text-muted);">Email</span>
            <label class="toggle-switch">
              <input type="checkbox" class="rule-toggle" data-rule-id="${rule.id}" data-field="notify_email" ${rule.notify_email ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- SMS toggle -->
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="font-size:var(--font-xs);color:var(--text-muted);">SMS</span>
            <label class="toggle-switch">
              <input type="checkbox" class="rule-toggle" data-rule-id="${rule.id}" data-field="notify_sms" ${rule.notify_sms ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

function _renderChildRow(child) {
  const color    = child.avatarColor || '#06b6d4';
  const initials = getInitials(child.name);
  const devices  = child.devices || [];

  return `
    <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);background:rgba(255,255,255,0.02);border-radius:var(--radius-md);">
      <div class="avatar avatar-md" style="background:${color};">${initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:var(--font-sm);font-weight:var(--weight-medium);color:var(--text-primary);">${escapeHtml(child.name)}</div>
        <div style="font-size:var(--font-xs);color:var(--text-muted);">
          ${child.email ? escapeHtml(child.email) : 'No email'}
          ${devices.length > 0 ? ` · ${devices.length} device${devices.length > 1 ? 's' : ''}` : ''}
        </div>
      </div>
      <span class="badge badge-primary" style="font-size:10px;">Linked</span>
    </div>
  `;
}
