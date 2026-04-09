# UTM Maestro

UTM link generator, registry, and GA4 dashboard for Versino AG.

**URL:** https://utm.versino.de
**Repo:** https://github.com/vag-hagen/utmmaestro.git

## Critical Rule

**NEVER touch the database schema or migrate existing data.** UTM links are actively in use — any schema change, column rename, or data migration risks breaking live short-link redirects and losing click tracking history. All new features must work with the existing schema as-is.

## Stack

- **Backend:** Node.js + Express v5 + better-sqlite3 (WAL mode)
- **Frontend:** Vanilla JS SPA (no framework, no build step)
- **Charts:** Chart.js v4 (CDN)
- **GA4:** Google Analytics Data API v1beta via google-auth-library
- **QR:** qrcode (SVG/PNG)
- **Cron:** node-cron (GA4 refresh daily 03:00)
- **Tests:** Node built-in test runner + supertest

## Project Structure

```
utm-maestro/
├── server.js              # Express app + short-link redirect (/:slug)
├── db.js                  # SQLite schema, migrations, slug backfill
├── routes/
│   ├── links.js           # CRUD, filtering, suggestions, click stats, duplicate check
│   ├── ga4.js             # GA4 cache read + manual refresh
│   └── qr.js              # QR code generation (SVG/PNG)
├── services/
│   └── ga4.js             # GA4 API integration + cron schedule
├── public/                # Frontend SPA (served statically by Express)
│   ├── index.html         # Full HTML (4 tabs: Generator, Registry, Dashboard, How to Use)
│   ├── style.css          # Dark neon theme (Inter + JetBrains Mono)
│   ├── app.js             # Tab switching, URL hash routing, init
│   ├── generator.js       # Link generator form + live preview
│   ├── registry.js        # Link table with search/filter/sort/actions
│   ├── dashboard.js       # GA4 campaigns & channels views + detail modals
│   ├── api.js             # Fetch wrapper for /api endpoints
│   ├── utils.js           # slugify, buildUtmUrl, extractBaseUrl, QR download, CSV, clipboard
│   ├── autocomplete.js    # Dropdown with keyboard nav + taxonomy tooltips
│   ├── sortable.js        # Column sorting for tables
│   └── contextmenu.js     # Right-click copy menu
├── tests/
│   ├── links.test.js      # Links API tests (in-memory SQLite)
│   └── ga4.test.js
├── credentials/           # service-account.json (gitignored)
├── docs/                  # Specs and plans
├── .env                   # PORT, GA4_PROPERTY_ID
└── data.db                # SQLite database (gitignored)
```

## Database Schema

Three tables — **do not modify**:

- **links** — id, created_at, campaign, source, medium, content, destination_url, utm_url, created_by, note, status (`active`|`archived`), slug (unique)
- **clicks** — id, link_id (FK CASCADE), clicked_at, ip, user_agent, referrer
- **ga4_cache** — id, fetched_at, campaign, source, medium, report_date, date_range, sessions, users, conversions, bounce_rate, avg_engagement_time

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/links` | List links (filter: campaign, source, medium, status, from, to, q) |
| POST | `/api/links` | Create link (auto-generates slug) |
| PATCH | `/api/links/:id` | Update link fields |
| DELETE | `/api/links/:id` | Delete link (cascades clicks) |
| GET | `/api/links/suggestions` | Autocomplete values (sources, mediums, campaigns, authors, destinations) |
| GET | `/api/links/sources` | Distinct source values |
| GET | `/api/links/clicks` | Aggregated click stats (summary + daily) |
| GET | `/api/links/check-duplicate` | Pre-save duplicate check |
| GET | `/api/ga4?range=30d` | Cached GA4 data |
| POST | `/api/ga4/refresh` | Manual GA4 refresh |
| GET | `/api/qr?url=...&format=svg\|png` | QR code generation |
| GET | `/:slug` | Short-link redirect (logs click, 302) |

## Short Links

Every saved link gets a 6-char random slug. Short links resolve at `https://utm.versino.de/{slug}` — the `/:slug` route in server.js catches these, logs a click, and 302-redirects to the full utm_url. This route must stay **after** static files and `/api` routes.

## UTM Taxonomy (Versino AG)

All values auto-slugified (lowercase, hyphens, no special chars).

- **utm_source:** linkedin, google, instagram, youtube, mailing, email, webinar, doc, off-banner, off-card, off-flyer, off-mail, off-merch, ext-{name}
- **utm_medium:** social, paid-social, paid-search, paid-display, paid-video, signature, link, button, qr
- **utm_campaign:** `{type}-{name}-{period}` — types: k123-, brand-, job-, event-, other-
- **utm_content:** optional, free-form (A/B variants, CTA names)

## Environment

```
PORT=3002
GA4_PROPERTY_ID=391019102
```

GA4 credentials: `credentials/service-account.json` (gitignored).

## Commands

```bash
npm start          # Start server on PORT (default 3002)
npm test           # Run tests (in-memory SQLite, no side effects)
```

## Deploy

```bash
# Local
git add <files> && git commit -m "message" && git push

# Server (178.104.73.139)
cd /root/utm-maestro && git pull && npm install && pm2 restart utm-maestro
```

nginx proxies `utm.versino.de` → `localhost:3002`, HTTPS via Let's Encrypt, htpasswd auth on UI (short-link redirects bypass auth).

## Frontend Conventions

- No build step — edit files in `public/` directly
- Each tab has its own JS module (generator.js, registry.js, dashboard.js)
- Shared utilities in utils.js, API calls via api.js
- All DOM queries use vanilla JS (querySelector, getElementById)
- Hard-coded short-link domain: `utm.versino.de` (in generator.js, registry.js, index.html)
