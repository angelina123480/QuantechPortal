(function () {
  'use strict';

  var searchInput = document.getElementById('kbSearch');
  var grid = document.getElementById('kbGrid');
  var emptyState = document.getElementById('kbEmptyState');
  if (!searchInput || !grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.kb-article-card'));

  function filter() {
    var q = searchInput.value.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var show = !q || card.getAttribute('data-search').indexOf(q) !== -1;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (emptyState) emptyState.hidden = visible !== 0;
  }

  searchInput.addEventListener('input', filter);

  // Prevent the fallback GET submit when JS is filtering live client-side.
  var form = searchInput.closest('form');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      filter();
    });
  }
})();
