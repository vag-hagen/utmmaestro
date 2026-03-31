const generatorModule = (() => {
  let currentUtmUrl = null;

  function getFields() {
    return {
      destination_url: document.getElementById('destination_url').value,
      source:          document.getElementById('source').value,
      medium:          document.getElementById('medium').value,
      campaign:        document.getElementById('campaign').value,
      content:         document.getElementById('content').value,
    };
  }

  function updatePreview() {
    const url = buildUtmUrl(getFields());
    currentUtmUrl = url;
    document.getElementById('utm-preview').textContent = url || '—';
    const hasUrl = Boolean(url);
    document.getElementById('btn-copy').disabled = !hasUrl;
    document.getElementById('btn-qr').disabled   = !hasUrl;
    document.getElementById('btn-save').disabled = !hasUrl;
  }

  function showFeedback(message, type = 'success') {
    const el = document.getElementById('generator-feedback');
    el.textContent = message;
    el.className = `feedback ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function openSaveDrawer() {
    document.getElementById('save-drawer').classList.remove('hidden');
    document.getElementById('created_by').focus();
  }

  function closeSaveDrawer() {
    document.getElementById('save-drawer').classList.add('hidden');
    document.getElementById('created_by').value = '';
    document.getElementById('save-note').value  = '';
  }

  async function loadSourceSuggestions() {
    try {
      const sources = await API.links.sources();
      const list = document.getElementById('source-list');
      list.innerHTML = sources.map(s => `<option value="${s}">`).join('');
    } catch { /* silently ignore */ }
  }

  async function saveLink() {
    if (!currentUtmUrl) return;
    const fields     = getFields();
    const created_by = document.getElementById('created_by').value.trim();
    const note       = document.getElementById('save-note').value.trim();

    try {
      await API.links.create({
        campaign:        slugify(fields.campaign),
        source:          slugify(fields.source),
        medium:          fields.medium,
        content:         fields.content ? slugify(fields.content) : undefined,
        destination_url: extractBaseUrl(currentUtmUrl),
        utm_url:         currentUtmUrl,
        created_by:      created_by || undefined,
        note:            note || undefined,
      });
      closeSaveDrawer();
      showFeedback('Link gespeichert ✓');
      loadSourceSuggestions();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  }

  function init() {
    ['destination_url', 'source', 'campaign', 'content'].forEach(id =>
      document.getElementById(id).addEventListener('input', updatePreview)
    );
    document.getElementById('medium').addEventListener('change', updatePreview);

    document.getElementById('btn-copy').addEventListener('click', () => {
      if (!currentUtmUrl) return;
      copyToClipboard(currentUtmUrl);
      showFeedback('In Zwischenablage kopiert ✓');
    });

    document.getElementById('btn-qr').addEventListener('click', async () => {
      if (!currentUtmUrl) return;
      try { await downloadQr(currentUtmUrl); }
      catch (err) { showFeedback(err.message, 'error'); }
    });

    document.getElementById('btn-save').addEventListener('click', openSaveDrawer);
    document.getElementById('btn-save-cancel').addEventListener('click', closeSaveDrawer);
    document.getElementById('btn-save-confirm').addEventListener('click', saveLink);

    loadSourceSuggestions();
  }

  return { init };
})();
