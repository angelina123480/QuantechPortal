(function () {
  'use strict';

  // Row click navigates to the project, same pattern as tickets.js — this
  // page is always server-filtered (real GET form), so no client-side
  // instant-filter logic is needed here, just the click-to-navigate part.
  var table = document.getElementById('projectsTable');
  if (table) {
    var tbody = table.querySelector('tbody');
    tbody.addEventListener('click', function (event) {
      var row = event.target.closest('tr.is-clickable');
      if (!row) return;
      if (event.target.closest('a, select, button, input')) return;
      var href = row.getAttribute('data-href');
      if (href) window.location.href = href;
    });
  }

  // Company -> sub-client cascading select on the create-project form, same
  // technique as create-ticket.js's category -> subcategory picker.
  var companySelect = document.getElementById('company');
  var subClientSelect = document.getElementById('subClientId');
  if (companySelect && subClientSelect) {
    var subClientMap = [];
    try {
      subClientMap = JSON.parse(companySelect.getAttribute('data-subclient-map') || '[]');
    } catch (e) { /* ignore malformed map, sub-client picker just stays empty */ }

    function populateSubClients() {
      var current = subClientSelect.value;
      subClientSelect.innerHTML = '<option value="">None (whole company)</option>';
      subClientMap
        .filter(function (s) { return s.parentCompany === companySelect.value; })
        .forEach(function (s) {
          var opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          if (s.id === current) opt.selected = true;
          subClientSelect.appendChild(opt);
        });
    }

    companySelect.addEventListener('change', populateSubClients);
    populateSubClients();
  }
})();
