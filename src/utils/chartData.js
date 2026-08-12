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

// tickets: array with createdAt; days: how many trailing days to chart.
function buildTicketsOverTime(tickets, days = 30) {
  const counts = {};
  const now = new Date();
  const labels = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    counts[key] = 0;
    labels.push(key);
  }
  for (const t of tickets) {
    const key = new Date(t.createdAt).toISOString().slice(0, 10);
    if (key in counts) counts[key] += 1;
  }
  return { type: 'line', items: labels.map((key) => ({ label: key.slice(5), value: counts[key] })) };
}

module.exports = { buildBarData, buildDonutData, buildStatusDonut, buildPriorityDonut, buildTicketsOverTime };
