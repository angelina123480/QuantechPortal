(function () {
  'use strict';

  var table = document.getElementById('ticketsTable');
  if (!table) return;

  var tbody = table.querySelector('tbody');
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  var emptyState = document.getElementById('ticketsEmptyState');
  var rowCount = document.getElementById('ticketsRowCount');

  var searchInput = document.getElementById('ticketSearch');
  var statusSelect = document.getElementById('filterStatus');
  var prioritySelect = document.getElementById('filterPriority');
  var categorySelect = document.getElementById('filterCategory');
  var technicianSelect = document.getElementById('filterTechnician');

  function applyFromQueryString() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('q') && searchInput) searchInput.value = params.get('q');
    if (params.get('status') && statusSelect) statusSelect.value = params.get('status');
    if (params.get('priority') && prioritySelect) prioritySelect.value = params.get('priority');
    if (params.get('category') && categorySelect) categorySelect.value = params.get('category');
    if (params.get('technician') && technicianSelect) technicianSelect.value = params.get('technician');
  }

  function matches(row) {
    var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (q && row.getAttribute('data-search').indexOf(q) === -1) return false;
    if (statusSelect && statusSelect.value && row.getAttribute('data-status') !== statusSelect.value) return false;
    if (prioritySelect && prioritySelect.value && row.getAttribute('data-priority') !== prioritySelect.value) return false;
    if (categorySelect && categorySelect.value && row.getAttribute('data-category') !== categorySelect.value) return false;
    if (technicianSelect && technicianSelect.value && row.getAttribute('data-technician') !== technicianSelect.value) return false;
    return true;
  }

  function filterRows() {
    var visible = 0;
    rows.forEach(function (row) {
      var show = matches(row);
      row.hidden = !show;
      if (show) visible += 1;
    });
    if (emptyState) emptyState.hidden = visible !== 0;
    if (rowCount) rowCount.textContent = visible + ' of ' + rows.length + ' tickets shown';
  }

  [searchInput, statusSelect, prioritySelect, categorySelect, technicianSelect].forEach(function (control) {
    if (!control) return;
    var eventName = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(eventName, filterRows);
  });

  applyFromQueryString();
  filterRows();

  // Whole-row click navigates to the ticket, but clicking an actual link/control
  // inside the row (or selecting text) should behave normally.
  tbody.addEventListener('click', function (event) {
    var row = event.target.closest('tr.is-clickable');
    if (!row) return;
    if (event.target.closest('a, select, button, input')) return;
    var href = row.getAttribute('data-href');
    if (href) window.location.href = href;
  });
})();
