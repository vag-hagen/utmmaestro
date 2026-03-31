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

  function renderRow(link) {
    const g4 = ga4ForLink(link);
    const archived = link.status === 'archived';
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td title="${link.created_at}">${formatDate(link.created_at)}</td>
      <td title="${link.campaign}">${link.campaign}</td>
      <td>${link.source}</td>
      <td>${link.medium}</td>
      <td class="url-cell" title="${link.destination_url}">${link.destination_url}</td>
      <td class="url-cell" title="${link.utm_url}">${link.utm_url}</td>
      <td>${link.created_by || '—'}</td>
      <td title="${link.note || ''}">${link.note || '—'}</td>
      <td><span class="badge ${archived ? 'badge-archived' : 'badge-active'}">${archived ? 'archived' : 'active'}</span></td>
      <td>${g4 ? g4.sessions.toLocaleString() : '—'}</td>
      <td>${g4 ? g4.conversions.toLocaleString() : '—'}</td>
      <td class="row-actions">
        <button class="btn-icon" title="Copy UTM URL" data-action="copy" data-url="${link.utm_url}">⧉</button>
        <button class="btn-icon" title="QR Code" data-action="qr" data-url="${link.utm_url}">⊞</button>
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

  function init() {
    document.getElementById('btn-filter').addEventListener('click', load);
    document.getElementById('filter-q').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    document.getElementById('registry-tbody').addEventListener('click', handleAction);
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      if (currentRows.length > 0) downloadCsv(currentRows);
    });
  }

  return { init, load };
})();
