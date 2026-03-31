const registryModule = (() => {
  let currentRows = [];
  let ga4Summary  = [];
  let sorter      = null;

  function ga4ForLink(link) {
    return ga4Summary.find(
      s => s.campaign === link.campaign && s.source === link.source && s.medium === link.medium
    ) || null;
  }

  // Enrich rows with GA4 data for sorting on _sessions / _conversions
  function enrichRows(rows) {
    return rows.map(r => {
      const g4 = ga4ForLink(r);
      return { ...r, _sessions: g4 ? g4.sessions : 0, _conversions: g4 ? g4.conversions : 0 };
    });
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
        <button class="btn-icon" title="QR Code" data-action="qr" data-url="${escapeHtml(link.utm_url)}" data-campaign="${escapeHtml(link.campaign)}">⊞</button>
        <button class="btn-icon" title="Edit" data-action="edit" data-id="${link.id}" data-note="${escapeHtml(link.note)}" data-author="${escapeHtml(link.created_by)}">✎</button>
        <button class="btn-icon" title="${archived ? 'Reactivate' : 'Archive'}" data-action="archive" data-id="${link.id}" data-new-status="${archived ? 'active' : 'archived'}">${archived ? '↩' : '⊠'}</button>
        <button class="btn-icon danger" title="Delete" data-action="delete" data-id="${link.id}">✕</button>
      </td>
    `;
    return tr;
  }

  function render(rows) {
    const enriched = enrichRows(rows);
    const sorted = sorter ? sorter.sort(enriched) : enriched;
    const tbody = document.getElementById('registry-tbody');
    const empty = document.getElementById('registry-empty');
    tbody.innerHTML = '';
    if (sorted.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    sorted.forEach(link => tbody.appendChild(renderRow(link)));
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
    const { action, id, url, newStatus, campaign, note, author } = btn.dataset;

    if (action === 'copy') {
      copyToClipboard(url);
    } else if (action === 'qr') {
      await downloadQr(url, campaign).catch(err => alert(err.message));
    } else if (action === 'edit') {
      openEditDialog(id, note || '', author || '');
    } else if (action === 'archive') {
      await API.links.update(id, { status: newStatus }).catch(console.error);
      load();
    } else if (action === 'delete') {
      if (!confirm('Delete this link?')) return;
      await API.links.remove(id).catch(console.error);
      load();
    }
  }

  function openEditDialog(id, currentNote, currentAuthor) {
    const newNote   = prompt('Note:', currentNote);
    if (newNote === null) return; // cancelled
    const newAuthor = prompt('Author:', currentAuthor);
    if (newAuthor === null) return;
    const patch = {};
    if (newNote !== currentNote)     patch.note = newNote;
    if (newAuthor !== currentAuthor) patch.created_by = newAuthor;
    if (Object.keys(patch).length === 0) return;
    API.links.update(id, patch).then(() => load()).catch(console.error);
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

  // ── CSV Import ──

  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  }

  async function importCsv(file) {
    const text = await file.text();
    const rows = parseCsv(text);

    const required = ['campaign', 'source', 'medium', 'destination_url', 'utm_url'];
    const first = rows[0];
    if (!first) { alert('CSV is empty'); return; }
    const missing = required.filter(f => !(f in first));
    if (missing.length > 0) { alert(`CSV missing columns: ${missing.join(', ')}`); return; }

    let imported = 0, skipped = 0;
    for (const row of rows) {
      if (!row.campaign || !row.source || !row.medium || !row.destination_url || !row.utm_url) {
        skipped++;
        continue;
      }
      try {
        await API.links.create({
          campaign:        row.campaign,
          source:          row.source,
          medium:          row.medium,
          content:         row.content || undefined,
          destination_url: row.destination_url,
          utm_url:         row.utm_url,
          created_by:      row.created_by || undefined,
          note:            row.note || undefined,
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    alert(`Imported ${imported} links${skipped > 0 ? `, ${skipped} skipped` : ''}`);
    load();
  }

  async function loadFilterSuggestions() {
    try {
      const { mediums } = await API.links.suggestions();
      Autocomplete.update(document.getElementById('filter-medium'), mediums);
    } catch { /* ignore */ }
  }

  function init() {
    sorter = Sortable.init(document.getElementById('registry-table'), {
      onSort: () => render(currentRows),
    });

    document.getElementById('btn-filter').addEventListener('click', load);
    document.getElementById('btn-reset-filter').addEventListener('click', resetFilters);

    document.querySelectorAll('.toolbar input').forEach(input => {
      input.addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    });

    document.getElementById('registry-tbody').addEventListener('click', handleAction);
    document.getElementById('registry-tbody').addEventListener('contextmenu', handleCellContextMenu);

    document.getElementById('btn-export-csv').addEventListener('click', () => {
      if (currentRows.length > 0) downloadCsv(currentRows);
    });

    const fileInput = document.getElementById('csv-file-input');
    document.getElementById('btn-import-csv').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) importCsv(fileInput.files[0]);
      fileInput.value = '';
    });

    Autocomplete.attach(document.getElementById('filter-medium'), []);
    loadFilterSuggestions();
  }

  return { init, load };
})();
