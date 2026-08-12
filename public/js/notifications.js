(function () {
  'use strict';

  var bell = document.getElementById('notificationBell');
  var badge = document.getElementById('notificationBadge');
  var dropdown = document.getElementById('notificationDropdown');
  var list = document.getElementById('notificationDropdownList');
  if (!bell || !badge || !dropdown || !list) return;

  function csrfHeaders(extra) {
    var headers = { 'X-CSRF-Token': window.QT && window.QT.csrfToken };
    return extra ? Object.assign(headers, extra) : headers;
  }

  function timeAgo(iso) {
    var diffMs = Date.now() - new Date(iso).getTime();
    var mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.round(hours / 24) + 'd ago';
  }

  function refreshBadge() {
    fetch('/notifications/unread-count')
      .then(function (res) { return res.ok ? res.json() : { count: 0 }; })
      .then(function (data) {
        if (data.count > 0) {
          badge.hidden = false;
          badge.textContent = data.count > 99 ? '99+' : String(data.count);
        } else {
          badge.hidden = true;
        }
      })
      .catch(function () {});
  }

  function renderItem(n) {
    var row = document.createElement('div');
    // Every item rendered here has already been marked read (see loadRecent) —
    // "seen" and "read" happen in the same step, so the delete control shows immediately.
    row.className = 'notification-dropdown-item';

    var link = document.createElement('a');
    link.className = 'notification-dropdown-item-link';
    link.href = n.ticketId ? '/tickets/' + n.ticketId : '/notifications';
    link.innerHTML = '<span class="notification-dropdown-item-title"></span><span class="notification-dropdown-item-time"></span>';
    link.querySelector('.notification-dropdown-item-title').textContent = n.title;
    link.querySelector('.notification-dropdown-item-time').textContent = timeAgo(n.createdAt);
    row.appendChild(link);

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'notification-dropdown-item-delete';
    del.setAttribute('aria-label', 'Remove notification');
    del.textContent = '×';
    del.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      del.disabled = true;
      fetch('/notifications/' + n.id + '/delete', {
        method: 'POST',
        headers: csrfHeaders({ Accept: 'application/json' }),
      })
        .then(function () {
          row.remove();
          if (!list.querySelector('.notification-dropdown-item')) {
            list.innerHTML = '<p class="text-muted notification-dropdown-empty">No notifications yet.</p>';
          }
        })
        .catch(function () { del.disabled = false; });
    });
    row.appendChild(del);

    return row;
  }

  function loadRecent() {
    list.innerHTML = '<p class="text-muted notification-dropdown-empty">Loading&hellip;</p>';
    // Mark everything read before rendering, so items appear grey (not blue) the
    // moment they're seen, and their delete control is available right away.
    fetch('/notifications/read-all', { method: 'POST', headers: csrfHeaders() })
      .catch(function () {})
      .then(function () {
        refreshBadge();
        return fetch('/notifications/recent');
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var notifications = data.notifications || [];
        if (notifications.length === 0) {
          list.innerHTML = '<p class="text-muted notification-dropdown-empty">No notifications yet.</p>';
          return;
        }
        list.innerHTML = '';
        notifications.forEach(function (n) { list.appendChild(renderItem(n)); });
      })
      .catch(function () {
        list.innerHTML = '<p class="text-muted notification-dropdown-empty">Could not load notifications.</p>';
      });
  }

  bell.addEventListener('click', function (event) {
    event.stopPropagation();
    var willOpen = dropdown.hidden;
    dropdown.hidden = !willOpen;
    bell.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) loadRecent();
  });

  document.addEventListener('click', function (event) {
    if (!dropdown.hidden && !dropdown.contains(event.target) && event.target !== bell) {
      dropdown.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
    }
  });

  refreshBadge();
  window.setInterval(refreshBadge, 30000);
})();
