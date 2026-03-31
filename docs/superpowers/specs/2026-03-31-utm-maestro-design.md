# UTM Maestro — Design Spec

**Date:** 2026-03-31  
**Status:** Approved  
**App name:** UTM Maestro  
**URL:** utm.versino.de  

## Problem

The marketing team at Versino AG creates UTM-tagged links ad hoc, with no consistent naming convention and no central registry. There is no way to review past campaigns, filter by source/medium, or see GA4 performance data alongside the links that generated it.

## Solution

A single-page internal web app with three tabs:
1. **Generator** — enforces Versino UTM taxonomy, produces a clean link + QR code
2. **Registry** — searchable, filterable table of all saved links with status management
3. **Dashboard** — GA4 performance data (sessions, conversions, channel comparison) pulled via the GA4 Data API v1

---

## Architecture

```
utm-maestro/
├── server.js                  ← Express app: serves static files + all API routes
├── package.json
├── .env                       ← PORT=3002, GA4_PROPERTY_ID=391019102
├── credentials/
│   └── service-account.json   ← gitignored, GA4 service account
├── data.db                    ← gitignored, SQLite database
└── public/
    ├── index.html             ← single page, tab navigation
    ├── style.css              ← cyberpunk theme (blue #0057B8 / orange #FF6A00)
    └── app.js                 ← all client-side logic
```

**Stack:** Node.js + Express, better-sqlite3, google-auth-library, node-cron, qrcode  
**Port:** 3002 (3000 = Recall, 3001 = one·dot server)  
**Security:** htpasswd via nginx (shared password, no user accounts)  
**Process manager:** pm2 (`utm-maestro` process name)

---

## Database Schema

```sql
CREATE TABLE links (
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
  status          TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'archived'
);

CREATE TABLE ga4_cache (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  campaign             TEXT,
  source               TEXT,
  medium               TEXT,
  report_date          TEXT,        -- NULL for aggregate rows, 'YYYY-MM-DD' for daily rows
  date_range           TEXT NOT NULL,
  sessions             INTEGER,
  users                INTEGER,
  conversions          INTEGER,
  bounce_rate          REAL,
  avg_engagement_time  REAL
);
-- Aggregate rows: report_date IS NULL, one row per campaign/source/medium/date_range
-- Daily rows: report_date IS NOT NULL, one row per campaign/source/medium/date for line charts

CREATE INDEX idx_links_campaign ON links(campaign);
CREATE INDEX idx_links_status ON links(status);
CREATE INDEX idx_ga4_cache_date_range ON ga4_cache(date_range);
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/links` | List links. Query params: `campaign`, `source`, `medium`, `status`, `from`, `to`, `q` (search) |
| POST | `/api/links` | Create link. Returns created row. |
| PATCH | `/api/links/:id` | Update `status`, `note`. |
| DELETE | `/api/links/:id` | Hard delete. |
| GET | `/api/links/sources` | Distinct source values (for autocomplete). |
| GET | `/api/ga4` | Return cached GA4 data. Query param: `range` (7d / 30d / 90d / custom). |
| POST | `/api/ga4/refresh` | Trigger fresh GA4 fetch, update cache. |

---

## UTM Taxonomy

### Required fields
| Field | Parameter | Input type |
|-------|-----------|------------|
| Destination URL | — | text, URL validated |
| Source | `utm_source` | text + autocomplete from registry |
| Medium | `utm_medium` | fixed dropdown: `cpc`, `social`, `email`, `print`, `referral`, `display` |
| Campaign | `utm_campaign` | text |

### Optional fields
| Field | Parameter | Notes |
|-------|-----------|-------|
| Content | `utm_content` | text, for multi-variant campaigns |

`utm_term` is not used (auto-filled by Google Ads).

### Naming rules (applied automatically)
- Lowercase everything
- Spaces → hyphens
- Strip special characters (keep alphanumeric, hyphens, underscores)

---

## UI — Generator Tab

- Form with the fields above
- Live UTM URL preview below the form, updates on every keystroke
- "Saved by" freetext field (shown when clicking Save)
- **Copy** button: copies UTM URL to clipboard
- **Save** button: opens "Saved by" input, then POSTs to `/api/links`
- **QR** button: generates QR PNG from current UTM URL, triggers download

---

## UI — Registry Tab

- Filter bar: Campaign (text) / Source (text) / Medium (dropdown) / Status (dropdown) / Date range (from/to)
- Full-text search input
- Table columns: Date · Campaign · Source · Medium · Destination URL · UTM URL · Saved by · Note · Status · Sessions · Conversions
- Sessions + Conversions columns populated from `ga4_cache` — matched by `campaign + source + medium`
- Per-row actions: Copy UTM URL · QR · Archive/Unarchive · Delete
- CSV export button exports current filtered view

---

## UI — Dashboard Tab

Three sub-tabs:

**Campaigns** — Table: Campaign / Sessions / Users / Conversions / Conv. Rate  
Time filter: 7d / 30d / 90d / custom date range

**Link Detail** — Opened by clicking a registry row  
Metrics cards: Sessions · Bounce Rate · Avg. Engagement Time · Conversions  
Line chart (Chart.js): sessions per day over selected range

**Channels** — Bar chart: Sessions + Conversions grouped by `utm_medium`  
Side-by-side comparison of sources within each medium

**Refresh:** "Refresh GA4" button → POST `/api/ga4/refresh`  
Cache timestamp displayed. node-cron auto-refreshes daily at 03:00.

---

## GA4 Integration

- Library: `google-auth-library` (JWT auth with service account)
- Service account: `credentials/service-account.json` (gitignored)
- Property ID: `391019102` (in `.env` as `GA4_PROPERTY_ID`)
- API: GA4 Data API v1 — `runReport` endpoint
- Conversion event: `generate_lead`
- Data stored in `ga4_cache` table, keyed by campaign/source/medium + date_range

---

## Theme

- Background: `#0a0a0f`
- Primary accent (blue): `#0057B8` — Versino brand blue
- Secondary accent (orange): `#FF6A00` — Versino brand orange
- Text: `#e0e0e0`
- Monospace font (same as one·dot)
- Neon glow on active inputs, buttons, and highlighted rows
- Tab nav uses blue underline for active, orange hover

---

## Deployment

```bash
# Server setup
cd /root/utm-maestro
npm install
pm2 start server.js --name utm-maestro
pm2 save
```

```nginx
# /etc/nginx/sites-enabled/utm-maestro
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
        proxy_pass http://localhost:3002;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Out of Scope

- URL shortener / short links
- Multi-user with roles
- A/B test management
- HubSpot integration (Phase 2)
- `utm_term` (auto-filled by Google Ads)
