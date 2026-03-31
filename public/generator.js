const generatorModule = (() => {
  let currentUtmUrl = null;
  let savedLink     = null; // set after save, cleared on form change

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
    savedLink = null;
    document.getElementById('utm-preview').textContent = url || '—';
    updateButtons();
  }

  function updateButtons() {
    const hasUrl   = Boolean(currentUtmUrl);
    const isSaved  = Boolean(savedLink);
    document.getElementById('btn-save').disabled = !hasUrl || isSaved;
    document.getElementById('btn-copy').disabled = !isSaved;
    document.getElementById('btn-qr').disabled   = !isSaved;
    // Visual hint
    document.getElementById('btn-save').textContent = isSaved ? 'Saved ✓' : 'Save';
  }

  function showFeedback(message, type = 'success') {
    const el = document.getElementById('generator-feedback');
    el.textContent = message;
    el.className = `feedback ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), type === 'error' ? 8000 : 3000);
  }

  async function loadSuggestions() {
    try {
      const { sources, mediums, campaigns, authors, destinations } = await API.links.suggestions();
      Autocomplete.update(document.getElementById('destination_url'), destinations);
      Autocomplete.update(document.getElementById('source'), sources);
      Autocomplete.update(document.getElementById('medium'), mediums);
      Autocomplete.update(document.getElementById('campaign'), campaigns);
      Autocomplete.update(document.getElementById('created_by'), authors);
    } catch { /* silently ignore on first load */ }
  }

  async function saveLink() {
    if (!currentUtmUrl || savedLink) return;
    const fields     = getFields();
    const created_by = document.getElementById('created_by').value.trim();
    const note       = document.getElementById('save-note').value.trim();
    const campaign   = slugify(fields.campaign);
    const source     = slugify(fields.source);
    const medium     = slugify(fields.medium);
    const dest       = extractBaseUrl(currentUtmUrl);

    try {
      const { duplicate } = await API.request('GET',
        `/links/check-duplicate?${new URLSearchParams({ campaign, source, medium, destination_url: dest })}`);
      if (duplicate) {
        const ok = confirm(
          `A link with this combination already exists:\n\n` +
          `Short link: ${duplicate.slug || '—'}\n` +
          `Created: ${formatDate(duplicate.created_at)}\n` +
          `By: ${duplicate.created_by || '—'}\n\n` +
          `Save anyway?`
        );
        if (!ok) return;
      }

      savedLink = await API.links.create({
        campaign, source, medium,
        content:         fields.content ? slugify(fields.content) : undefined,
        destination_url: dest,
        utm_url:         currentUtmUrl,
        created_by:      created_by || undefined,
        note:            note || undefined,
      });
      const shortLink = savedLink.slug ? `https://utm.versino.de/${savedLink.slug}` : '';
      showFeedback(shortLink ? `Saved — Short link: ${shortLink}` : 'Link saved');
      updateButtons();
      loadSuggestions();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  }

  function init() {
    ['destination_url', 'source', 'medium', 'campaign', 'content'].forEach(id =>
      document.getElementById(id).addEventListener('input', updatePreview)
    );

    Autocomplete.attach(document.getElementById('destination_url'), []);
    Autocomplete.attach(document.getElementById('source'), []);
    Autocomplete.attach(document.getElementById('medium'), []);
    Autocomplete.attach(document.getElementById('campaign'), []);
    Autocomplete.attach(document.getElementById('created_by'), []);

    document.getElementById('btn-copy').addEventListener('click', () => {
      if (!savedLink) return;
      const shortLink = savedLink.slug ? `https://utm.versino.de/${savedLink.slug}` : savedLink.utm_url;
      copyToClipboard(shortLink);
      showFeedback('Copied to clipboard');
    });

    document.getElementById('btn-qr').addEventListener('click', (e) => {
      if (!savedLink) return;
      showQrMenu(e, savedLink.utm_url, savedLink);
    });

    document.getElementById('btn-save').addEventListener('click', saveLink);

    document.getElementById('btn-more-fields').addEventListener('click', () => {
      const extra = document.getElementById('extra-fields');
      const btn = document.getElementById('btn-more-fields');
      const show = extra.classList.toggle('hidden');
      btn.textContent = show ? 'More +' : 'Less −';
    });

    loadSuggestions();
  }

  return { init };
})();
