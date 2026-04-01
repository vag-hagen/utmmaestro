const UTM_TIPS = {
  sources: {
    'linkedin':    'LinkedIn (organic + paid)',
    'google':      'Google Ads',
    'instagram':   'Instagram (organic + paid)',
    'youtube':     'YouTube',
    'mailing':     'Mass mailings & newsletters',
    'email':       'Direct emails from employees (incl. signatures)',
    'webinar':     'Webinars',
    'doc':         'Links in digital documents (PDFs, whitepapers, proposals)',
    'off-banner':  'Physical: banners, roll-ups',
    'off-card':    'Physical: business cards',
    'off-flyer':   'Physical: flyers, brochures',
    'off-mail':    'Physical: direct mail / postal',
    'off-merch':   'Physical: merchandise, giveaways',
  },
  mediums: {
    'social':       'Organic social media posts',
    'paid-social':  'Paid social media ads',
    'paid-search':  'Paid search ads (e.g. Google Ads Search)',
    'paid-display': 'Display / banner advertising',
    'paid-video':   'Video advertising (e.g. YouTube Ads)',
    'signature':    'Links in email signatures',
    'link':         'Text link / reference',
    'button':       'Button link (CTA buttons in emails, pages, docs)',
    'qr':           'QR codes on physical materials',
  },
};

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
    document.getElementById('btn-save').disabled       = !hasUrl || isSaved;
    document.getElementById('btn-copy').disabled        = !isSaved;
    document.getElementById('btn-copy-short').disabled  = !isSaved;
    document.getElementById('btn-qr').disabled          = !isSaved;
    document.getElementById('btn-save').textContent     = isSaved ? 'Saved ✓' : 'Save';

    const el = document.getElementById('shortlink-preview');
    if (isSaved && savedLink.slug) {
      el.textContent = `https://utm.versino.de/${savedLink.slug}`;
      el.className = 'preview-url shortlink-preview-active';
    } else {
      el.textContent = '—';
      el.className = 'preview-url shortlink-preview-muted';
    }
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
      Autocomplete.setTips(document.getElementById('source'), UTM_TIPS.sources);
      Autocomplete.setTips(document.getElementById('medium'), UTM_TIPS.mediums);
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
    Autocomplete.setTips(document.getElementById('source'), UTM_TIPS.sources);
    Autocomplete.setTips(document.getElementById('medium'), UTM_TIPS.mediums);

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

    document.getElementById('btn-copy-short').addEventListener('click', () => {
      if (!savedLink?.slug) return;
      copyToClipboard(`https://utm.versino.de/${savedLink.slug}`);
      showFeedback('Short link copied');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      ['destination_url', 'source', 'medium', 'campaign', 'content', 'created_by', 'save-note'].forEach(id =>
        document.getElementById(id).value = ''
      );
      const extra = document.getElementById('extra-fields');
      if (!extra.classList.contains('hidden')) {
        extra.classList.add('hidden');
        document.getElementById('btn-more-fields').textContent = 'More +';
      }
      updatePreview();
    });

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
