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
    status          TEXT NOT NULL DEFAULT 'active',
    slug            TEXT UNIQUE
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

// Migrate: add slug column if missing (for existing databases)
try { db.exec('ALTER TABLE links ADD COLUMN slug TEXT'); } catch { /* already exists */ }

// Clicks table + indexes (after slug migration)
db.exec(`
  CREATE TABLE IF NOT EXISTS clicks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id    INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip         TEXT,
    user_agent TEXT,
    referrer   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id);
`);
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_links_slug ON links(slug)'); } catch { /* */ }

// Backfill slugs for existing links
const crypto = require('crypto');
const noSlug = db.prepare('SELECT id FROM links WHERE slug IS NULL').all();
if (noSlug.length > 0) {
  const update = db.prepare('UPDATE links SET slug = ? WHERE id = ?');
  const exists = db.prepare('SELECT 1 FROM links WHERE slug = ?');
  const gen = () => crypto.randomBytes(4).toString('base64url').slice(0, 6).toLowerCase();
  for (const { id } of noSlug) {
    let slug;
    do { slug = gen(); } while (exists.get(slug));
    update.run(slug, id);
  }
  console.log(`Backfilled slugs for ${noSlug.length} existing links`);
}

module.exports = db;
