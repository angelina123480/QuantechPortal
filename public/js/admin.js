(function () {
  'use strict';

  function statusSlug(status) {
    return status.toLowerCase().replace(/ /g, '-');
  }

  function updateRowFromTicket(row, ticket) {
    row.setAttribute('data-technician', ticket.assignedTechnicianId || '__unassigned');
    row.setAttribute('data-status', ticket.status);
    row.setAttribute('data-priority', ticket.priority);

    var statusCell = row.querySelector('[data-label="Status"]');
    if (statusCell) {
      statusCell.innerHTML = '<span class="badge badge-status-' + statusSlug(ticket.status) + '">' + ticket.status + '</span>';
    }

    var priorityCell = row.querySelector('[data-label="Priority"]');
    if (priorityCell) {
      priorityCell.innerHTML = '<span class="badge badge-priority-' + ticket.priority.toLowerCase() + '">' + ticket.priority + '</span>';
    }

    var assignSelect = row.querySelector('.assign-select');
    if (assignSelect) assignSelect.value = ticket.assignedTechnicianId || '';

    var numberCell = row.querySelector('[data-label="Ticket #"]');
    if (numberCell) {
      var overdueBadge = numberCell.querySelector('.badge-overdue');
      if (ticket.isOverdue && !overdueBadge) {
        numberCell.insertAdjacentHTML('beforeend', ' <span class="badge badge-overdue">Overdue</span>');
      } else if (!ticket.isOverdue && overdueBadge) {
        overdueBadge.remove();
      }
    }
  }

  // ---------- Single-row technician assignment (inline select in the table) ----------
  document.addEventListener('change', function (event) {
    var select = event.target.closest('.assign-select');
    if (!select) return;

    var ticketId = select.getAttribute('data-ticket-id');
    var technicianId = select.value;
    select.disabled = true;

    fetch('/tickets/' + ticketId + '/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'fetch',
        Accept: 'application/json',
        'X-CSRF-Token': window.QT && window.QT.csrfToken,
      },
      body: 'technicianId=' + encodeURIComponent(technicianId),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then(function (data) {
        var row = select.closest('tr');
        if (row && data.ticket) updateRowFromTicket(row, data.ticket);
        if (window.QT) window.QT.toast('Technician assignment updated.', 'success');
      })
      .catch(function () {
        if (window.QT) window.QT.toast('Could not update assignment. Please try again.', 'error');
      })
      .finally(function () {
        select.disabled = false;
      });
  });

  // ---------- Bulk selection + bulk actions ----------
  var table = document.getElementById('ticketsTable');
  if (!table) return;

  var tbody = table.querySelector('tbody');
  var selectAll = document.getElementById('selectAllTickets');
  var bar = document.getElementById('bulkActionBar');
  var countLabel = document.getElementById('bulkSelectedCount');
  var assignSelect = document.getElementById('bulkAssignSelect');
  var assignApply = document.getElementById('bulkAssignApply');
  var statusSelect = document.getElementById('bulkStatusSelect');
  var statusApply = document.getElementById('bulkStatusApply');
  var clearBtn = document.getElementById('bulkClear');

  var selected = new Set();

  function rowCheckboxes() {
    return Array.prototype.slice.call(tbody.querySelectorAll('.row-select'));
  }

  function refreshBar() {
    var count = selected.size;
    if (bar) bar.hidden = count === 0;
    if (countLabel) countLabel.textContent = count + ' selected';
    if (assignApply) assignApply.disabled = count === 0;
    if (statusApply) statusApply.disabled = count === 0;

    var visible = rowCheckboxes().filter(function (cb) { return !cb.closest('tr').hidden; });
    var visibleChecked = visible.filter(function (cb) { return selected.has(cb.value); });
    if (selectAll) {
      selectAll.checked = visible.length > 0 && visibleChecked.length === visible.length;
      selectAll.indeterminate = visibleChecked.length > 0 && visibleChecked.length < visible.length;
    }
  }

  function clearSelection() {
    selected.clear();
    rowCheckboxes().forEach(function (cb) { cb.checked = false; });
    refreshBar();
  }

  tbody.addEventListener('change', function (event) {
    var cb = event.target.closest('.row-select');
    if (!cb) return;
    if (cb.checked) selected.add(cb.value);
    else selected.delete(cb.value);
    refreshBar();
  });

  if (selectAll) {
    selectAll.addEventListener('change', function () {
      var visible = rowCheckboxes().filter(function (cb) { return !cb.closest('tr').hidden; });
      visible.forEach(function (cb) {
        cb.checked = selectAll.checked;
        if (selectAll.checked) selected.add(cb.value);
        else selected.delete(cb.value);
      });
      refreshBar();
    });
  }

  // Changing any filter/search invalidates which rows are "visible" — simplest
  // predictable behavior is to drop the current selection rather than silently
  // keep acting on now-hidden rows.
  ['ticketSearch', 'filterStatus', 'filterPriority', 'filterCategory', 'filterTechnician'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', clearSelection);
  });

  if (clearBtn) clearBtn.addEventListener('click', clearSelection);

  function applyBulk(url, body, doneMessage) {
    var ids = Array.from(selected);
    if (ids.length === 0) return;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': window.QT && window.QT.csrfToken,
      },
      body: JSON.stringify(Object.assign({ ticketIds: ids }, body)),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then(function (data) {
        var byId = {};
        (data.tickets || []).forEach(function (t) { byId[t.id] = t; });
        rowCheckboxes().forEach(function (cb) {
          var ticket = byId[cb.value];
          if (ticket) updateRowFromTicket(cb.closest('tr'), ticket);
        });
        if (window.QT) window.QT.toast(doneMessage, 'success');
        clearSelection();
      })
      .catch(function () {
        if (window.QT) window.QT.toast('Bulk update failed. Please try again.', 'error');
      });
  }

  if (assignApply) {
    assignApply.addEventListener('click', function () {
      if (!assignSelect.value) return;
      var technicianId = assignSelect.value === '__none' ? '' : assignSelect.value;
      assignApply.disabled = true;
      applyBulk('/tickets/bulk/assign', { technicianId: technicianId }, 'Technician assignment updated.')
        .finally(function () { assignApply.disabled = false; assignSelect.value = ''; });
    });
  }

  if (statusApply) {
    statusApply.addEventListener('click', function () {
      if (!statusSelect.value) return;
      var status = statusSelect.value;
      statusApply.disabled = true;
      applyBulk('/tickets/bulk/status', { status: status }, 'Status updated.')
        .finally(function () { statusApply.disabled = false; statusSelect.value = ''; });
    });
  }

  refreshBar();
})();
