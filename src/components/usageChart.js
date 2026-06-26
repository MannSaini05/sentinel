/* ============================================================
   SENTINEL — Usage Chart Components
   ============================================================ */

import { CHART_COLORS } from '../utils/constants.js';

/**
 * Internal map of active Chart instances keyed by canvasId.
 * Used for cleanup before re-rendering on the same canvas.
 */
const _chartInstances = new Map();

/* ---- Shared Defaults ---- */

/**
 * Build the shared dark-theme tooltip configuration.
 */
function _tooltipConfig() {
  return {
    enabled: true,
    backgroundColor: 'rgba(17,24,39,0.95)',
    titleColor: '#e2e8f0',
    bodyColor: CHART_COLORS.tooltipColor,
    borderColor: CHART_COLORS.tooltipBorder,
    borderWidth: 1,
    cornerRadius: 10,
    padding: 12,
    boxPadding: 6,
    usePointStyle: true,
    titleFont: { weight: '600', size: 13 },
    bodyFont: { size: 12 },
    displayColors: true,
    caretSize: 6,
  };
}

/**
 * Build shared grid + tick styling for scales.
 */
function _scaleDefaults(showX = true, showY = true) {
  const axis = (show) => ({
    display: show,
    grid: {
      color: CHART_COLORS.gridColor,
      drawBorder: false,
    },
    ticks: {
      color: CHART_COLORS.tickColor,
      font: { size: 11 },
      padding: 8,
    },
    border: { display: false },
  });
  return { x: axis(showX), y: axis(showY) };
}

/* ---- Helpers ---- */

/**
 * Safely get a canvas 2D context by id.
 * Returns null when the element does not exist.
 */
function _getCtx(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`usageChart: canvas #${canvasId} not found`);
    return null;
  }
  return canvas.getContext('2d');
}

/**
 * Create a vertical gradient for line / area fills.
 */
function _verticalGradient(ctx, color, alphaTop = 0.35, alphaBottom = 0) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  gradient.addColorStop(0, _rgba(color, alphaTop));
  gradient.addColorStop(1, _rgba(color, alphaBottom));
  return gradient;
}

/**
 * Convert a hex colour to rgba string.
 */
function _rgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ============================================================
   Public API
   ============================================================ */

/**
 * Destroy an existing chart instance on a given canvas.
 * @param {string} canvasId
 */
export function destroyChart(canvasId) {
  const existing = _chartInstances.get(canvasId);
  if (existing) {
    existing.destroy();
    _chartInstances.delete(canvasId);
  }
}

/**
 * Render a line chart.
 *
 * @param {string} canvasId  – DOM id of the <canvas> element
 * @param {string[]} labels  – X-axis labels
 * @param {Array<Object>} datasets – Array of { label, data, color? }
 * @param {Object} options   – Extra Chart.js options to merge
 */
export function renderLineChart(canvasId, labels, datasets, options = {}) {
  destroyChart(canvasId);

  const ctx = _getCtx(canvasId);
  if (!ctx) return null;

  const builtDatasets = datasets.map((ds, i) => {
    const color = ds.color || CHART_COLORS.palette[i % CHART_COLORS.palette.length];
    return {
      label: ds.label || `Series ${i + 1}`,
      data: ds.data,
      borderColor: color,
      backgroundColor: _verticalGradient(ctx, color, 0.3, 0),
      borderWidth: 2.5,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: color,
      pointBorderColor: 'rgba(17,24,39,0.8)',
      pointBorderWidth: 2,
      pointHoverBorderColor: '#fff',
      ...ds,
      // Keep color overrides above from being overwritten
      color: undefined,
    };
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: builtDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            color: CHART_COLORS.tickColor,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 12 },
          },
        },
        tooltip: _tooltipConfig(),
      },
      scales: _scaleDefaults(),
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
      layout: { padding: { top: 4 } },
      ...options,
    },
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render a doughnut chart.
 *
 * @param {string}   canvasId
 * @param {string[]} labels
 * @param {number[]} data
 * @param {string[]} colors – Hex colours; falls back to CHART_COLORS.palette
 */
export function renderDoughnutChart(canvasId, labels, data, colors) {
  destroyChart(canvasId);

  const ctx = _getCtx(canvasId);
  if (!ctx) return null;

  const palette = colors || CHART_COLORS.palette.slice(0, data.length);

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette,
        borderColor: 'rgba(17,24,39,0.6)',
        borderWidth: 2,
        hoverBorderColor: '#fff',
        borderRadius: 6,
        spacing: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART_COLORS.tickColor,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { size: 12 },
          },
        },
        tooltip: _tooltipConfig(),
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 900,
        easing: 'easeOutQuart',
      },
    },
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render a bar chart.
 *
 * @param {string}   canvasId
 * @param {string[]} labels
 * @param {number[]} data
 * @param {string[]} colors – Per-bar colours (or a single-element array for uniform)
 */
export function renderBarChart(canvasId, labels, data, colors) {
  destroyChart(canvasId);

  const ctx = _getCtx(canvasId);
  if (!ctx) return null;

  const palette = colors || CHART_COLORS.palette.slice(0, data.length);
  const bgColors = palette.length === 1
    ? data.map(() => palette[0])
    : palette;

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors.map(c => _rgba(c, 0.75)),
        hoverBackgroundColor: bgColors,
        borderColor: bgColors,
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 40,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: _tooltipConfig(),
      },
      scales: {
        ..._scaleDefaults(),
        y: {
          ..._scaleDefaults().y,
          beginAtZero: true,
        },
      },
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
    },
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render an area chart (filled line chart with multiple datasets).
 *
 * @param {string}   canvasId
 * @param {string[]} labels
 * @param {Array<Object>} datasets – Array of { label, data, color? }
 */
export function renderAreaChart(canvasId, labels, datasets) {
  destroyChart(canvasId);

  const ctx = _getCtx(canvasId);
  if (!ctx) return null;

  const builtDatasets = datasets.map((ds, i) => {
    const color = ds.color || CHART_COLORS.palette[i % CHART_COLORS.palette.length];
    return {
      label: ds.label || `Area ${i + 1}`,
      data: ds.data,
      borderColor: color,
      backgroundColor: _verticalGradient(ctx, color, 0.45, 0.02),
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHitRadius: 10,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: color,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    };
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: builtDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            color: CHART_COLORS.tickColor,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 12 },
          },
        },
        tooltip: _tooltipConfig(),
        filler: { propagate: true },
      },
      scales: {
        ..._scaleDefaults(),
        y: {
          ..._scaleDefaults().y,
          beginAtZero: true,
        },
      },
      animation: {
        duration: 900,
        easing: 'easeOutQuart',
      },
    },
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}
