(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'text') node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    }
    return node;
  }

  // Sparse screen-reader-only data table so the chart's values are available
  // to anyone not reading the visual encoding.
  function buildDataTable(caption, rows) {
    var table = el('table', { class: 'sr-only' });
    var cap = el('caption', { text: caption });
    table.appendChild(cap);
    var tbody = el('tbody');
    rows.forEach(function (row) {
      var tr = el('tr');
      var th = el('th', { scope: 'row', text: row.label });
      var td = el('td', { text: String(row.value) });
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderBarChart(container, data) {
    var items = data.items || [];
    if (items.length === 0) {
      container.appendChild(el('p', { class: 'text-muted', text: 'No data yet.' }));
      return;
    }
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    var wrap = el('div', { class: 'bar-chart', role: 'img', 'aria-label': container.getAttribute('data-chart-title') || 'Bar chart' });

    items.forEach(function (item) {
      var row = el('div', { class: 'bar-chart-row' });
      row.appendChild(el('span', { class: 'bar-chart-label', text: item.label }));

      var track = el('div', { class: 'bar-chart-track' });
      var fill = el('div', { class: 'bar-chart-fill' });
      fill.style.width = Math.max(3, Math.round((item.value / max) * 100)) + '%';
      track.appendChild(fill);
      row.appendChild(track);

      row.appendChild(el('span', { class: 'bar-chart-value', text: String(item.value) }));
      wrap.appendChild(row);
    });

    container.appendChild(wrap);
    container.appendChild(buildDataTable(container.getAttribute('data-chart-title') || 'Chart data', items));
  }

  function renderDonutChart(container, data) {
    var items = data.items || [];
    if (items.length === 0 || !data.total) {
      container.appendChild(el('p', { class: 'text-muted', text: 'No data yet.' }));
      return;
    }

    var wrap = el('div', { class: 'donut-chart-wrap' });
    var size = 148;
    var cx = size / 2;
    var cy = size / 2;
    var r = 58;
    var strokeWidth = 18;
    var circumference = 2 * Math.PI * r;
    var gapDeg = items.length > 1 ? 3 : 0;
    var gapLen = (gapDeg / 360) * circumference;

    var svg = svgEl('svg', {
      class: 'donut-chart-svg',
      viewBox: '0 0 ' + size + ' ' + size,
      role: 'img',
      'aria-label': container.getAttribute('data-chart-title') || 'Donut chart',
    });

    var track = svgEl('circle', {
      cx: cx, cy: cy, r: r, fill: 'none', stroke: 'var(--color-gray-100)', 'stroke-width': strokeWidth,
    });
    svg.appendChild(track);

    var group = svgEl('g', { transform: 'rotate(-90 ' + cx + ' ' + cy + ')' });
    var offset = 0;

    items.forEach(function (item) {
      var fraction = item.value / data.total;
      var rawLen = fraction * circumference;
      var segLen = Math.max(0, rawLen - gapLen);
      var circle = svgEl('circle', {
        cx: cx, cy: cy, r: r, fill: 'none', stroke: item.color, 'stroke-width': strokeWidth,
        'stroke-linecap': items.length > 1 ? 'round' : 'butt',
        'stroke-dasharray': segLen + ' ' + (circumference - segLen),
        'stroke-dashoffset': -offset,
      });
      group.appendChild(circle);
      offset += rawLen;
    });
    svg.appendChild(group);

    var centerValue = svgEl('text', {
      x: cx, y: cy - 2, 'text-anchor': 'middle', class: 'donut-center-value',
    });
    centerValue.textContent = data.total;
    var centerLabel = svgEl('text', {
      x: cx, y: cy + 16, 'text-anchor': 'middle', class: 'donut-center-label',
    });
    centerLabel.textContent = data.totalLabel || '';
    svg.appendChild(centerValue);
    svg.appendChild(centerLabel);

    wrap.appendChild(svg);

    var legend = el('div', { class: 'donut-legend' });
    items.forEach(function (item) {
      var row = el('div', { class: 'donut-legend-item' });
      var dot = el('span', { class: 'donut-legend-dot' });
      dot.style.background = item.color;
      row.appendChild(dot);
      row.appendChild(el('span', { text: item.label }));
      row.appendChild(el('span', { class: 'donut-legend-value', text: String(item.value) }));
      legend.appendChild(row);
    });
    wrap.appendChild(legend);

    container.appendChild(wrap);
    container.appendChild(buildDataTable(container.getAttribute('data-chart-title') || 'Chart data', items));
  }

  function renderLineChart(container, data) {
    var items = data.items || [];
    if (items.length === 0) {
      container.appendChild(el('p', { class: 'text-muted', text: 'No data yet.' }));
      return;
    }
    var width = 640;
    var height = 200;
    var padding = { top: 10, right: 10, bottom: 24, left: 10 };
    var innerW = width - padding.left - padding.right;
    var innerH = height - padding.top - padding.bottom;
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));

    var svg = svgEl('svg', {
      class: 'line-chart-svg', viewBox: '0 0 ' + width + ' ' + height, preserveAspectRatio: 'none',
      role: 'img', 'aria-label': container.getAttribute('data-chart-title') || 'Line chart',
    });

    var stepX = items.length > 1 ? innerW / (items.length - 1) : 0;
    var points = items.map(function (item, i) {
      var x = padding.left + i * stepX;
      var y = padding.top + innerH - (item.value / max) * innerH;
      return [x, y];
    });

    var linePath = points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1]; }).join(' ');
    var areaPath = linePath + ' L' + points[points.length - 1][0] + ' ' + (padding.top + innerH) + ' L' + points[0][0] + ' ' + (padding.top + innerH) + ' Z';

    svg.appendChild(svgEl('path', { d: areaPath, fill: 'var(--color-accent-light)', stroke: 'none' }));
    svg.appendChild(svgEl('path', { d: linePath, fill: 'none', stroke: 'var(--color-accent)', 'stroke-width': 2 }));

    var labelEvery = Math.ceil(items.length / 8);
    items.forEach(function (item, i) {
      if (i % labelEvery !== 0 && i !== items.length - 1) return;
      var text = svgEl('text', { x: points[i][0], y: height - 6, 'text-anchor': 'middle', class: 'line-chart-axis-label' });
      text.textContent = item.label;
      svg.appendChild(text);
    });

    var wrap = el('div', { class: 'line-chart-wrap' });
    wrap.appendChild(svg);
    container.appendChild(wrap);
    container.appendChild(buildDataTable(container.getAttribute('data-chart-title') || 'Chart data', items));
  }

  function init() {
    document.querySelectorAll('script[data-chart-for]').forEach(function (script) {
      var targetId = script.getAttribute('data-chart-for');
      var target = document.getElementById(targetId);
      if (!target) return;
      var data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        return;
      }
      if (data.type === 'bar') renderBarChart(target, data);
      else if (data.type === 'donut') renderDonutChart(target, data);
      else if (data.type === 'line') renderLineChart(target, data);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
