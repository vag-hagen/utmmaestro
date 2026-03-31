/**
 * Makes table columns sortable by clicking headers.
 *
 * Usage:
 *   const sorter = Sortable.init(tableElement, { onSort: (rows, col, dir) => re-render })
 *   sorter.sort(rows)  — returns sorted copy based on current state
 *
 * Headers get a `data-sort-key` attribute to identify the column.
 * Clicking toggles asc → desc → none.
 */
const Sortable = (() => {

  function init(table, opts = {}) {
    const headers = table.querySelectorAll('thead th[data-sort-key]');
    const state = { col: null, dir: null }; // dir: 'asc' | 'desc' | null

    headers.forEach(th => {
      th.classList.add('sortable-th');
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        if (state.col === key) {
          state.dir = state.dir === 'asc' ? 'desc' : state.dir === 'desc' ? null : 'asc';
        } else {
          state.col = key;
          state.dir = 'asc';
        }
        if (state.dir === null) state.col = null;

        // Update header indicators
        headers.forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
        });
        if (state.dir) th.classList.add(`sort-${state.dir}`);

        if (opts.onSort) opts.onSort(state.col, state.dir);
      });
    });

    function sort(rows) {
      if (!state.col || !state.dir) return rows;
      const key = state.col;
      const mult = state.dir === 'asc' ? 1 : -1;
      return [...rows].sort((a, b) => {
        let va = a[key], vb = b[key];
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
        return String(va).localeCompare(String(vb), undefined, { numeric: true }) * mult;
      });
    }

    return { sort, state };
  }

  return { init };
})();
