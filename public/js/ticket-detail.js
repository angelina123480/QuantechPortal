(function () {
  'use strict';

  // ---------- Auto-submit selects (status / priority / assign) ----------
  document.querySelectorAll('select.auto-submit').forEach(function (select) {
    select.addEventListener('change', function () {
      var form = select.closest('form');
      if (form) form.submit();
    });
  });

  // ---------- Confirm before destructive/irreversible actions ----------
  document.querySelectorAll('.js-confirm').forEach(function (formOrBtn) {
    formOrBtn.addEventListener('submit', function (event) {
      var message = formOrBtn.getAttribute('data-confirm') || 'Are you sure?';
      if (!window.confirm(message)) event.preventDefault();
    });
  });

  // ---------- Reply form: submit via fetch, append to conversation ----------
  var replyForm = document.getElementById('replyForm');
  var conversationList = document.getElementById('conversationList');
  if (!replyForm || !conversationList) return;

  var textarea = replyForm.querySelector('textarea[name="message"]');
  var internalCheckbox = replyForm.querySelector('input[name="internal"]');

  function timeString(iso) {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function appendEntry(entry, isStaffAuthor) {
    var item = document.createElement('div');
    item.className = 'conversation-item' + (isStaffAuthor ? ' is-staff' : '') + (entry.internal ? ' is-internal' : '');

    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = entry.authorName.split(' ').map(function (n) { return n[0]; }).join('').slice(0, 2).toUpperCase();
    item.appendChild(avatar);

    var bubble = document.createElement('div');
    bubble.className = 'conversation-bubble';

    var header = document.createElement('div');
    header.className = 'conversation-header';
    header.innerHTML =
      '<span class="conversation-author">' + escapeHtml(entry.authorName) + '</span>' +
      (entry.internal ? '<span class="internal-note-tag">Internal note</span>' : '') +
      '<span class="conversation-time">' + timeString(entry.timestamp) + '</span>';
    bubble.appendChild(header);

    var message = document.createElement('div');
    message.className = 'conversation-message';
    message.textContent = entry.message;
    bubble.appendChild(message);

    item.appendChild(bubble);
    conversationList.appendChild(item);
    item.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  replyForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var message = textarea.value.trim();
    if (!message) {
      if (window.QT) window.QT.toast('Message cannot be empty.', 'error');
      return;
    }

    var submitBtn = replyForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    var body = 'message=' + encodeURIComponent(message);
    if (internalCheckbox && internalCheckbox.checked) body += '&internal=on';

    fetch(replyForm.getAttribute('action'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'fetch',
        Accept: 'application/json',
      },
      body: body,
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then(function (data) {
        var entries = data.ticket.history;
        var latest = entries[entries.length - 1];
        appendEntry(latest, !!latest.isStaffAuthor);
        textarea.value = '';
        if (internalCheckbox) internalCheckbox.checked = false;
        if (window.QT) window.QT.toast('Reply posted.', 'success');
      })
      .catch(function () {
        if (window.QT) window.QT.toast('Could not post your reply. Please try again.', 'error');
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();
