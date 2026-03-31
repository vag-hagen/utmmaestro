// services/ga4.js
require('dotenv').config();
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const cron = require('node-cron');
const db = require('../db');

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const CREDENTIALS_PATH = path.join(__dirname, '../credentials/service-account.json');

function dateRangeToParams(range) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (range === '7d')  { const s = new Date(today); s.setDate(today.getDate() - 7);  return { startDate: fmt(s), endDate: fmt(today) }; }
  if (range === '30d') { const s = new Date(today); s.setDate(today.getDate() - 30); return { startDate: fmt(s), endDate: fmt(today) }; }
  if (range === '90d') { const s = new Date(today); s.setDate(today.getDate() - 90); return { startDate: fmt(s), endDate: fmt(today) }; }

  // custom: 'YYYY-MM-DD_YYYY-MM-DD'
  const [startDate, endDate] = range.split('_');
  return { startDate, endDate };
}

async function refreshGa4Cache(range) {
  if (!PROPERTY_ID) throw new Error('GA4_PROPERTY_ID not set');

  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const client = await auth.getClient();

  const { startDate, endDate } = dateRangeToParams(range);
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;

  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionCampaignName' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'date' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'keyEvents' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
  };

  const response = await client.request({ url, method: 'POST', data: body });
  const { rows = [] } = response.data;

  db.prepare('DELETE FROM ga4_cache WHERE date_range = ?').run(range);

  const insert = db.prepare(`
    INSERT INTO ga4_cache (campaign, source, medium, report_date, date_range, sessions, users, conversions, bounce_rate, avg_engagement_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(data => { for (const r of data) insert.run(...r); });

  const parsed = rows.map(row => {
    const d = row.dimensionValues.map(v => v.value);
    const m = row.metricValues.map(v => parseFloat(v.value) || 0);
    // d: [campaign, source, medium, date YYYYMMDD]
    // m: [sessions, users, keyEvents, bounceRate, avgSessionDuration]
    const reportDate = `${d[3].slice(0, 4)}-${d[3].slice(4, 6)}-${d[3].slice(6, 8)}`;
    return [d[0], d[1], d[2], reportDate, range, m[0], m[1], m[2], m[3], m[4]];
  });

  insertMany(parsed);
  return parsed.length;
}

function scheduleGa4Refresh() {
  if (!PROPERTY_ID) {
    console.warn('GA4_PROPERTY_ID not set — skipping cron schedule');
    return;
  }
  cron.schedule('0 3 * * *', async () => {
    for (const range of ['7d', '30d', '90d']) {
      try {
        const n = await refreshGa4Cache(range);
        console.log(`GA4 auto-refresh (${range}): ${n} rows cached`);
      } catch (err) {
        console.error(`GA4 auto-refresh (${range}) failed:`, err.message);
      }
    }
  });
  console.log('GA4 auto-refresh scheduled (daily 03:00, all ranges)');
}

module.exports = { refreshGa4Cache, scheduleGa4Refresh, dateRangeToParams };
