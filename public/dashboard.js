const dashboardModule = (() => {
  let channelsChart = null;
  let detailChart   = null;
  let currentRange  = '30d';
  let currentRows   = [];
  let currentSummary = [];
  let sorter         = null;

  function aggregateChannels(summary) {
    const map = new Map();
    for (const r of summary) {
      if (!map.has(r.medium)) map.set(r.medium, { sessions: 0, conversions: 0 });
      map.get(r.medium).sessions    += r.sessions || 0;
      map.get(r.medium).conversions += r.conversions || 0;
    }
    return map;
  }

  function renderCampaigns(summary) {
    const tbody = document.getElementById('campaigns-tbody');
    const empty = document.getElementById('campaigns-empty');
    tbody.innerHTML = '';
    if (summary.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    // Enrich with _rate for sorting
    const enriched = summary.map(r => ({
      ...r,
      _rate: r.sessions > 0 ? (r.conversions / r.sessions) * 100 : 0,
    }));
    const sorted = sorter ? sorter.sort(enriched) : enriched;

    sorted.forEach(r => {
      const rate = r.sessions > 0 ? r._rate.toFixed(1) + '%' : '—';
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click for details';
      tr.innerHTML = `
        <td>${r.campaign}</td>
        <td>${r.source}</td>
        <td>${r.medium}</td>
        <td>${(r.sessions || 0).toLocaleString()}</td>
        <td>${(r.users    || 0).toLocaleString()}</td>
        <td>${(r.conversions || 0).toLocaleString()}</td>
        <td>${rate}</td>
      `;
      tr.addEventListener('click', () => openLinkDetail(r));
      tbody.appendChild(tr);
    });
  }

  function renderChannelsChart(summary) {
    const agg    = aggregateChannels(summary);
    const labels = [...agg.keys()];
    const ctx    = document.getElementById('channels-chart').getContext('2d');
    if (channelsChart) channelsChart.destroy();

    Chart.defaults.color       = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(148,163,184,0.1)';

    channelsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Sessions',    data: labels.map(l => agg.get(l).sessions),    backgroundColor: 'rgba(56,189,248,0.5)',  borderColor: '#38bdf8', borderWidth: 1 },
          { label: 'Conversions', data: labels.map(l => agg.get(l).conversions), backgroundColor: 'rgba(251,191,36,0.5)', borderColor: '#fbbf24', borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#cbd5e1', font: { family: "'Inter', sans-serif" } } } },
        scales: {
          x: { ticks: { color: '#94a3b8' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
        },
      },
    });
  }

  function openLinkDetail(summaryRow) {
    const modal = document.getElementById('link-detail-modal');
    document.getElementById('modal-title').textContent =
      `${summaryRow.campaign} / ${summaryRow.source} / ${summaryRow.medium}`;

    document.getElementById('detail-sessions').textContent    = (summaryRow.sessions || 0).toLocaleString();
    document.getElementById('detail-conversions').textContent = (summaryRow.conversions || 0).toLocaleString();
    document.getElementById('detail-bounce').textContent      = summaryRow.bounce_rate != null ? `${(summaryRow.bounce_rate * 100).toFixed(1)}%` : '—';
    document.getElementById('detail-duration').textContent    = summaryRow.avg_engagement_time != null ? `${Math.round(summaryRow.avg_engagement_time)}s` : '—';

    const dailyRows = currentRows
      .filter(r => r.campaign === summaryRow.campaign && r.source === summaryRow.source && r.medium === summaryRow.medium)
      .sort((a, b) => (a.report_date || '').localeCompare(b.report_date || ''));

    renderDetailChart(dailyRows);
    modal.classList.remove('hidden');
  }

  function renderDetailChart(dailyRows) {
    const ctx = document.getElementById('detail-chart').getContext('2d');
    if (detailChart) detailChart.destroy();

    detailChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyRows.map(r => r.report_date || ''),
        datasets: [{
          label: 'Sessions',
          data: dailyRows.map(r => r.sessions || 0),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.08)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#38bdf8',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#cbd5e1', font: { family: "'Inter', sans-serif" } } } },
        scales: {
          x: { ticks: { color: '#94a3b8', maxRotation: 45 } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
        },
      },
    });
  }

  function closeLinkDetail() {
    document.getElementById('link-detail-modal').classList.add('hidden');
    if (detailChart) { detailChart.destroy(); detailChart = null; }
  }

  function getRange() {
    const sel = document.getElementById('dash-range').value;
    if (sel !== 'custom') return sel;
    const from = document.getElementById('dash-from').value;
    const to   = document.getElementById('dash-to').value;
    if (!from || !to) return null;
    return `${from}_${to}`;
  }

  function syncCustomRangeVisibility() {
    const custom = document.getElementById('dash-range').value === 'custom';
    document.getElementById('dash-custom-range').classList.toggle('hidden', !custom);
  }

  async function fetchAndRender() {
    const range = getRange();
    if (!range) return; // custom selected but dates not filled yet
    currentRange = range;
    try {
      const { rows, summary, fetched_at } = await API.ga4.get(currentRange);
      currentRows    = rows;
      currentSummary = summary;
      renderCampaigns(summary);
      renderChannelsChart(summary);
      updateTimestamp(fetched_at);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    }
  }

  function exportDashboardCsv() {
    if (currentSummary.length === 0) return;
    const headers = ['campaign', 'source', 'medium', 'sessions', 'users', 'conversions', 'conv_rate'];
    const rows = currentSummary.map(r => {
      const rate = r.sessions > 0 ? ((r.conversions / r.sessions) * 100).toFixed(1) + '%' : '0%';
      return [r.campaign, r.source, r.medium, r.sessions || 0, r.users || 0, r.conversions || 0, rate];
    });
    const lines = [
      headers.join(','),
      ...rows.map(r => r.map(v => escapeCsv(v)).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ga4-campaigns-${currentRange}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function updateTimestamp(ts) {
    document.getElementById('ga4-timestamp').textContent = ts
      ? `Last updated: ${new Date(ts).toLocaleString()}`
      : '';
  }

  function initSubTabs() {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sub-tab-panel').forEach(p => { p.classList.add('hidden'); p.classList.remove('active'); });
        btn.classList.add('active');
        const panel = document.getElementById(`subtab-${subtab}`);
        panel.classList.remove('hidden');
        panel.classList.add('active');
        if (subtab === 'channels' && currentSummary.length > 0) renderChannelsChart(currentSummary);
      });
    });
  }

  function init() {
    sorter = Sortable.init(document.getElementById('campaigns-table'), {
      onSort: () => renderCampaigns(currentSummary),
    });
    initSubTabs();

    document.getElementById('dash-range').addEventListener('change', () => {
      syncCustomRangeVisibility();
      // Auto-load for preset ranges, not for custom (user picks dates then hits Refresh)
      if (document.getElementById('dash-range').value !== 'custom') fetchAndRender();
    });

    document.getElementById('btn-dash-export').addEventListener('click', exportDashboardCsv);

    document.getElementById('btn-ga4-refresh').addEventListener('click', async () => {
      const btn = document.getElementById('btn-ga4-refresh');
      btn.disabled    = true;
      btn.textContent = 'Refreshing...';
      try {
        currentRange = getRange() || '30d';
        const { rows, summary, fetched_at } = await API.ga4.refresh(currentRange);
        currentRows    = rows;
        currentSummary = summary;
        renderCampaigns(summary);
        renderChannelsChart(summary);
        updateTimestamp(fetched_at);
      } catch (err) {
        alert(`GA4 error: ${err.message}`);
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Refresh GA4';
      }
    });

    document.getElementById('modal-close').addEventListener('click', closeLinkDetail);
    document.querySelector('.modal-backdrop').addEventListener('click', closeLinkDetail);
  }

  // Called when switching to dashboard tab
  function load() {
    syncCustomRangeVisibility();
    fetchAndRender();
  }

  return { init, load };
})();
