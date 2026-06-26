/* ============================================================
   SENTINEL — Database Viewer Page
   Shows all tables, schemas, and data for examiner review.
   ============================================================ */

import { api } from '../services/api.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderDbViewerPage(container) {
  container.innerHTML = `
    <div style="min-height:100vh;background:var(--bg-primary);padding:var(--space-6);max-width:1400px;margin:0 auto;">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:var(--space-8);padding:var(--space-8) 0;">
        <div style="display:inline-flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);background:linear-gradient(135deg,#06b6d4,#8b5cf6);display:flex;align-items:center;justify-content:center;">
            <i data-lucide="database" style="width:24px;height:24px;color:#fff;"></i>
          </div>
          <h1 style="font-size:var(--font-2xl);font-weight:var(--weight-bold);color:var(--text-primary);margin:0;">
            Sentinel <span class="gradient-text">Database Viewer</span>
          </h1>
        </div>
        <p style="color:var(--text-muted);font-size:var(--font-sm);margin:0;">
          SQLite Database · All tables, schemas, and records
        </p>
        <div style="margin-top:var(--space-4);display:flex;justify-content:center;gap:var(--space-3);">
          <a href="/" style="color:var(--color-primary);text-decoration:none;font-size:var(--font-sm);">
            ← Back to App
          </a>
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="db-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-4);margin-bottom:var(--space-8);">
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg);"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg);"></div>
        <div class="skeleton" style="height:100px;border-radius:var(--radius-lg);"></div>
      </div>

      <!-- Table Navigation -->
      <div class="glass-card" style="padding:var(--space-4);margin-bottom:var(--space-6);">
        <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;">
          <i data-lucide="list" style="width:18px;height:18px;color:var(--color-primary);"></i>
          <span style="font-size:var(--font-sm);font-weight:var(--weight-semibold);color:var(--text-primary);">Jump to table:</span>
          <div id="table-nav" style="display:flex;gap:var(--space-2);flex-wrap:wrap;"></div>
        </div>
      </div>

      <!-- Tables Content -->
      <div id="tables-container">
        <div class="skeleton" style="height:300px;border-radius:var(--radius-lg);margin-bottom:var(--space-6);"></div>
        <div class="skeleton" style="height:300px;border-radius:var(--radius-lg);margin-bottom:var(--space-6);"></div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  // Fetch data
  let data;
  try {
    data = await api.get('/api/db/tables');
    if (data.error) throw new Error(data.error);
  } catch (err) {
    container.querySelector('#tables-container').innerHTML = `
      <div class="glass-card" style="padding:var(--space-8);text-align:center;">
        <i data-lucide="alert-triangle" style="width:48px;height:48px;color:var(--color-warning);margin:0 auto var(--space-4);display:block;"></i>
        <p style="color:var(--text-primary);font-size:var(--font-md);">Failed to load database</p>
        <p style="color:var(--text-muted);font-size:var(--font-sm);">${escapeHtml(err.message)}</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ nodes: [container] });
    return;
  }

  const tables = data.tables || [];
  const totalRows = tables.reduce((s, t) => s + t.rowCount, 0);
  const totalColumns = tables.reduce((s, t) => s + t.columns.length, 0);

  // Render summary
  container.querySelector('#db-summary').innerHTML = `
    <div class="glass-card" style="padding:var(--space-5);text-align:center;">
      <div style="font-size:36px;font-weight:var(--weight-bold);color:var(--color-primary);">${tables.length}</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Tables</div>
    </div>
    <div class="glass-card" style="padding:var(--space-5);text-align:center;">
      <div style="font-size:36px;font-weight:var(--weight-bold);color:var(--color-success);">${totalRows}</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Total Records</div>
    </div>
    <div class="glass-card" style="padding:var(--space-5);text-align:center;">
      <div style="font-size:36px;font-weight:var(--weight-bold);color:var(--color-accent);">${totalColumns}</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Total Columns</div>
    </div>
    <div class="glass-card" style="padding:var(--space-5);text-align:center;">
      <div style="font-size:36px;font-weight:var(--weight-bold);color:var(--color-warning);">SQLite</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Engine</div>
    </div>
  `;

  // Render table navigation
  const nav = container.querySelector('#table-nav');
  nav.innerHTML = tables.map(t => `
    <a href="#table-${t.name}"
       style="padding:6px 14px;border-radius:var(--radius-full);background:rgba(6,182,212,0.1);color:var(--color-primary);font-size:var(--font-xs);font-weight:var(--weight-medium);text-decoration:none;white-space:nowrap;border:1px solid rgba(6,182,212,0.2);transition:all 0.2s;"
       onmouseover="this.style.background='rgba(6,182,212,0.25)'"
       onmouseout="this.style.background='rgba(6,182,212,0.1)'"
    >
      ${escapeHtml(t.name)} <span style="opacity:0.6;">(${t.rowCount})</span>
    </a>
  `).join('');

  // Render each table
  const tablesContainer = container.querySelector('#tables-container');
  tablesContainer.innerHTML = tables.map((table, idx) => `
    <div class="glass-card animate-slide-up" id="table-${table.name}" style="margin-bottom:var(--space-6);animation-delay:${idx * 0.05}s;overflow:hidden;">

      <!-- Table Header -->
      <div style="padding:var(--space-5) var(--space-6);border-bottom:1px solid var(--glass-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3);">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="width:36px;height:36px;border-radius:var(--radius-md);background:${_getTableColor(idx)};display:flex;align-items:center;justify-content:center;">
            <i data-lucide="${_getTableIcon(table.name)}" style="width:18px;height:18px;color:#fff;"></i>
          </div>
          <div>
            <h2 style="font-size:var(--font-md);font-weight:var(--weight-bold);color:var(--text-primary);margin:0;">
              ${escapeHtml(table.name)}
            </h2>
            <p style="font-size:var(--font-xs);color:var(--text-muted);margin:2px 0 0;">
              ${table.rowCount} record${table.rowCount !== 1 ? 's' : ''} · ${table.columns.length} columns
            </p>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary toggle-schema-btn" data-table="${table.name}" style="font-size:var(--font-xs);">
          <i data-lucide="code" style="width:14px;height:14px;"></i>
          Show Schema
        </button>
      </div>

      <!-- Schema (hidden by default) -->
      <div id="schema-${table.name}" style="display:none;padding:var(--space-4) var(--space-6);background:rgba(0,0,0,0.3);border-bottom:1px solid var(--glass-border);">
        <pre style="margin:0;font-size:12px;color:#a5f3fc;font-family:'Courier New',monospace;white-space:pre-wrap;line-height:1.6;">${escapeHtml(table.createStatement)}</pre>
      </div>

      <!-- Column Schema -->
      <div style="padding:var(--space-4) var(--space-6);border-bottom:1px solid var(--glass-border);background:rgba(255,255,255,0.01);">
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          ${table.columns.map(col => `
            <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--radius-full);font-size:11px;
                         background:${col.primaryKey ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)'};
                         border:1px solid ${col.primaryKey ? 'rgba(245,158,11,0.3)' : 'var(--glass-border)'};
                         color:${col.primaryKey ? '#fbbf24' : 'var(--text-secondary)'};">
              ${col.primaryKey ? '<span style="color:#fbbf24;">🔑</span>' : ''}
              <strong>${escapeHtml(col.name)}</strong>
              <span style="opacity:0.5;">${escapeHtml(col.type || 'TEXT')}</span>
              ${col.notNull ? '<span style="color:var(--color-danger);font-size:9px;">NOT NULL</span>' : ''}
            </span>
          `).join('')}
        </div>
      </div>

      <!-- Data Table -->
      <div style="overflow-x:auto;max-height:500px;overflow-y:auto;">
        ${table.rows.length === 0 ? `
          <div style="padding:var(--space-8);text-align:center;color:var(--text-muted);font-size:var(--font-sm);">
            <i data-lucide="inbox" style="width:32px;height:32px;opacity:0.3;margin:0 auto var(--space-3);display:block;"></i>
            No records in this table
          </div>
        ` : `
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr>
                <th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-size:10px;border-bottom:1px solid var(--glass-border);position:sticky;top:0;background:rgba(15,23,42,0.95);white-space:nowrap;">
                  #
                </th>
                ${table.columns.map(col => `
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-size:10px;border-bottom:1px solid var(--glass-border);position:sticky;top:0;background:rgba(15,23,42,0.95);white-space:nowrap;">
                    ${escapeHtml(col.name)}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${table.rows.map((row, ri) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);${ri % 2 === 0 ? '' : 'background:rgba(255,255,255,0.015);'}">
                  <td style="padding:8px 14px;color:var(--text-muted);font-size:11px;">${ri + 1}</td>
                  ${table.columns.map(col => `
                    <td style="padding:8px 14px;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(String(row[col.name] ?? ''))}">
                      ${_formatCellValue(row[col.name], col.name)}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  // Toggle schema buttons
  container.querySelectorAll('.toggle-schema-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tableName = btn.dataset.table;
      const schemaEl = container.querySelector(`#schema-${tableName}`);
      const isHidden = schemaEl.style.display === 'none';
      schemaEl.style.display = isHidden ? 'block' : 'none';
      btn.innerHTML = isHidden
        ? '<i data-lucide="code" style="width:14px;height:14px;"></i> Hide Schema'
        : '<i data-lucide="code" style="width:14px;height:14px;"></i> Show Schema';
      if (window.lucide) window.lucide.createIcons({ nodes: [btn] });
    });
  });
}


// ── Helpers ──────────────────────────────────────────────────

function _getTableColor(index) {
  const colors = [
    'linear-gradient(135deg,#06b6d4,#0891b2)',
    'linear-gradient(135deg,#8b5cf6,#7c3aed)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#d97706)',
    'linear-gradient(135deg,#ef4444,#dc2626)',
    'linear-gradient(135deg,#ec4899,#db2777)',
    'linear-gradient(135deg,#6366f1,#4f46e5)',
  ];
  return colors[index % colors.length];
}

function _getTableIcon(name) {
  const icons = {
    users: 'users',
    parent_child_links: 'link',
    devices: 'smartphone',
    usage_sessions: 'activity',
    screen_time_limits: 'clock',
    alerts: 'bell',
    alert_rules: 'shield',
  };
  return icons[name] || 'table';
}

function _formatCellValue(value, colName) {
  if (value === null || value === undefined) {
    return '<span style="color:var(--text-muted);opacity:0.4;font-style:italic;">NULL</span>';
  }

  const str = String(value);

  // Mask password hashes
  if (colName === 'password_hash') {
    return '<span style="color:var(--text-muted);font-family:monospace;">$2a$10•••••••</span>';
  }

  // Color boolean values
  if (str === '1' && (colName.startsWith('is_') || colName.startsWith('notify_') || colName.startsWith('delivered_'))) {
    return '<span style="color:var(--color-success);font-weight:600;">✓ true</span>';
  }
  if (str === '0' && (colName.startsWith('is_') || colName.startsWith('notify_') || colName.startsWith('delivered_'))) {
    return '<span style="color:var(--text-muted);">✗ false</span>';
  }

  // Color avatar_color as a swatch
  if (colName === 'avatar_color' && str.startsWith('#')) {
    return `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:50%;background:${str};display:inline-block;border:1px solid rgba(255,255,255,0.2);"></span> ${escapeHtml(str)}</span>`;
  }

  // Highlight role values
  if (colName === 'role') {
    const roleColor = str === 'parent' ? 'var(--color-primary)' : 'var(--color-accent)';
    return `<span style="color:${roleColor};font-weight:600;">${escapeHtml(str)}</span>`;
  }

  // Highlight alert types
  if (colName === 'type') {
    const typeColors = { warning: '#f59e0b', exceeded: '#ef4444', critical: '#dc2626' };
    return `<span style="color:${typeColors[str] || 'var(--text-secondary)'};font-weight:600;">${escapeHtml(str)}</span>`;
  }

  // Truncate UUIDs
  if (colName === 'id' || colName.endsWith('_id')) {
    if (str.length > 20) {
      return `<span style="font-family:monospace;font-size:11px;color:var(--text-muted);" title="${escapeHtml(str)}">${escapeHtml(str.slice(0, 8))}…</span>`;
    }
  }

  return escapeHtml(str);
}
