(function () {
  'use strict';

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
      },
      body: 'technicianId=' + encodeURIComponent(technicianId),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        return res.json();
      })
      .then(function (data) {
        var row = select.closest('tr');
        if (row && data.ticket) {
          row.setAttribute('data-technician', data.ticket.assignedTechnicianId || '__unassigned');
          row.setAttribute('data-status', data.ticket.status);
          var statusCell = row.querySelector('[data-label="Status"]');
          if (statusCell) {
            var slug = data.ticket.status.toLowerCase().replace(/ /g, '-');
            statusCell.innerHTML = '<span class="badge badge-status-' + slug + '">' + data.ticket.status + '</span>';
          }
        }
        if (window.QT) window.QT.toast('Technician assignment updated.', 'success');
      })
      .catch(function () {
        if (window.QT) window.QT.toast('Could not update assignment. Please try again.', 'error');
      })
      .finally(function () {
        select.disabled = false;
      });
  });
})();
