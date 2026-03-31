const express = require('express');
const router = express.Router();
const db = require('../db');
const ga4Service = require('../services/ga4');

function getCacheData(range) {
  const rows = db.prepare(
    'SELECT * FROM ga4_cache WHERE date_range = ? ORDER BY report_date, campaign'
  ).all(range);

  const summary = db.prepare(`
    SELECT campaign, source, medium,
           SUM(sessions) as sessions,
           SUM(users) as users,
           SUM(conversions) as conversions,
           AVG(bounce_rate) as bounce_rate,
           AVG(avg_engagement_time) as avg_engagement_time
    FROM ga4_cache
    WHERE date_range = ?
    GROUP BY campaign, source, medium
    ORDER BY sessions DESC
  `).all(range);

  const latest = db.prepare('SELECT MAX(fetched_at) as ts FROM ga4_cache WHERE date_range = ?').get(range);
  return { rows, summary, fetched_at: latest?.ts || null, range };
}

router.get('/', (req, res) => {
  const range = req.query.range || '30d';
  res.json(getCacheData(range));
});

router.post('/refresh', async (req, res) => {
  const range = req.body.range || '30d';
  try {
    await ga4Service.refreshGa4Cache(range);
    res.json(getCacheData(range));
  } catch (err) {
    res.status(502).json({ error: `GA4 fetch failed: ${err.message}` });
  }
});

module.exports = router;
