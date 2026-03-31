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

  async function loadSuggestions() {
    try {
      const { sources, mediums, campaigns, authors } = await API.links.suggestions();
      Autocomplete.update(document.getElementById('source'), sources);
      Autocomplete.update(document.getElementById('medium'), mediums);
      Autocomplete.update(document.getElementById('campaign'), campaigns);
      Autocomplete.update(document.getElementById('created_by'), authors);
    } catch { /* silently ignore on first load */ }
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
        medium:          slugify(fields.medium),
        content:         fields.content ? slugify(fields.content) : undefined,
        destination_url: extractBaseUrl(currentUtmUrl),
        utm_url:         currentUtmUrl,
        created_by:      created_by || undefined,
        note:            note || undefined,
      });
      closeSaveDrawer();
      showFeedback('Link saved');
      loadSuggestions();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  }

  function init() {
    ['destination_url', 'source', 'medium', 'campaign', 'content'].forEach(id =>
      document.getElementById(id).addEventListener('input', updatePreview)
    );

    Autocomplete.attach(document.getElementById('source'), []);
    Autocomplete.attach(document.getElementById('medium'), []);
    Autocomplete.attach(document.getElementById('campaign'), []);
    Autocomplete.attach(document.getElementById('created_by'), []);

    document.getElementById('btn-copy').addEventListener('click', () => {
      if (!currentUtmUrl) return;
      copyToClipboard(currentUtmUrl);
      showFeedback('Copied to clipboard');
    });

    document.getElementById('btn-qr').addEventListener('click', async () => {
      if (!currentUtmUrl) return;
      const campaign = document.getElementById('campaign').value;
      try { await downloadQr(currentUtmUrl, campaign); }
      catch (err) { showFeedback(err.message, 'error'); }
    });

    document.getElementById('btn-save').addEventListener('click', openSaveDrawer);
    document.getElementById('btn-save-cancel').addEventListener('click', closeSaveDrawer);
    document.getElementById('btn-save-confirm').addEventListener('click', saveLink);

    loadSuggestions();
  }

  return { init };
})();
