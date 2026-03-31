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
