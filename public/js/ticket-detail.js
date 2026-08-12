(function () {
  'use strict';

  // ---------- Canned response picker ----------
  var cannedPicker = document.getElementById('cannedResponsePicker');
  var messageBox = document.getElementById('message');
  if (cannedPicker && messageBox) {
    cannedPicker.addEventListener('change', function () {
      var option = cannedPicker.options[cannedPicker.selectedIndex];
      var body = option ? option.getAttribute('data-body') : '';
      if (body) {
        messageBox.value = messageBox.value ? messageBox.value + '\n\n' + body : body;
        messageBox.focus();
      }
      cannedPicker.value = '';
    });
  }

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

    // FormData (not a hand-built urlencoded string) so any attached files
    // and the CSRF hidden field main.js injected both ride along correctly.
    var body = new FormData(replyForm);

    fetch(replyForm.getAttribute('action'), {
      method: 'POST',
      headers: {
        'X-Requested-With': 'fetch',
        Accept: 'application/json',
        'X-CSRF-Token': window.QT && window.QT.csrfToken,
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
        replyForm.reset();
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
