const registryModule = (() => {
  let currentRows = [];
  let ga4Summary  = [];

  function ga4ForLink(link) {
    return ga4Summary.find(
      s => s.campaign === link.campaign && s.source === link.source && s.medium === link.medium
    ) || null;
  }

  function buildParams() {
    const get = id => document.getElementById(id).value.trim();
    return {
      q:        get('filter-q'),
      campaign: get('filter-campaign'),
      source:   get('filter-source'),
      medium:   get('filter-medium'),
      status:   document.getElementById('filter-status').value,
      from:     document.getElementById('filter-from').value,
      to:       document.getElementById('filter-to').value,
    };
  }

  function resetFilters() {
    ['filter-q', 'filter-campaign', 'filter-source', 'filter-medium', 'filter-from', 'filter-to'].forEach(id =>
      document.getElementById(id).value = ''
    );
    document.getElementById('filter-status').value = '';
    load();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderRow(link) {
    const g4 = ga4ForLink(link);
    const archived = link.status === 'archived';
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td title="${escapeHtml(link.created_at)}">${formatDate(link.created_at)}</td>
      <td title="${escapeHtml(link.campaign)}">${escapeHtml(link.campaign)}</td>
      <td>${escapeHtml(link.source)}</td>
      <td>${escapeHtml(link.medium)}</td>
      <td class="url-cell" title="${escapeHtml(link.destination_url)}">${escapeHtml(link.destination_url)}</td>
      <td class="url-cell" title="${escapeHtml(link.utm_url)}">${escapeHtml(link.utm_url)}</td>
      <td>${escapeHtml(link.created_by) || '—'}</td>
      <td title="${escapeHtml(link.note)}">${escapeHtml(link.note) || '—'}</td>
      <td><span class="badge ${archived ? 'badge-archived' : 'badge-active'}">${archived ? 'archived' : 'active'}</span></td>
      <td>${g4 ? g4.sessions.toLocaleString() : '—'}</td>
      <td>${g4 ? g4.conversions.toLocaleString() : '—'}</td>
      <td class="row-actions">
        <button class="btn-icon" title="Copy UTM URL" data-action="copy" data-url="${escapeHtml(link.utm_url)}">⧉</button>
        <button class="btn-icon" title="QR Code" data-action="qr" data-url="${escapeHtml(link.utm_url)}">⊞</button>
        <button class="btn-icon" title="${archived ? 'Reactivate' : 'Archive'}" data-action="archive" data-id="${link.id}" data-new-status="${archived ? 'active' : 'archived'}">${archived ? '↩' : '⊠'}</button>
        <button class="btn-icon danger" title="Delete" data-action="delete" data-id="${link.id}">✕</button>
      </td>
    `;
    return tr;
  }

  function render(rows) {
    const tbody = document.getElementById('registry-tbody');
    const empty = document.getElementById('registry-empty');
    tbody.innerHTML = '';
    if (rows.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    rows.forEach(link => tbody.appendChild(renderRow(link)));
  }

  async function load() {
    try {
      const params = buildParams();
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      [currentRows, { summary: ga4Summary }] = await Promise.all([
        API.links.list(clean),
        API.ga4.get('30d'),
      ]);
      render(currentRows);
    } catch (err) {
      console.error('Registry load failed:', err);
    }
  }

  async function handleAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, url, newStatus } = btn.dataset;

    if (action === 'copy') {
      copyToClipboard(url);
    } else if (action === 'qr') {
      await downloadQr(url).catch(err => alert(err.message));
    } else if (action === 'archive') {
      await API.links.update(id, { status: newStatus }).catch(console.error);
      load();
    } else if (action === 'delete') {
      if (!confirm('Delete this link?')) return;
      await API.links.remove(id).catch(console.error);
      load();
    }
  }

  function handleCellContextMenu(e) {
    const td = e.target.closest('td');
    if (!td || td.closest('.row-actions')) return;
    e.preventDefault();
    const text = td.textContent.trim();
    if (!text || text === '—') return;
    copyToClipboard(text);
    showCopyToast(td);
  }

  function showCopyToast(td) {
    const existing = document.querySelector('.copy-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = 'Copied';
    const rect = td.getBoundingClientRect();
    toast.style.left = `${rect.left + rect.width / 2}px`;
    toast.style.top  = `${rect.top - 6}px`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
  }

  async function loadFilterSuggestions() {
    try {
      const { mediums } = await API.links.suggestions();
      Autocomplete.update(document.getElementById('filter-medium'), mediums);
    } catch { /* ignore */ }
  }

  function init() {
    document.getElementById('btn-filter').addEventListener('click', load);
    document.getElementById('btn-reset-filter').addEventListener('click', resetFilters);

    // Enter triggers filter on all text/date inputs in toolbar
    document.querySelectorAll('.toolbar input').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    });

    document.getElementById('registry-tbody').addEventListener('click', handleAction);
    document.getElementById('registry-tbody').addEventListener('contextmenu', handleCellContextMenu);

    document.getElementById('btn-export-csv').addEventListener('click', () => {
      if (currentRows.length > 0) downloadCsv(currentRows);
    });

    Autocomplete.attach(document.getElementById('filter-medium'), []);
    loadFilterSuggestions();
  }

  return { init, load };
})();
