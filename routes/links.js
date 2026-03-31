const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');

function generateSlug() {
  return crypto.randomBytes(4).toString('base64url').slice(0, 6).toLowerCase();
}

function uniqueSlug() {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug();
    if (!db.prepare('SELECT 1 FROM links WHERE slug = ?').get(slug)) return slug;
  }
  return crypto.randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();
}

// GET /api/links/suggestions — distinct values for autocomplete
router.get('/suggestions', (_req, res) => {
  const sources    = db.prepare('SELECT DISTINCT source FROM links ORDER BY source').all().map(r => r.source);
  const mediums    = db.prepare('SELECT DISTINCT medium FROM links ORDER BY medium').all().map(r => r.medium);
  const campaigns  = db.prepare('SELECT DISTINCT campaign FROM links ORDER BY campaign').all().map(r => r.campaign);
  const authors    = db.prepare('SELECT DISTINCT created_by FROM links WHERE created_by IS NOT NULL ORDER BY created_by').all().map(r => r.created_by);
  const destinations = db.prepare('SELECT DISTINCT destination_url FROM links ORDER BY destination_url').all().map(r => r.destination_url);
  res.json({ sources, mediums, campaigns, authors, destinations });
});

// GET /api/links/sources — must be before /:id
router.get('/sources', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT source FROM links ORDER BY source').all();
  res.json(rows.map(r => r.source));
});

// GET /api/links
router.get('/', (req, res) => {
  const { campaign, source, medium, status, from, to, q } = req.query;
  let sql = 'SELECT * FROM links WHERE 1=1';
  const params = [];

  if (campaign) { sql += ' AND campaign LIKE ?'; params.push(`%${campaign}%`); }
  if (source)   { sql += ' AND source LIKE ?';   params.push(`%${source}%`); }
  if (medium)   { sql += ' AND medium = ?';       params.push(medium); }
  if (status)   { sql += ' AND status = ?';       params.push(status); }
  if (from)     { sql += ' AND created_at >= ?';  params.push(from); }
  if (to)       { sql += ' AND created_at <= ?';  params.push(`${to}T23:59:59`); }
  if (q) {
    const t = `%${q}%`;
    sql += ' AND (campaign LIKE ? OR source LIKE ? OR medium LIKE ? OR destination_url LIKE ? OR utm_url LIKE ? OR created_by LIKE ? OR note LIKE ?)';
    params.push(t, t, t, t, t, t, t);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  // Attach click counts
  const clickCounts = db.prepare('SELECT link_id, COUNT(*) as clicks FROM clicks GROUP BY link_id').all();
  const clickMap = Object.fromEntries(clickCounts.map(r => [r.link_id, r.clicks]));
  rows.forEach(r => { r.clicks = clickMap[r.id] || 0; });
  res.json(rows);
});

// POST /api/links
router.post('/', (req, res) => {
  const { campaign, source, medium, content, destination_url, utm_url, created_by, note } = req.body;
  if (!campaign || !source || !medium || !destination_url || !utm_url) {
    return res.status(400).json({ error: 'Missing required fields: campaign, source, medium, destination_url, utm_url' });
  }
  const slug = uniqueSlug();
  const result = db.prepare(
    'INSERT INTO links (campaign, source, medium, content, destination_url, utm_url, created_by, note, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(campaign, source, medium, content || null, destination_url, utm_url, created_by || null, note || null, slug);
  res.status(201).json(db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /api/links/:id
router.patch('/:id', (req, res) => {
  const link = db.prepare('SELECT id FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  const allowed = ['campaign', 'source', 'medium', 'content', 'destination_url', 'utm_url', 'created_by', 'note', 'status', 'slug'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.prepare(`UPDATE links SET ${key} = ? WHERE id = ?`).run(req.body[key], req.params.id);
    }
  }
  res.json(db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id));
});

// DELETE /api/links/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
