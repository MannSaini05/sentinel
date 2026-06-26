/* ============================================================
   SENTINEL — Application Constants
   ============================================================ */

/**
 * App categories with colors, icons, and labels
 */
export const APP_CATEGORIES = {
  social:        { label: 'Social Media',   color: '#8b5cf6', icon: 'users',           bgDim: 'rgba(139,92,246,0.15)' },
  entertainment: { label: 'Entertainment',  color: '#f59e0b', icon: 'tv',              bgDim: 'rgba(245,158,11,0.15)' },
  education:     { label: 'Education',      color: '#10b981', icon: 'graduation-cap',  bgDim: 'rgba(16,185,129,0.15)' },
  gaming:        { label: 'Gaming',         color: '#ef4444', icon: 'gamepad-2',       bgDim: 'rgba(239,68,68,0.15)' },
  productivity:  { label: 'Productivity',   color: '#06b6d4', icon: 'briefcase',       bgDim: 'rgba(6,182,212,0.15)' },
  communication: { label: 'Communication',  color: '#3b82f6', icon: 'message-circle',  bgDim: 'rgba(59,130,246,0.15)' },
  browser:       { label: 'Browser',        color: '#6366f1', icon: 'globe',           bgDim: 'rgba(99,102,241,0.15)' },
  utilities:     { label: 'Utilities',      color: '#64748b', icon: 'settings',        bgDim: 'rgba(100,116,139,0.15)' },
  health:        { label: 'Health',         color: '#14b8a6', icon: 'heart-pulse',     bgDim: 'rgba(20,184,166,0.15)' },
  news:          { label: 'News',           color: '#f97316', icon: 'newspaper',       bgDim: 'rgba(249,115,22,0.15)' },
  shopping:      { label: 'Shopping',       color: '#ec4899', icon: 'shopping-bag',    bgDim: 'rgba(236,72,153,0.15)' },
  other:         { label: 'Other',          color: '#94a3b8', icon: 'grid-3x3',        bgDim: 'rgba(148,163,184,0.15)' }
};

/**
 * Alert types with labels, colors, and icons
 */
export const ALERT_TYPES = {
  warning: {
    label:   'Warning',
    color:   '#f59e0b',
    bgDim:   'rgba(245,158,11,0.15)',
    icon:    'alert-triangle',
    cssClass:'alert-banner-warning'
  },
  exceeded: {
    label:   'Limit Exceeded',
    color:   '#ef4444',
    bgDim:   'rgba(239,68,68,0.15)',
    icon:    'alert-octagon',
    cssClass:'alert-banner-exceeded'
  },
  critical: {
    label:   'Critical',
    color:   '#dc2626',
    bgDim:   'rgba(220,38,38,0.2)',
    icon:    'shield-alert',
    cssClass:'alert-banner-critical'
  },
  info: {
    label:   'Info',
    color:   '#3b82f6',
    bgDim:   'rgba(59,130,246,0.15)',
    icon:    'info',
    cssClass:'alert-banner-info'
  }
};

/**
 * Consistent chart color palette
 */
export const CHART_COLORS = {
  primary:   ['#06b6d4', '#0891b2', '#0e7490', '#155e75'],
  accent:    ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
  success:   ['#10b981', '#059669', '#047857'],
  warning:   ['#f59e0b', '#d97706', '#b45309'],
  danger:    ['#ef4444', '#dc2626', '#b91c1c'],
  palette: [
    '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981',
    '#ef4444', '#3b82f6', '#ec4899', '#f97316',
    '#6366f1', '#14b8a6', '#64748b', '#84cc16'
  ],
  gridColor:     'rgba(255,255,255,0.06)',
  tickColor:     '#64748b',
  tooltipBg:     'rgba(17,24,39,0.9)',
  tooltipBorder: 'rgba(255,255,255,0.1)',
  tooltipColor:  '#e2e8f0'
};

/**
 * Sidebar navigation items
 */
export const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',  icon: 'layout-dashboard' },
  { path: '/analytics',  label: 'Analytics',   icon: 'bar-chart-3' },
  { path: '/settings',   label: 'Settings',    icon: 'settings' }
];

/**
 * Default screen time limits (in minutes)
 */
export const DEFAULT_LIMITS = {
  daily: 120,
  min:   0,
  max:   480,
  step:  15
};

/**
 * Days of the week (short)
 */
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Hours labels for timeline
 */
export const HOURS_LABELS = Array.from({ length: 25 }, (_, i) => {
  if (i === 0 || i === 24) return '12a';
  if (i === 12) return '12p';
  if (i < 12) return `${i}a`;
  return `${i - 12}p`;
});

/**
 * Avatar colors for children
 */
export const AVATAR_COLORS = [
  '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#f97316'
];
