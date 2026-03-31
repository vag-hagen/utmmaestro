const dashboardModule = (() => {
  let channelsChart = null;
  let detailChart   = null;
  let currentRange  = '30d';
  let currentRows   = [];
  let currentSummary = [];

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

    summary.forEach(r => {
      const rate = r.sessions > 0 ? ((r.conversions / r.sessions) * 100).toFixed(1) + '%' : '—';
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Klicken für Details';
      tr.innerHTML = `
        <td>${r.campaign}</td>
        <td>${r.source}</td>
        <td>${r.medium}</td>
        <td>${(r.sessions || 0).toLocaleString('de-DE')}</td>
        <td>${(r.users    || 0).toLocaleString('de-DE')}</td>
        <td>${(r.conversions || 0).toLocaleString('de-DE')}</td>
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

    Chart.defaults.color       = '#888';
    Chart.defaults.borderColor = 'rgba(0,87,184,0.15)';

    channelsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Sessions',    data: labels.map(l => agg.get(l).sessions),    backgroundColor: 'rgba(0,87,184,0.55)',   borderColor: '#0057B8', borderWidth: 1 },
          { label: 'Conversions', data: labels.map(l => agg.get(l).conversions), backgroundColor: 'rgba(255,106,0,0.55)',  borderColor: '#FF6A00', borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#e0e0e0', font: { family: "'Courier New', monospace" } } } },
        scales: {
          x: { ticks: { color: '#888' } },
          y: { beginAtZero: true, ticks: { color: '#888' } },
        },
      },
    });
  }

  function openLinkDetail(summaryRow) {
    const modal = document.getElementById('link-detail-modal');
    document.getElementById('modal-title').textContent =
      `${summaryRow.campaign} / ${summaryRow.source} / ${summaryRow.medium}`;

    document.getElementById('detail-sessions').textContent    = (summaryRow.sessions || 0).toLocaleString('de-DE');
    document.getElementById('detail-conversions').textContent = (summaryRow.conversions || 0).toLocaleString('de-DE');
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
          borderColor: '#0057B8',
          backgroundColor: 'rgba(0,87,184,0.1)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#0057B8',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#e0e0e0', font: { family: "'Courier New', monospace" } } } },
        scales: {
          x: { ticks: { color: '#888', maxRotation: 45 } },
          y: { beginAtZero: true, ticks: { color: '#888' } },
        },
      },
    });
  }

  function closeLinkDetail() {
    document.getElementById('link-detail-modal').classList.add('hidden');
    if (detailChart) { detailChart.destroy(); detailChart = null; }
  }

  async function load() {
    currentRange = document.getElementById('dash-range').value;
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

  function updateTimestamp(ts) {
    document.getElementById('ga4-timestamp').textContent = ts
      ? `Zuletzt: ${new Date(ts).toLocaleString('de-DE')}`
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
    initSubTabs();

    document.getElementById('dash-range').addEventListener('change', load);

    document.getElementById('btn-ga4-refresh').addEventListener('click', async () => {
      const btn = document.getElementById('btn-ga4-refresh');
      btn.disabled    = true;
      btn.textContent = 'Aktualisiere…';
      try {
        const { rows, summary, fetched_at } = await API.ga4.refresh(currentRange);
        currentRows    = rows;
        currentSummary = summary;
        renderCampaigns(summary);
        renderChannelsChart(summary);
        updateTimestamp(fetched_at);
      } catch (err) {
        alert(`GA4 Fehler: ${err.message}`);
      } finally {
        btn.disabled    = false;
        btn.textContent = 'GA4 aktualisieren';
      }
    });

    document.getElementById('modal-close').addEventListener('click', closeLinkDetail);
    document.querySelector('.modal-backdrop').addEventListener('click', closeLinkDetail);
  }

  return { init, load };
})();
