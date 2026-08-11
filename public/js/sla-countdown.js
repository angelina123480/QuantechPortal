(function () {
  'use strict';

  var els = document.querySelectorAll('[data-sla-due]');
  if (els.length === 0) return;

  function formatDuration(ms) {
    var totalMinutes = Math.floor(Math.abs(ms) / 60000);
    var days = Math.floor(totalMinutes / (60 * 24));
    var hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    var minutes = totalMinutes % 60;

    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + minutes + 'm';
    return minutes + 'm';
  }

  function tick() {
    var now = Date.now();
    els.forEach(function (el) {
      var due = new Date(el.getAttribute('data-sla-due')).getTime();
      var diff = due - now;
      var overdue = diff <= 0;
      el.textContent = overdue
        ? 'Overdue by ' + formatDuration(diff)
        : formatDuration(diff) + ' remaining';
      el.classList.toggle('sla-countdown-overdue', overdue);
      el.classList.toggle('sla-countdown-ok', !overdue);
    });
  }

  tick();
  window.setInterval(tick, 30000);
})();
