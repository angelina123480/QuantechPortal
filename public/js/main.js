(function () {
  'use strict';

  // ---------- CSRF token: inject into every POST form + expose for fetch() callers ----------
  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';
  document.querySelectorAll('form').forEach(function (form) {
    if (form.method.toLowerCase() !== 'post' || form.querySelector('input[name="_csrf"]')) return;
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.setAttribute('value', csrfToken); // via attribute so form.reset() doesn't blank it
    form.appendChild(input);
  });
  window.QT = window.QT || {};
  window.QT.csrfToken = csrfToken;

  // ---------- Auto-submit selects (status / priority / assign / filters) ----------
  document.querySelectorAll('select.auto-submit').forEach(function (select) {
    select.addEventListener('change', function () {
      var form = select.closest('form');
      if (form) form.submit();
    });
  });

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

  // ---------- Dark mode toggle ----------
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var root = document.documentElement;
      var current = root.getAttribute('data-theme');
      var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDarkNow = current === 'dark' || (!current && systemPrefersDark);
      var next = isDarkNow ? 'light' : 'dark';

      root.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem('qt-theme', next);
      } catch (e) {
        // localStorage unavailable — theme just won't persist across reloads.
      }
    });
  }

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

  // ---------- Conditional "staff only" fields (e.g. temp password on user create) ----------
  document.querySelectorAll('select[data-staff-roles]').forEach(function (select) {
    var staffRoles = select.getAttribute('data-staff-roles').split(',');
    var targets = document.querySelectorAll('[data-staff-only-field]');
    function toggle() {
      var isStaff = staffRoles.indexOf(select.value) !== -1;
      targets.forEach(function (el) {
        el.style.display = isStaff ? '' : 'none';
        var input = el.querySelector('input');
        if (input) input.required = isStaff;
      });
    }
    select.addEventListener('change', toggle);
    toggle();
  });

  // ---------- Section-nav tabs (e.g. company detail Overview/Users/Sub-clients/...) ----------
  document.querySelectorAll('[data-section-tabs]').forEach(function (nav) {
    var tabs = nav.querySelectorAll('[data-section-tab]');
    var panels = document.querySelectorAll('[data-section-panel]');
    function activate(id) {
      tabs.forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-section-tab') === id); });
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-section-panel') !== id; });
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        activate(t.getAttribute('data-section-tab'));
        history.replaceState(null, '', '#' + t.getAttribute('data-section-tab'));
      });
    });
    var initial = (location.hash || '').slice(1);
    var hasInitial = initial && nav.querySelector('[data-section-tab="' + initial + '"]');
    activate(hasInitial ? initial : tabs[0].getAttribute('data-section-tab'));
  });
})();
