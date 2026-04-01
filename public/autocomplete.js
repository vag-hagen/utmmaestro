/**
 * Custom themed autocomplete dropdown.
 *
 * Usage:
 *   Autocomplete.attach(inputElement, ['option1', 'option2', ...])
 *   Autocomplete.update(inputElement, ['new', 'options'])
 *   Autocomplete.setTips(inputElement, { option1: 'description', ... })
 *
 * The input must be inside a <div class="ac-wrap">.
 */
const Autocomplete = (() => {
  const registry = new Map();

  function attach(input, items = []) {
    const wrap = input.closest('.ac-wrap');
    if (!wrap) return;
    wrap.style.position = 'relative';

    const list = document.createElement('div');
    list.className = 'ac-list hidden';
    wrap.appendChild(list);

    const state = { items, tips: {}, activeIdx: -1, visible: false };
    registry.set(input, { list, state });

    input.addEventListener('input', () => show(input));
    input.addEventListener('focus',  () => show(input));
    input.addEventListener('keydown', e => handleKey(input, e));
    input.addEventListener('blur', () => setTimeout(() => hide(input), 150));
  }

  function update(input, items) {
    const entry = registry.get(input);
    if (entry) entry.state.items = items;
  }

  function setTips(input, tips) {
    const entry = registry.get(input);
    if (entry) entry.state.tips = tips || {};
  }

  function show(input) {
    const entry = registry.get(input);
    if (!entry) return;
    const { list, state } = entry;
    const val = input.value.toLowerCase();
    const filtered = state.items.filter(item =>
      item.toLowerCase().includes(val)
    );

    if (filtered.length === 0 || (filtered.length === 1 && filtered[0].toLowerCase() === val)) {
      hide(input);
      return;
    }

    list.innerHTML = '';
    state.activeIdx = -1;
    state.visible = true;

    filtered.forEach((item, idx) => {
      const opt = document.createElement('div');
      opt.className = 'ac-option';
      const tip = state.tips[item];
      if (tip) opt.setAttribute('data-ac-tip', tip);

      // Highlight matching part
      const matchStart = item.toLowerCase().indexOf(val);
      let labelHtml;
      if (val && matchStart >= 0) {
        labelHtml =
          escapeAc(item.slice(0, matchStart)) +
          '<span class="ac-match">' + escapeAc(item.slice(matchStart, matchStart + val.length)) + '</span>' +
          escapeAc(item.slice(matchStart + val.length));
      } else {
        labelHtml = escapeAc(item);
      }

      if (tip) {
        opt.innerHTML = '<span class="ac-label">' + labelHtml + '</span><span class="ac-tip">' + escapeAc(tip) + '</span>';
      } else {
        opt.innerHTML = labelHtml;
      }

      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = item;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        hide(input);
      });
      list.appendChild(opt);
    });

    list.classList.remove('hidden');
  }

  function hide(input) {
    const entry = registry.get(input);
    if (!entry) return;
    entry.list.classList.add('hidden');
    entry.state.visible = false;
    entry.state.activeIdx = -1;
  }

  function handleKey(input, e) {
    const entry = registry.get(input);
    if (!entry || !entry.state.visible) return;
    const { list, state } = entry;
    const opts = list.querySelectorAll('.ac-option');
    if (opts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.activeIdx = Math.min(state.activeIdx + 1, opts.length - 1);
      updateActive(opts, state.activeIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.activeIdx = Math.max(state.activeIdx - 1, 0);
      updateActive(opts, state.activeIdx);
    } else if (e.key === 'Enter' && state.activeIdx >= 0) {
      e.preventDefault();
      input.value = state.items.filter(item =>
        item.toLowerCase().includes(input.value.toLowerCase())
      )[state.activeIdx] || input.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      hide(input);
    } else if (e.key === 'Escape') {
      hide(input);
    }
  }

  function updateActive(opts, idx) {
    opts.forEach((o, i) => o.classList.toggle('ac-active', i === idx));
    if (opts[idx]) opts[idx].scrollIntoView({ block: 'nearest' });
  }

  function escapeAc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { attach, update, setTips };
})();
