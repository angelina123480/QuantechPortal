(function () {
  'use strict';

  // ---------- Mobile sidebar toggle ----------
  var toggle = document.getElementById('sidebarToggle');
  var overlay = document.getElementById('sidebarOverlay');

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    var isOpen = document.body.classList.toggle('sidebar-open');
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
  }

  if (toggle) toggle.addEventListener('click', toggleSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // ---------- Toasts ----------
  var container = document.getElementById('toastContainer');

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/></svg>',
  };

  function toast(message, type) {
    if (!container) return;
    type = type === 'error' || type === 'info' ? type : 'success';

    var el = document.createElement('div');
    el.className = 'toast is-' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = (ICONS[type] || '') + '<span></span>';
    el.querySelector('span').textContent = message;

    container.appendChild(el);
    window.setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity 200ms ease';
      window.setTimeout(function () { el.remove(); }, 220);
    }, 4200);
  }

  // ---------- Simple modal open/close (data-modal-target / data-modal-close) ----------
  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-modal-target]');
    if (opener) {
      var modal = document.getElementById(opener.getAttribute('data-modal-target'));
      if (modal) modal.classList.add('is-open');
    }
    var closer = event.target.closest('[data-modal-close]');
    if (closer) {
      var overlayEl = closer.closest('.modal-overlay');
      if (overlayEl) overlayEl.classList.remove('is-open');
    }
  });

  window.QT = window.QT || {};
  window.QT.toast = toast;
})();
