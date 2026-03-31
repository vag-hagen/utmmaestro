/**
 * Lightweight custom context menu.
 *
 * Usage:
 *   ContextMenu.show(x, y, [
 *     { label: 'Download SVG', action: () => ... },
 *     { label: 'Download PNG', action: () => ... },
 *   ]);
 */
const ContextMenu = (() => {
  let el = null;

  function create() {
    el = document.createElement('div');
    el.className = 'ctx-menu hidden';
    document.body.appendChild(el);
    document.addEventListener('click', hide);
    document.addEventListener('contextmenu', hide);
    window.addEventListener('scroll', hide, true);
  }

  function show(x, y, items) {
    if (!el) create();
    el.innerHTML = items.map((item, i) =>
      `<div class="ctx-item" data-idx="${i}">${item.label}</div>`
    ).join('');
    el.classList.remove('hidden');

    // Position, keep on screen
    el.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    el.style.top  = `${Math.min(y, window.innerHeight - items.length * 36 - 10)}px`;

    el.onclick = e => {
      const item = e.target.closest('.ctx-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      hide();
      items[idx]?.action();
    };
  }

  function hide() {
    if (el) el.classList.add('hidden');
  }

  return { show };
})();
