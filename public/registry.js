const registryModule = (() => {
  let currentRows = [];
  let ga4Summary  = [];
  let sorter      = null;
  let editSuggestionsLoaded = false;

  function ga4ForLink(link) {
    return ga4Summary.find(
      s => s.campaign === link.campaign && s.source === link.source && s.medium === link.medium
    ) || null;
  }

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
    tr.dataset.linkId = link.id;

    const shortUrl = link.slug ? `utm.versino.de/${link.slug}` : '—';
    tr.innerHTML = `
      <td title="${escapeHtml(link.created_at)}">${formatDate(link.created_at)}</td>
      <td title="${escapeHtml(link.campaign)}">${escapeHtml(link.campaign)}</td>
      <td>${escapeHtml(link.source)}</td>
      <td>${escapeHtml(link.medium)}</td>
      <td class="url-cell" title="${escapeHtml(link.destination_url)}">${escapeHtml(link.destination_url)}</td>
      <td class="url-cell" title="${escapeHtml(shortUrl)}">${escapeHtml(shortUrl)}</td>
      <td data-sort-value="${link.clicks || 0}">${(link.clicks || 0).toLocaleString()}</td>
      <td>${escapeHtml(link.created_by) || '—'}</td>
      <td title="${escapeHtml(link.note)}">${escapeHtml(link.note) || '—'}</td>
      <td><span class="badge ${archived ? 'badge-archived' : 'badge-active'}">${archived ? 'archived' : 'active'}</span></td>
      <td>${g4 ? g4.sessions.toLocaleString() : '—'}</td>
      <td>${g4 ? g4.conversions.toLocaleString() : '—'}</td>
      <td class="actions-cell row-actions">
        <button class="btn-icon" title="Copy Short Link" data-action="copy-short">🔗</button>
        <button class="btn-icon" title="Copy UTM URL" data-action="copy">⧉</button>
        <button class="btn-icon" title="QR Code" data-action="qr">⊞</button>
        <button class="btn-icon" title="Edit" data-action="edit">✎</button>
        <button class="btn-icon" title="${archived ? 'Reactivate' : 'Archive'}" data-action="archive" data-new-status="${archived ? 'active' : 'archived'}">${archived ? '↩' : '⊠'}</button>
        <button class="btn-icon danger" title="Delete" data-action="delete">✕</button>
      </td>
    `;
    return tr;
  }

  function findLink(id) {
    return currentRows.find(r => String(r.id) === String(id));
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
    const action = btn.dataset.action;
    const row = btn.closest('tr');
    const id = row?.dataset.linkId;
    const link = id ? findLink(id) : null;

    if (action === 'copy-short' && link) {
      copyToClipboard(link.slug ? `https://utm.versino.de/${link.slug}` : link.utm_url);
    } else if (action === 'copy' && link) {
      copyToClipboard(link.utm_url);
    } else if (action === 'qr' && link) {
      await downloadQr(link.utm_url, link).catch(err => alert(err.message));
    } else if (action === 'edit' && link) {
      openEditModal(link);
    } else if (action === 'archive' && link) {
      await API.links.update(id, { status: btn.dataset.newStatus }).catch(console.error);
      load();
    } else if (action === 'delete' && link) {
      if (!confirm('Delete this link?')) return;
      await API.links.remove(id).catch(console.error);
      load();
    }
  }

  // ── Edit Modal ──

  function openEditModal(link) {
    document.getElementById('edit-id').value          = link.id;
    document.getElementById('edit-campaign').value     = link.campaign || '';
    document.getElementById('edit-source').value       = link.source || '';
    document.getElementById('edit-medium').value       = link.medium || '';
    document.getElementById('edit-content').value      = link.content || '';
    document.getElementById('edit-destination').value  = link.destination_url || '';
    document.getElementById('edit-author').value       = link.created_by || '';
    document.getElementById('edit-note').value         = link.note || '';
    document.getElementById('edit-status').value       = link.status || 'active';
    document.getElementById('edit-slug').value         = link.slug || '';
    updateEditPreview();
    document.getElementById('edit-modal').classList.remove('hidden');

    if (!editSuggestionsLoaded) {
      Autocomplete.attach(document.getElementById('edit-campaign'), []);
      Autocomplete.attach(document.getElementById('edit-source'), []);
      Autocomplete.attach(document.getElementById('edit-medium'), []);
      Autocomplete.attach(document.getElementById('edit-destination'), []);
      Autocomplete.attach(document.getElementById('edit-author'), []);
      loadEditSuggestions();
      editSuggestionsLoaded = true;
    }
  }

  async function loadEditSuggestions() {
    try {
      const { sources, mediums, campaigns, authors, destinations } = await API.links.suggestions();
      Autocomplete.update(document.getElementById('edit-source'), sources);
      Autocomplete.update(document.getElementById('edit-medium'), mediums);
      Autocomplete.update(document.getElementById('edit-campaign'), campaigns);
      Autocomplete.update(document.getElementById('edit-destination'), destinations);
      Autocomplete.update(document.getElementById('edit-author'), authors);
    } catch { /* ignore */ }
  }

  function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
  }

  function updateEditPreview() {
    const url = buildUtmUrl({
      destination_url: document.getElementById('edit-destination').value,
      source:          document.getElementById('edit-source').value,
      medium:          document.getElementById('edit-medium').value,
      campaign:        document.getElementById('edit-campaign').value,
      content:         document.getElementById('edit-content').value,
    });
    document.getElementById('edit-utm-preview').textContent = url || '—';
  }

  async function saveEdit() {
    const id = document.getElementById('edit-id').value;
    const campaign    = document.getElementById('edit-campaign').value.trim();
    const source      = document.getElementById('edit-source').value.trim();
    const medium      = document.getElementById('edit-medium').value.trim();
    const content     = document.getElementById('edit-content').value.trim();
    const dest        = document.getElementById('edit-destination').value.trim();
    const created_by  = document.getElementById('edit-author').value.trim();
    const note        = document.getElementById('edit-note').value.trim();
    const status      = document.getElementById('edit-status').value;
    const slug        = document.getElementById('edit-slug').value.trim();

    const utm_url = buildUtmUrl({ destination_url: dest, source, medium, campaign, content });

    try {
      await API.links.update(id, {
        campaign:        slugify(campaign),
        source:          slugify(source),
        medium:          slugify(medium),
        content:         content ? slugify(content) : '',
        destination_url: dest,
        utm_url:         utm_url || '',
        created_by,
        note,
        status,
        slug:            slug || undefined,
      });
      closeEditModal();
      load();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  }

  // ── Context menu copy ──

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

  // ── Filter suggestions ──

  async function loadFilterSuggestions() {
    try {
      const { mediums } = await API.links.suggestions();
      Autocomplete.update(document.getElementById('filter-medium'), mediums);
    } catch { /* ignore */ }
  }

  // ── Init ──

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

    // Edit modal
    document.getElementById('btn-edit-save').addEventListener('click', saveEdit);
    document.querySelectorAll('[data-edit-close]').forEach(el =>
      el.addEventListener('click', closeEditModal)
    );
    ['edit-campaign', 'edit-source', 'edit-medium', 'edit-content', 'edit-destination'].forEach(id =>
      document.getElementById(id).addEventListener('input', updateEditPreview)
    );

    Autocomplete.attach(document.getElementById('filter-medium'), []);
    loadFilterSuggestions();
  }

  return { init, load };
})();
