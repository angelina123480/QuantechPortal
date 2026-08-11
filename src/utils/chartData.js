const { STATUS_COLORS, PRIORITY_COLORS } = require('../config/constants');

// Sorted descending, zero-value entries dropped so the chart only shows what exists.
function buildBarData(counts, order) {
  const items = order
    .map((label) => ({ label, value: counts[label] || 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  return { type: 'bar', items };
}

function buildDonutData(counts, order, colorMap, totalLabel) {
  const items = order
    .map((label) => ({
      label,
      value: counts[label] || 0,
      color: colorMap[label].dot,
      textColor: colorMap[label].fg,
    }))
    .filter((item) => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return { type: 'donut', total, totalLabel, items };
}

function buildStatusDonut(counts, statuses) {
  return buildDonutData(counts, statuses, STATUS_COLORS, 'Tickets');
}

function buildPriorityDonut(counts, priorities) {
  return buildDonutData(counts, priorities, PRIORITY_COLORS, 'Tickets');
}

module.exports = { buildBarData, buildDonutData, buildStatusDonut, buildPriorityDonut };
