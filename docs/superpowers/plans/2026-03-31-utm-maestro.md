# UTM Maestro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build UTM Maestro — an internal web app for Versino AG to generate, track, and analyse UTM-tagged marketing links with GA4 performance data.

**Architecture:** Node/Express backend on port 3002 with better-sqlite3. Vanilla JS SPA served as static files by the same Express process. GA4 Data API v1 integration with daily cron and on-demand cache refresh. htpasswd via nginx for access control.

**Tech Stack:** Node.js, Express, better-sqlite3, google-auth-library, node-cron, qrcode, supertest (tests), Chart.js 4 (CDN, frontend only)

---

## File Map

```
utm-maestro/
├── server.js                  ← Express entry: static files + mounts routers
├── db.js                      ← SQLite connection + schema init (runs on require)
├── package.json
├── .env                       ← PORT=3002, GA4_PROPERTY_ID=391019102
├── .gitignore
├── routes/
│   ├── links.js               ← Link CRUD + GET /sources
│   ├── ga4.js                 ← GA4 cache read (rows + summary) + refresh trigger
│   └── qr.js                  ← GET /api/qr?url= → PNG
├── services/
│   └── ga4.js                 ← GA4 Data API client, cache write, cron scheduler
├── tests/
│   ├── links.test.js          ← Links API integration tests (in-memory DB)
│   └── ga4.test.js            ← GA4 routes unit tests (mocked service)
└── public/
    ├── index.html             ← Single page, three main tabs
    ├── style.css              ← Cyberpunk theme: bg #0a0a0f, blue #0057B8, orange #FF6A00
    ├── utils.js               ← slugify, buildUtmUrl, extractBaseUrl, downloadQr, copyToClipboard, formatDate, downloadCsv
    ├── api.js                 ← Fetch wrappers: API.links.*, API.ga4.*
    ├── generator.js           ← generatorModule: live preview, copy, QR, save drawer
    ├── registry.js            ← registryModule: table render, filters, GA4 merge, CSV, row actions
    ├── dashboard.js           ← dashboardModule: campaigns table, channels chart, link detail modal
    └── app.js                 ← Tab switching + DOMContentLoaded init
```

---

### Task 1: Project scaffold

**Files:**
- Create: `utm-maestro/package.json`
- Create: `utm-maestro/.env`
- Create: `utm-maestro/.gitignore`
- Create: `utm-maestro/server.js`
- Create: `utm-maestro/db.js`
- Create: `utm-maestro/routes/links.js` (stub)
- Create: `utm-maestro/routes/ga4.js` (stub)
- Create: `utm-maestro/routes/qr.js` (stub)
- Create: `utm-maestro/services/ga4.js` (stub)
- Create: `utm-maestro/public/index.html` (placeholder)

- [ ] **Step 1: Init project and install dependencies**

```bash
cd /path/to/utm-maestro
npm init -y
npm install express better-sqlite3 dotenv google-auth-library node-cron qrcode
npm install --save-dev supertest
```

- [ ] **Step 2: Write package.json scripts section**

Edit `package.json` — replace the `scripts` block:

```json
"scripts": {
  "start": "node server.js",
  "test": "node --test tests/*.test.js"
}
```

Full `package.json` for reference:

```json
{
  "name": "utm-maestro",
  "version": "1.0.0",
  "description": "UTM link generator, registry and GA4 dashboard for Versino AG",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "google-auth-library": "^9.0.0",
    "node-cron": "^3.0.0",
    "qrcode": "^1.5.0"
  },
  "devDependencies": {
    "supertest": "^6.3.0"
  }
}
```

- [ ] **Step 3: Create .env**

```
PORT=3002
GA4_PROPERTY_ID=391019102
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
data.db
credentials/
.env
```

- [ ] **Step 5: Write db.js**

```javascript
// db.js
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    campaign        TEXT NOT NULL,
    source          TEXT NOT NULL,
    medium          TEXT NOT NULL,
    content         TEXT,
    destination_url TEXT NOT NULL,
    utm_url         TEXT NOT NULL,
    created_by      TEXT,
    note            TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS ga4_cache (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    campaign             TEXT,
    source               TEXT,
    medium               TEXT,
    report_date          TEXT,
    date_range           TEXT NOT NULL,
    sessions             INTEGER,
    users                INTEGER,
    conversions          INTEGER,
    bounce_rate          REAL,
    avg_engagement_time  REAL
  );

  CREATE INDEX IF NOT EXISTS idx_links_campaign ON links(campaign);
  CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);
  CREATE INDEX IF NOT EXISTS idx_ga4_date_range ON ga4_cache(date_range, campaign, source, medium);
`);

module.exports = db;
```

- [ ] **Step 6: Write server.js**

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/links', require('./routes/links'));
app.use('/api/ga4',   require('./routes/ga4'));
app.use('/api/qr',    require('./routes/qr'));

const PORT = process.env.PORT || 3002;
if (require.main === module) {
  require('./services/ga4').scheduleGa4Refresh();
  app.listen(PORT, () => console.log(`UTM Maestro on port ${PORT}`));
}

module.exports = app;
```

Note: `scheduleGa4Refresh` is only called when running as the main module so tests don't start the cron.

- [ ] **Step 7: Create stub route and service files**

`routes/links.js`:
```javascript
const express = require('express');
module.exports = express.Router();
```

`routes/ga4.js`:
```javascript
const express = require('express');
module.exports = express.Router();
```

`routes/qr.js`:
```javascript
const express = require('express');
module.exports = express.Router();
```

`services/ga4.js`:
```javascript
function scheduleGa4Refresh() {}
async function refreshGa4Cache() { return 0; }
module.exports = { scheduleGa4Refresh, refreshGa4Cache };
```

`public/index.html` (placeholder so static serving works):
```html
<!DOCTYPE html><html><body><p>UTM Maestro — coming soon</p></body></html>
```

Create the `tests/` and `credentials/` directories:
```bash
mkdir -p tests credentials
```

- [ ] **Step 8: Verify server starts**

```bash
node server.js
```

Expected output: `UTM Maestro on port 3002`

Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git init
git add package.json package-lock.json .gitignore server.js db.js routes/ services/ public/index.html
git commit -m "feat: project scaffold, db schema, stub routes"
```

---

### Task 2: Links API

**Files:**
- Modify: `utm-maestro/routes/links.js`
- Create: `utm-maestro/tests/links.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/links.test.js`:

```javascript
// tests/links.test.js
process.env.DB_PATH = ':memory:';
require('dotenv').config();

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

const BASE = {
  campaign: 'test-campaign',
  source: 'linkedin',
  medium: 'social',
  destination_url: 'https://versino.de/test/',
  utm_url: 'https://versino.de/test/?utm_source=linkedin&utm_medium=social&utm_campaign=test-campaign',
  created_by: 'hagen',
};

describe('Links API', () => {
  test('POST /api/links — creates a link, returns 201', async () => {
    const res = await request(app).post('/api/links').send(BASE);
    assert.equal(res.status, 201);
    assert.equal(res.body.campaign, 'test-campaign');
    assert.ok(res.body.id);
    assert.equal(res.body.status, 'active');
  });

  test('POST /api/links — 400 when required fields missing', async () => {
    const res = await request(app).post('/api/links').send({ campaign: 'only' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test('GET /api/links — returns array including created link', async () => {
    await request(app).post('/api/links').send(BASE);
    const res = await request(app).get('/api/links');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  test('GET /api/links?q= — filters by search term', async () => {
    await request(app).post('/api/links').send({ ...BASE, campaign: 'unique-xyz-find-me' });
    const res = await request(app).get('/api/links?q=unique-xyz');
    assert.equal(res.status, 200);
    assert.ok(res.body.every(l => JSON.stringify(l).includes('unique-xyz')));
  });

  test('GET /api/links?status=archived — returns only archived', async () => {
    const post = await request(app).post('/api/links').send({ ...BASE, source: 'facebook' });
    await request(app).patch(`/api/links/${post.body.id}`).send({ status: 'archived' });
    const res = await request(app).get('/api/links?status=archived');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.every(l => l.status === 'archived'));
  });

  test('PATCH /api/links/:id — updates status', async () => {
    const post = await request(app).post('/api/links').send({ ...BASE, source: 'email' });
    const res = await request(app).patch(`/api/links/${post.body.id}`).send({ status: 'archived' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'archived');
  });

  test('PATCH /api/links/:id — 404 for unknown id', async () => {
    const res = await request(app).patch('/api/links/99999').send({ status: 'archived' });
    assert.equal(res.status, 404);
  });

  test('DELETE /api/links/:id — deletes link', async () => {
    const post = await request(app).post('/api/links').send({ ...BASE, source: 'instagram' });
    const id = post.body.id;
    assert.equal((await request(app).delete(`/api/links/${id}`)).status, 204);
    const list = await request(app).get('/api/links');
    assert.ok(!list.body.some(l => l.id === id));
  });

  test('DELETE /api/links/:id — 404 for unknown id', async () => {
    const res = await request(app).delete('/api/links/99999');
    assert.equal(res.status, 404);
  });

  test('GET /api/links/sources — returns distinct source values', async () => {
    await request(app).post('/api/links').send({ ...BASE, source: 'src-alpha' });
    await request(app).post('/api/links').send({ ...BASE, source: 'src-beta' });
    const res = await request(app).get('/api/links/sources');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.includes('src-alpha'));
    assert.ok(res.body.includes('src-beta'));
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — routes return no handlers

- [ ] **Step 3: Implement routes/links.js**

```javascript
// routes/links.js
const express = require('express');
const router = express.Router();
const db = require('../db');

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
  res.json(db.prepare(sql).all(...params));
});

// POST /api/links
router.post('/', (req, res) => {
  const { campaign, source, medium, content, destination_url, utm_url, created_by, note } = req.body;
  if (!campaign || !source || !medium || !destination_url || !utm_url) {
    return res.status(400).json({ error: 'Missing required fields: campaign, source, medium, destination_url, utm_url' });
  }
  const result = db.prepare(
    'INSERT INTO links (campaign, source, medium, content, destination_url, utm_url, created_by, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(campaign, source, medium, content || null, destination_url, utm_url, created_by || null, note || null);
  res.status(201).json(db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /api/links/:id
router.patch('/:id', (req, res) => {
  const link = db.prepare('SELECT id FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  const { status, note } = req.body;
  if (status !== undefined) db.prepare('UPDATE links SET status = ? WHERE id = ?').run(status, req.params.id);
  if (note !== undefined)   db.prepare('UPDATE links SET note = ? WHERE id = ?').run(note, req.params.id);
  res.json(db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id));
});

// DELETE /api/links/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add routes/links.js tests/links.test.js
git commit -m "feat: links API — CRUD, full-text search, sources endpoint"
```

---

### Task 3: QR endpoint + GA4 service

**Files:**
- Modify: `utm-maestro/routes/qr.js`
- Modify: `utm-maestro/services/ga4.js`

- [ ] **Step 1: Implement routes/qr.js**

```javascript
// routes/qr.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  try {
    const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'attachment; filename="utm-qr.png"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify QR endpoint manually**

```bash
node server.js
```

Open in browser: `http://localhost:3002/api/qr?url=https://versino.de/test/`

Expected: PNG file downloads.

Stop server.

- [ ] **Step 3: Implement services/ga4.js**

```javascript
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
      { name: 'conversions' },
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
    // m: [sessions, users, conversions, bounceRate, avgSessionDuration]
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
    try {
      const n = await refreshGa4Cache('30d');
      console.log(`GA4 auto-refresh: ${n} rows cached`);
    } catch (err) {
      console.error('GA4 auto-refresh failed:', err.message);
    }
  });
  console.log('GA4 auto-refresh scheduled (daily 03:00)');
}

module.exports = { refreshGa4Cache, scheduleGa4Refresh, dateRangeToParams };
```

- [ ] **Step 4: Commit**

```bash
git add routes/qr.js services/ga4.js
git commit -m "feat: QR PNG endpoint + GA4 Data API service with cron"
```

---

### Task 4: GA4 routes

**Files:**
- Modify: `utm-maestro/routes/ga4.js`
- Create: `utm-maestro/tests/ga4.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/ga4.test.js`:

```javascript
// tests/ga4.test.js
process.env.DB_PATH = ':memory:';
process.env.GA4_PROPERTY_ID = '391019102';
require('dotenv').config();

// Mock refreshGa4Cache before requiring server
const ga4Service = require('../services/ga4');
let mockCalled = false;
ga4Service.refreshGa4Cache = async (_range) => { mockCalled = true; return 5; };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const db = require('../db');

describe('GA4 routes', () => {
  test('GET /api/ga4?range=30d — returns empty rows and summary when no cache', async () => {
    const res = await request(app).get('/api/ga4?range=30d');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rows));
    assert.ok(Array.isArray(res.body.summary));
    assert.equal(res.body.range, '30d');
  });

  test('GET /api/ga4?range=30d — returns cached rows and aggregated summary', async () => {
    db.prepare(
      'INSERT INTO ga4_cache (campaign, source, medium, report_date, date_range, sessions, users, conversions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('camp-a', 'linkedin', 'social', '2026-03-01', '30d', 100, 80, 5);
    db.prepare(
      'INSERT INTO ga4_cache (campaign, source, medium, report_date, date_range, sessions, users, conversions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('camp-a', 'linkedin', 'social', '2026-03-02', '30d', 50, 40, 2);

    const res = await request(app).get('/api/ga4?range=30d');
    assert.equal(res.status, 200);
    assert.ok(res.body.rows.length >= 2);
    // summary should aggregate: camp-a / linkedin / social = 150 sessions, 7 conversions
    const s = res.body.summary.find(r => r.campaign === 'camp-a');
    assert.ok(s);
    assert.equal(s.sessions, 150);
    assert.equal(s.conversions, 7);
  });

  test('POST /api/ga4/refresh — calls refreshGa4Cache and returns data', async () => {
    mockCalled = false;
    const res = await request(app).post('/api/ga4/refresh').send({ range: '30d' });
    assert.equal(res.status, 200);
    assert.ok(mockCalled);
    assert.equal(res.body.range, '30d');
    assert.ok(res.body.rows !== undefined);
  });

  test('POST /api/ga4/refresh — defaults to 30d when no range provided', async () => {
    const res = await request(app).post('/api/ga4/refresh').send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.range, '30d');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: GA4 route tests FAIL, links tests still PASS

- [ ] **Step 3: Implement routes/ga4.js**

```javascript
// routes/ga4.js
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
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm test
```

Expected: ~14 tests PASS (10 links + 4 GA4)

- [ ] **Step 5: Commit**

```bash
git add routes/ga4.js tests/ga4.test.js
git commit -m "feat: GA4 routes with rows + summary response and refresh trigger"
```

---

### Task 5: HTML shell + CSS theme

**Files:**
- Modify: `utm-maestro/public/index.html`
- Create: `utm-maestro/public/style.css`

- [ ] **Step 1: Write public/index.html**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UTM Maestro</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <div class="logo">UTM<span class="accent">Maestro</span></div>
    <nav class="tab-nav">
      <button class="tab-btn active" data-tab="generator">Generator</button>
      <button class="tab-btn" data-tab="registry">Registry</button>
      <button class="tab-btn" data-tab="dashboard">Dashboard</button>
    </nav>
  </header>

  <main>
    <!-- ═══ GENERATOR ═══ -->
    <section id="tab-generator" class="tab-panel active">
      <div class="panel-inner">
        <form id="generator-form" autocomplete="off">
          <div class="form-row">
            <label for="destination_url">Destination URL <span class="required">*</span></label>
            <input type="url" id="destination_url" placeholder="https://versino.de/…" required>
          </div>
          <div class="form-row">
            <label for="source">Source <span class="required">*</span></label>
            <input type="text" id="source" placeholder="linkedin, google, email…" list="source-list" required>
            <datalist id="source-list"></datalist>
          </div>
          <div class="form-row">
            <label for="medium">Medium <span class="required">*</span></label>
            <select id="medium" required>
              <option value="">— wählen —</option>
              <option value="cpc">cpc</option>
              <option value="social">social</option>
              <option value="email">email</option>
              <option value="print">print</option>
              <option value="referral">referral</option>
              <option value="display">display</option>
            </select>
          </div>
          <div class="form-row">
            <label for="campaign">Kampagne <span class="required">*</span></label>
            <input type="text" id="campaign" placeholder="k202-diskrete-fertigung" required>
          </div>
          <div class="form-row">
            <label for="content">Content <span class="optional">(optional)</span></label>
            <input type="text" id="content" placeholder="banner-1, cta-button…">
          </div>
        </form>

        <div class="preview-box">
          <div class="preview-label">UTM URL Vorschau</div>
          <div id="utm-preview" class="preview-url">—</div>
          <div class="preview-actions">
            <button id="btn-copy" class="btn btn-secondary" disabled>Kopieren</button>
            <button id="btn-qr"   class="btn btn-secondary" disabled>QR ↓</button>
            <button id="btn-save" class="btn btn-primary"   disabled>Speichern</button>
          </div>
        </div>

        <div id="save-drawer" class="save-drawer hidden">
          <input type="text" id="created_by" placeholder="Erstellt von (Name / Kürzel)">
          <input type="text" id="save-note" placeholder="Notiz (optional)">
          <button id="btn-save-confirm" class="btn btn-primary">Speichern ✓</button>
          <button id="btn-save-cancel" class="btn btn-ghost">Abbrechen</button>
        </div>

        <div id="generator-feedback" class="feedback hidden"></div>
      </div>
    </section>

    <!-- ═══ REGISTRY ═══ -->
    <section id="tab-registry" class="tab-panel">
      <div class="panel-inner">
        <div class="toolbar">
          <input type="text"  id="filter-q"        placeholder="Suche…"       class="search-input">
          <input type="text"  id="filter-campaign"  placeholder="Kampagne">
          <input type="text"  id="filter-source"    placeholder="Source">
          <select id="filter-medium">
            <option value="">Alle Medien</option>
            <option value="cpc">cpc</option>
            <option value="social">social</option>
            <option value="email">email</option>
            <option value="print">print</option>
            <option value="referral">referral</option>
            <option value="display">display</option>
          </select>
          <select id="filter-status">
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="archived">Archiviert</option>
          </select>
          <input type="date" id="filter-from" title="Von Datum">
          <input type="date" id="filter-to"   title="Bis Datum">
          <button id="btn-filter"     class="btn btn-secondary">Filtern</button>
          <button id="btn-export-csv" class="btn btn-ghost">CSV ↓</button>
        </div>

        <div class="table-wrap">
          <table id="registry-table">
            <thead>
              <tr>
                <th>Datum</th><th>Kampagne</th><th>Source</th><th>Medium</th>
                <th>Ziel-URL</th><th>UTM URL</th><th>Von</th><th>Notiz</th>
                <th>Status</th><th>Sessions</th><th>Conv.</th><th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="registry-tbody"></tbody>
          </table>
        </div>
        <div id="registry-empty" class="empty-state hidden">Keine Links gefunden.</div>
      </div>
    </section>

    <!-- ═══ DASHBOARD ═══ -->
    <section id="tab-dashboard" class="tab-panel">
      <div class="panel-inner">
        <div class="dashboard-toolbar">
          <div class="sub-tabs">
            <button class="sub-tab-btn active" data-subtab="campaigns">Kampagnen</button>
            <button class="sub-tab-btn"        data-subtab="channels">Channels</button>
          </div>
          <select id="dash-range">
            <option value="7d">Letzte 7 Tage</option>
            <option value="30d" selected>Letzte 30 Tage</option>
            <option value="90d">Letzte 90 Tage</option>
          </select>
          <button id="btn-ga4-refresh" class="btn btn-secondary">GA4 aktualisieren</button>
          <span id="ga4-timestamp" class="muted"></span>
        </div>

        <div id="subtab-campaigns" class="sub-tab-panel active">
          <div class="table-wrap">
            <table id="campaigns-table">
              <thead>
                <tr>
                  <th>Kampagne</th><th>Source</th><th>Medium</th>
                  <th>Sessions</th><th>Nutzer</th><th>Conversions</th><th>Conv.-Rate</th>
                </tr>
              </thead>
              <tbody id="campaigns-tbody"></tbody>
            </table>
          </div>
          <div id="campaigns-empty" class="empty-state hidden">Keine GA4-Daten. Klicke "GA4 aktualisieren".</div>
        </div>

        <div id="subtab-channels" class="sub-tab-panel hidden">
          <div class="chart-container">
            <canvas id="channels-chart"></canvas>
          </div>
        </div>

        <!-- Link Detail Modal -->
        <div id="link-detail-modal" class="modal hidden">
          <div class="modal-backdrop"></div>
          <div class="modal-box">
            <div class="modal-header">
              <span id="modal-title" class="modal-title"></span>
              <button id="modal-close" class="btn-icon" title="Schließen">✕</button>
            </div>
            <div class="modal-metrics">
              <div class="metric-card"><div class="metric-value" id="detail-sessions">—</div><div class="metric-label">Sessions</div></div>
              <div class="metric-card"><div class="metric-value" id="detail-conversions">—</div><div class="metric-label">Conversions</div></div>
              <div class="metric-card"><div class="metric-value" id="detail-bounce">—</div><div class="metric-label">Bounce Rate</div></div>
              <div class="metric-card"><div class="metric-value" id="detail-duration">—</div><div class="metric-label">Ø Sitzungsdauer</div></div>
            </div>
            <div class="chart-container">
              <canvas id="detail-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <script src="utils.js"></script>
  <script src="api.js"></script>
  <script src="generator.js"></script>
  <script src="registry.js"></script>
  <script src="dashboard.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write public/style.css**

```css
/* style.css — UTM Maestro cyberpunk theme */
:root {
  --bg:           #0a0a0f;
  --bg-surface:   #0f0f1a;
  --bg-hover:     #141428;
  --blue:         #0057B8;
  --blue-dim:     rgba(0, 87, 184, 0.15);
  --blue-glow:    0 0 8px rgba(0, 87, 184, 0.55);
  --orange:       #FF6A00;
  --orange-dim:   rgba(255, 106, 0, 0.15);
  --orange-glow:  0 0 8px rgba(255, 106, 0, 0.55);
  --text:         #e0e0e0;
  --text-muted:   #666;
  --border:       rgba(0, 87, 184, 0.25);
  --font:         'Courier New', Courier, monospace;
  --radius:       2px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
}

/* ── HEADER ── */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--blue);
  text-shadow: var(--blue-glow);
}
.logo .accent { color: var(--orange); text-shadow: var(--orange-glow); }

/* ── TAB NAV ── */
.tab-nav { display: flex; gap: 2px; }

.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font);
  font-size: 12px;
  letter-spacing: 0.08em;
  padding: 8px 20px;
  text-transform: uppercase;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover { color: var(--text); border-bottom-color: var(--blue); }
.tab-btn.active { color: var(--blue); border-bottom-color: var(--blue); text-shadow: var(--blue-glow); }

/* ── PANELS ── */
.tab-panel { display: none; }
.tab-panel.active { display: block; }
.panel-inner { padding: 24px; max-width: 1400px; }

/* ── FORMS ── */
.form-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

label {
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.required { color: var(--orange); }
.optional { color: var(--text-muted); font-size: 11px; font-style: normal; }

input[type="text"],
input[type="url"],
input[type="date"],
select {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  padding: 8px 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}
input:focus, select:focus {
  border-color: var(--blue);
  box-shadow: var(--blue-glow);
}
select option { background: var(--bg-surface); }

/* ── PREVIEW BOX ── */
.preview-box {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-top: 20px;
  padding: 16px;
}
.preview-label {
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.preview-url {
  color: var(--orange);
  font-size: 13px;
  margin-bottom: 12px;
  min-height: 20px;
  word-break: break-all;
}
.preview-actions { display: flex; gap: 8px; }

/* ── SAVE DRAWER ── */
.save-drawer {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.save-drawer input { flex: 1; min-width: 160px; }

/* ── BUTTONS ── */
.btn {
  border: 1px solid;
  border-radius: var(--radius);
  cursor: pointer;
  font-family: var(--font);
  font-size: 12px;
  letter-spacing: 0.08em;
  padding: 8px 16px;
  text-transform: uppercase;
  transition: box-shadow 0.15s, background 0.15s;
  white-space: nowrap;
}
.btn:disabled { cursor: not-allowed; opacity: 0.35; }

.btn-primary { background: var(--orange); border-color: var(--orange); color: #000; }
.btn-primary:not(:disabled):hover { box-shadow: var(--orange-glow); }

.btn-secondary { background: var(--blue-dim); border-color: var(--blue); color: var(--blue); }
.btn-secondary:not(:disabled):hover { background: rgba(0,87,184,0.25); box-shadow: var(--blue-glow); }

.btn-ghost { background: transparent; border-color: var(--border); color: var(--text-muted); }
.btn-ghost:not(:disabled):hover { border-color: var(--text-muted); color: var(--text); }

/* ── FEEDBACK ── */
.feedback {
  border-radius: var(--radius);
  font-size: 13px;
  margin-top: 12px;
  padding: 10px 14px;
}
.feedback.success { background: rgba(0,184,80,0.1); border: 1px solid rgba(0,184,80,0.4); color: #00c84e; }
.feedback.error   { background: rgba(220,50,50,0.1); border: 1px solid rgba(220,50,50,0.4); color: #dc3232; }

/* ── TOOLBAR ── */
.toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.toolbar input, .toolbar select { flex: 1; min-width: 100px; width: auto; }
.search-input { min-width: 200px; }

/* ── TABLE ── */
.table-wrap { overflow-x: auto; }

table { border-collapse: collapse; font-size: 12px; width: 100%; }

thead th {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
  padding: 8px 10px;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
tbody tr:hover { background: var(--bg-hover); }

td {
  max-width: 200px;
  overflow: hidden;
  padding: 8px 10px;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

td.url-cell { color: var(--blue); cursor: pointer; }
td.url-cell:hover { text-shadow: var(--blue-glow); }

.badge {
  border-radius: 10px;
  display: inline-block;
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 2px 8px;
}
.badge-active   { background: rgba(0,87,184,0.15); border: 1px solid rgba(0,87,184,0.4); color: var(--blue); }
.badge-archived { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); }

.row-actions { display: flex; gap: 4px; }

.btn-icon {
  background: none;
  border: none;
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  transition: color 0.1s;
}
.btn-icon:hover       { color: var(--text); }
.btn-icon.danger:hover { color: #dc3232; }

/* ── DASHBOARD ── */
.dashboard-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.sub-tabs { display: flex; gap: 4px; }

.sub-tab-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font);
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 6px 14px;
  text-transform: uppercase;
  transition: color 0.15s, border-color 0.15s;
}
.sub-tab-btn:hover { border-color: var(--blue); color: var(--text); }
.sub-tab-btn.active { border-color: var(--blue); box-shadow: var(--blue-glow); color: var(--blue); }

.sub-tab-panel { display: none; }
.sub-tab-panel.active { display: block; }

.muted { color: var(--text-muted); font-size: 11px; }
.chart-container { margin: 0 auto; max-width: 860px; }

/* ── METRIC CARDS ── */
.modal-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 20px;
}
.metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  text-align: center;
}
.metric-value { color: var(--orange); font-size: 22px; font-weight: bold; }
.metric-label { color: var(--text-muted); font-size: 11px; letter-spacing: 0.06em; margin-top: 4px; text-transform: uppercase; }

/* ── MODAL ── */
.modal { bottom: 0; left: 0; position: fixed; right: 0; top: 0; z-index: 100; }
.modal-backdrop {
  background: rgba(0,0,0,0.75);
  bottom: 0; left: 0; position: absolute; right: 0; top: 0;
}
.modal-box {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--blue-glow);
  left: 50%;
  max-height: 85vh;
  max-width: 800px;
  overflow-y: auto;
  padding: 24px;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
}
.modal-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.modal-title { color: var(--blue); font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; }

/* ── EMPTY STATE ── */
.empty-state { color: var(--text-muted); font-size: 13px; letter-spacing: 0.06em; padding: 40px; text-align: center; }

/* ── UTILITIES ── */
.hidden { display: none !important; }
```

- [ ] **Step 3: Verify app loads in browser**

```bash
node server.js
```

Open `http://localhost:3002`. Expected: Cyberpunk-themed page with three working tabs. No red JS errors (console may warn about undefined modules — that's fine at this stage).

Stop server.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: HTML shell and cyberpunk CSS theme (Versino blue/orange)"
```

---

### Task 6: Client utilities + API client + app init

**Files:**
- Create: `utm-maestro/public/utils.js`
- Create: `utm-maestro/public/api.js`
- Create: `utm-maestro/public/app.js`

- [ ] **Step 1: Write public/utils.js**

```javascript
// public/utils.js

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
  params.set('utm_medium',   medium);
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

async function downloadQr(utmUrl) {
  const res = await fetch(`/api/qr?url=${encodeURIComponent(utmUrl)}`);
  if (!res.ok) throw new Error('QR-Generierung fehlgeschlagen');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'utm-qr.png';
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
```

- [ ] **Step 2: Write public/api.js**

```javascript
// public/api.js

const API = {
  async request(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`/api${path}`, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },

  links: {
    list:    (params = {}) => API.request('GET', `/links?${new URLSearchParams(params)}`),
    create:  (body)        => API.request('POST', '/links', body),
    update:  (id, body)    => API.request('PATCH', `/links/${id}`, body),
    remove:  (id)          => API.request('DELETE', `/links/${id}`),
    sources: ()            => API.request('GET', '/links/sources'),
  },

  ga4: {
    get:     (range = '30d') => API.request('GET', `/ga4?range=${range}`),
    refresh: (range = '30d') => API.request('POST', '/ga4/refresh', { range }),
  },
};
```

- [ ] **Step 3: Write public/app.js**

```javascript
// public/app.js

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (tab === 'registry')  registryModule.load();
      if (tab === 'dashboard') dashboardModule.load();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  generatorModule.init();
  registryModule.init();
  dashboardModule.init();
});
```

- [ ] **Step 4: Commit**

```bash
git add public/utils.js public/api.js public/app.js
git commit -m "feat: client utilities, API wrapper, tab init"
```

---

### Task 7: Generator tab

**Files:**
- Create: `utm-maestro/public/generator.js`

- [ ] **Step 1: Write public/generator.js**

```javascript
// public/generator.js

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
```

- [ ] **Step 2: Verify generator manually**

```bash
node server.js
```

Open `http://localhost:3002`:

1. Fill: Destination URL = `https://versino.de/test/`, Source = `linkedin`, Medium = `social`, Campaign = `test kampagne`
2. Verify preview: `https://versino.de/test/?utm_source=linkedin&utm_medium=social&utm_campaign=test-kampagne`  
   (note: spaces in campaign → hyphens, all lowercase)
3. Click "Kopieren" → paste somewhere to verify clipboard
4. Click "QR ↓" → verify PNG downloads
5. Click "Speichern" → drawer opens → fill name → "Speichern ✓" → success feedback appears

Stop server.

- [ ] **Step 3: Commit**

```bash
git add public/generator.js
git commit -m "feat: generator tab — live preview, copy, QR download, save"
```

---

### Task 8: Registry tab

**Files:**
- Create: `utm-maestro/public/registry.js`

- [ ] **Step 1: Write public/registry.js**

```javascript
// public/registry.js

const registryModule = (() => {
  let currentRows = [];
  let ga4Summary  = [];

  function ga4ForLink(link) {
    return ga4Summary.find(
      s => s.campaign === link.campaign && s.source === link.source && s.medium === link.medium
    ) || null;
  }

  function buildParams() {
    const get = id => document.getElementById(id).value.trim();
    return {
      q:        get('filter-q'),
      campaign: get('filter-campaign'),
      source:   get('filter-source'),
      medium:   document.getElementById('filter-medium').value,
      status:   document.getElementById('filter-status').value,
      from:     document.getElementById('filter-from').value,
      to:       document.getElementById('filter-to').value,
    };
  }

  function renderRow(link) {
    const g4 = ga4ForLink(link);
    const archived = link.status === 'archived';
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td title="${link.created_at}">${formatDate(link.created_at)}</td>
      <td title="${link.campaign}">${link.campaign}</td>
      <td>${link.source}</td>
      <td>${link.medium}</td>
      <td class="url-cell" title="${link.destination_url}">${link.destination_url}</td>
      <td class="url-cell" title="${link.utm_url}">${link.utm_url}</td>
      <td>${link.created_by || '—'}</td>
      <td title="${link.note || ''}">${link.note || '—'}</td>
      <td><span class="badge ${archived ? 'badge-archived' : 'badge-active'}">${archived ? 'archiviert' : 'aktiv'}</span></td>
      <td>${g4 ? g4.sessions.toLocaleString('de-DE') : '—'}</td>
      <td>${g4 ? g4.conversions.toLocaleString('de-DE') : '—'}</td>
      <td class="row-actions">
        <button class="btn-icon" title="UTM URL kopieren" data-action="copy" data-url="${link.utm_url}">⧉</button>
        <button class="btn-icon" title="QR-Code" data-action="qr" data-url="${link.utm_url}">⊞</button>
        <button class="btn-icon" title="${archived ? 'Reaktivieren' : 'Archivieren'}" data-action="archive" data-id="${link.id}" data-new-status="${archived ? 'active' : 'archived'}">${archived ? '↩' : '⊠'}</button>
        <button class="btn-icon danger" title="Löschen" data-action="delete" data-id="${link.id}">✕</button>
      </td>
    `;
    return tr;
  }

  function render(rows) {
    const tbody = document.getElementById('registry-tbody');
    const empty = document.getElementById('registry-empty');
    tbody.innerHTML = '';
    if (rows.length === 0) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    rows.forEach(link => tbody.appendChild(renderRow(link)));
  }

  async function load() {
    try {
      const params = buildParams();
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      [currentRows, { summary: ga4Summary }] = await Promise.all([
        API.links.list(clean),
        API.ga4.get('30d'),
      ]);
      render(currentRows);
    } catch (err) {
      console.error('Registry load failed:', err);
    }
  }

  async function handleAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, url, newStatus } = btn.dataset;

    if (action === 'copy') {
      copyToClipboard(url);
    } else if (action === 'qr') {
      await downloadQr(url).catch(err => alert(err.message));
    } else if (action === 'archive') {
      await API.links.update(id, { status: newStatus }).catch(console.error);
      load();
    } else if (action === 'delete') {
      if (!confirm('Link wirklich löschen?')) return;
      await API.links.remove(id).catch(console.error);
      load();
    }
  }

  function init() {
    document.getElementById('btn-filter').addEventListener('click', load);
    document.getElementById('filter-q').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    document.getElementById('registry-tbody').addEventListener('click', handleAction);
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      if (currentRows.length > 0) downloadCsv(currentRows);
    });
  }

  return { init, load };
})();
```

- [ ] **Step 2: Verify registry manually**

```bash
node server.js
```

Click "Registry" tab:
1. Verify the link saved in Task 7 Step 2 appears in the table
2. Type a search term → click "Filtern" → verify results filter
3. Click archive button (⊠) → verify badge changes to "archiviert"
4. Click "CSV ↓" → verify CSV downloads with correct headers
5. Click delete (✕) → confirm → verify row disappears

Stop server.

- [ ] **Step 3: Commit**

```bash
git add public/registry.js
git commit -m "feat: registry tab — table, filters, GA4 columns, CSV, row actions"
```

---

### Task 9: Dashboard tab

**Files:**
- Create: `utm-maestro/public/dashboard.js`

- [ ] **Step 1: Write public/dashboard.js**

```javascript
// public/dashboard.js

const dashboardModule = (() => {
  let channelsChart = null;
  let detailChart   = null;
  let currentRange  = '30d';
  let currentRows   = [];
  let currentSummary = [];

  // ── Aggregation helpers ──────────────────────────────────────────────

  function aggregateChannels(summary) {
    const map = new Map();
    for (const r of summary) {
      if (!map.has(r.medium)) map.set(r.medium, { sessions: 0, conversions: 0 });
      map.get(r.medium).sessions    += r.sessions || 0;
      map.get(r.medium).conversions += r.conversions || 0;
    }
    return map;
  }

  // ── Campaigns table ──────────────────────────────────────────────────

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

  // ── Channels chart ───────────────────────────────────────────────────

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

  // ── Link detail modal ────────────────────────────────────────────────

  function openLinkDetail(summaryRow) {
    const modal = document.getElementById('link-detail-modal');
    document.getElementById('modal-title').textContent =
      `${summaryRow.campaign} / ${summaryRow.source} / ${summaryRow.medium}`;

    document.getElementById('detail-sessions').textContent    = (summaryRow.sessions || 0).toLocaleString('de-DE');
    document.getElementById('detail-conversions').textContent = (summaryRow.conversions || 0).toLocaleString('de-DE');
    document.getElementById('detail-bounce').textContent      = summaryRow.bounce_rate != null ? `${(summaryRow.bounce_rate * 100).toFixed(1)}%` : '—';
    document.getElementById('detail-duration').textContent    = summaryRow.avg_engagement_time != null ? `${Math.round(summaryRow.avg_engagement_time)}s` : '—';

    // Filter daily rows for this campaign/source/medium, sorted by date
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

  // ── Data loading ─────────────────────────────────────────────────────

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

  // ── Sub-tab switching ────────────────────────────────────────────────

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

  // ── Init ─────────────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Verify dashboard manually**

```bash
node server.js
```

Click "Dashboard" tab:
1. Verify no JS errors in console
2. Click "GA4 aktualisieren" → check Network tab — request to `/api/ga4/refresh` is made
   - If GA4 credentials are valid on this machine: real data populates the table
   - If not: a clear error alert appears — not a crash
3. Click "Channels" sub-tab → bar chart renders (empty or with data)
4. If campaign rows exist in the Campaigns table: click a row → verify modal opens with metrics + line chart
5. Click ✕ or backdrop → modal closes

Stop server.

- [ ] **Step 3: Commit**

```bash
git add public/dashboard.js
git commit -m "feat: dashboard — campaigns table, channels chart, link detail modal"
```

---

### Task 10: Deployment

**Files:**
- Create: `/etc/nginx/sites-enabled/utm-maestro` (on server)
- Create: `/root/utm-maestro/.env` (on server)
- Create: `/root/utm-maestro/credentials/service-account.json` (on server)

- [ ] **Step 1: Push code to server via scp**

On local machine (from `utm-maestro/` parent directory):

```bash
# Create the directory on the server first
ssh root@178.104.73.139 "mkdir -p /root/utm-maestro/credentials /root/utm-maestro/public /root/utm-maestro/routes /root/utm-maestro/services /root/utm-maestro/tests"

# Copy source files (exclude node_modules, db, credentials, .env)
scp server.js db.js package.json root@178.104.73.139:/root/utm-maestro/
scp routes/links.js routes/ga4.js routes/qr.js root@178.104.73.139:/root/utm-maestro/routes/
scp services/ga4.js root@178.104.73.139:/root/utm-maestro/services/
scp public/index.html public/style.css public/utils.js public/api.js root@178.104.73.139:/root/utm-maestro/public/
scp public/generator.js public/registry.js public/dashboard.js public/app.js root@178.104.73.139:/root/utm-maestro/public/
```

- [ ] **Step 2: Install dependencies on server**

```bash
ssh root@178.104.73.139
cd /root/utm-maestro
apt-get install -y build-essential
npm install
```

Expected: `node_modules/` created, `better-sqlite3` compiles without error.

- [ ] **Step 3: Create .env on server**

```bash
printf 'PORT=3002\nGA4_PROPERTY_ID=391019102\n' > /root/utm-maestro/.env
```

- [ ] **Step 4: Upload service account credentials**

From local machine:

```bash
scp "C:/Users/Hagen/Documents/App Projects/utm-maestro/service-account.json" root@178.104.73.139:/root/utm-maestro/credentials/service-account.json
```

- [ ] **Step 5: Start with pm2**

```bash
# On server
cd /root/utm-maestro
pm2 start server.js --name utm-maestro
pm2 save
```

Verify: `pm2 list` shows `utm-maestro` as `online`.

- [ ] **Step 6: Create htpasswd file**

```bash
apt-get install -y apache2-utils
htpasswd -c /etc/nginx/.htpasswd-utm versino
```

Enter a password when prompted. **Note it and share with Hagen.**

- [ ] **Step 7: Create nginx vhost**

```bash
cat > /etc/nginx/sites-enabled/utm-maestro << 'NGINXEOF'
server {
    listen 80;
    server_name utm.versino.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name utm.versino.de;

    ssl_certificate     /etc/letsencrypt/live/utm.versino.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/utm.versino.de/privkey.pem;

    auth_basic "UTM Maestro";
    auth_basic_user_file /etc/nginx/.htpasswd-utm;

    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
NGINXEOF
```

- [ ] **Step 8: Obtain SSL certificate**

Before running certbot, ensure the A record for `utm.versino.de` points to `178.104.73.139`. Verify with:

```bash
dig utm.versino.de +short
```

Expected: `178.104.73.139`

Then:

```bash
nginx -t
certbot --nginx -d utm.versino.de
```

Expected: Certificate issued, nginx reloaded automatically.

- [ ] **Step 9: Verify end-to-end**

1. `https://utm.versino.de` → htpasswd prompt appears
2. Log in with the password from Step 6
3. App loads with cyberpunk theme — three tabs visible
4. Generator: fill all fields → verify live preview → save a link
5. Registry: click tab → link appears → test filter and CSV export
6. Dashboard: click "GA4 aktualisieren" → real GA4 data loads (or clear error if API issue)

- [ ] **Step 10: Final commit**

```bash
# Back on local machine
git tag v1.0.0
git commit --allow-empty -m "chore: v1.0.0 deployed to utm.versino.de"
```
