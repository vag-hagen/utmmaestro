function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '');
}

function buildUtmUrl(fields) {
  const { destination_url, source, medium, campaign, content } = fields;
  if (!destination_url || !source || !medium || !campaign) return null;
  const base = destination_url.trim();
  if (!base.startsWith('http')) return null;

  const params = new URLSearchParams();
  params.set('utm_source',   slugify(source));
  params.set('utm_medium',   slugify(medium));
  params.set('utm_campaign', slugify(campaign));
  if (content && content.trim()) params.set('utm_content', slugify(content));

  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${params.toString()}`;
}

function extractBaseUrl(utmUrl) {
  try {
    const u = new URL(utmUrl);
    u.search = '';
    return u.toString();
  } catch {
    return utmUrl;
  }
}

function buildQrFilename(link) {
  const dest = slugify(link.destination_url.replace(/^https?:\/\//, '').replace(/\//g, '-').replace(/-$/, ''));
  return `qr_utm_${slugify(link.campaign)}_${slugify(link.source)}_${slugify(link.medium)}_${dest}.png`;
}

async function downloadQr(utmUrl, link) {
  const res = await fetch(`/api/qr?url=${encodeURIComponent(utmUrl)}`);
  if (!res.ok) throw new Error('QR generation failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = link ? buildQrFilename(link) : 'qr_utm.png';
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows, filename = 'utm-links.csv') {
  const headers = ['id','created_at','campaign','source','medium','content','destination_url','utm_url','created_by','note','status'];
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escapeCsv(r[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
