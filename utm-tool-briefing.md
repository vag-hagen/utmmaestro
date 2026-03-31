# Briefing: UTM Tracking Tool — Versino AG

**Auftraggeber:** Hagen Hörl, Versino AG
**Stand:** 2026-03-31
**Ziel:** Vollständige Web-App für UTM-Link-Generierung, Link-Registry und GA4-Auswertung

App Name: UTM Maestro

---

## 1. Was gebaut wird

Eine interne Web-App mit drei Funktionsbereichen:

1. **UTM Link Generator** — Formular mit erzwungener Taxonomie → fertiger UTM-Link
2. **Link Registry** — alle je erstellten Links, durchsuchbar und filterbar
3. **Performance Dashboard** — GA4-Daten pro Link/Kampagne direkt in der App

Absicherung via **htpasswd** über nginx (bestehende Server-Infrastruktur auf Hetzner).

---

## 2. UTM-Taxonomie (Versino-Standard)

### Pflichtfelder
| Feld | Parameter | Erlaubte Werte | Beispiel |
|---|---|---|---|
| Quelle | `utm_source` | Freitext mit Dropdown-Vorschlägen | `linkedin`, `google`, `facebook`, `instagram`, `pnp`, `ovb`, `hubspot`, `email` |
| Medium | `utm_medium` | Festes Dropdown | `cpc`, `social`, `email`, `print`, `referral`, `display` |
| Kampagne | `utm_campaign` | Freitext (SAP-ID oder Beschreibung) | `k202-diskrete-fertigung`, `recruiting-altoetting` |
| Ziel-URL | — | URL-Validierung | `https://versino.de/diskrete-fertigung/` |

### Optionale Felder
| Feld | Parameter | Wann benutzen |
|---|---|---|
| Inhalt | `utm_content` | Mehrere Motive/Formate in einer Kampagne | `banner-1`, `cta-button`, `post-video` |

`utm_term` wird **nicht** verwendet — wird bei Google Ads automatisch befüllt.

### Naming-Regeln (automatisch erzwungen durch die App)
- Alles lowercase
- Leerzeichen → Bindestrich
- Sonderzeichen entfernen
- Kampagnen-IDs aus SAP übernehmen wenn vorhanden (z.B. `k202`), sonst Freitext

---

## 3. Features im Detail

### 3.1 UTM Link Generator

- Formular mit den Feldern aus Abschnitt 2
- Source-Feld: Freitext + Autocomplete aus bestehenden Werten der Registry
- Medium-Feld: Festes Dropdown
- Live-Vorschau des fertigen Links unterhalb des Formulars (aktualisiert sich beim Tippen)
- **Copy-to-clipboard** Button
- **QR-Code-Export** (PNG, für Plakate und Printmedien) — QR zeigt auf die UTM-URL
- Button: "Link speichern" → schreibt in Registry

### 3.2 Link Registry

Tabelle aller gespeicherten Links mit folgenden Spalten:

| Spalte | Beschreibung |
|---|---|
| Datum | Erstellungsdatum |
| Kampagne | utm_campaign Wert |
| Quelle | utm_source |
| Medium | utm_medium |
| Ziel-URL | Basis-URL ohne UTM |
| UTM-URL | Vollständiger Link |
| Erstellt von | Name/Kürzel (Freitext beim Speichern) |
| Notiz | Optionales Freitextfeld |
| Status | `aktiv` / `archiviert` |
| Sessions | GA4-Daten (wenn verknüpft) |
| Conversions | GA4-Daten (wenn verknüpft) |

**Filter:** nach Kampagne, Medium, Source, Status, Datumsbereich
**Suche:** Volltext über alle Felder
**Export:** CSV-Download der gefilterten Ansicht
**Aktionen pro Zeile:** Copy UTM-URL, QR-Code, Archivieren, Löschen

### 3.3 GA4 Performance Dashboard

Datenquelle: Google Analytics 4 Reporting API v1 (Data API)

**Ansicht 1 — Kampagnen-Übersicht**
- Tabelle: Kampagne / Sessions / Nutzer / Conversions (generate_lead) / Conv.-Rate
- Zeitraum-Filter (letzte 7/30/90 Tage, oder custom)

**Ansicht 2 — Link-Detail**
- Einzelansicht pro gespeichertem Link
- Metriken: Sessions, Bounce Rate, Avg. Engagement Time, Conversions
- Kleines Liniendiagramm: Sessions über Zeit

**Ansicht 3 — Channel-Vergleich**
- Balkendiagramm: Sessions + Conversions nach utm_medium
- Side-by-side Vergleich verschiedener Quellen

**Daten-Refresh:** Manuell per Button ("GA4 aktualisieren") + automatisch täglich per Cron

**Credentials:** Service Account JSON (bereits vorhanden unter `credentials/service-account.json` im Google Analytics Operator)

---

## 4. Tech Stack

Entscheidung dem ausführenden Claude Code überlassen basierend auf bestehendem Stack auf dem Hetzner-Server. Empfehlung wenn kein Stack vorgegeben:

- **Backend:** Node.js (Express) oder Python (FastAPI)
- **Datenbank:** SQLite (ausreichend für diesen Use Case, kein separater DB-Server nötig)
- **Frontend:** Vanilla JS oder leichtes Framework (keine schweren SPA-Frameworks nötig)
- **Charts:** Chart.js (leichtgewichtig, keine externe Abhängigkeit)
- **QR-Code:** `qrcode` npm package oder Python equivalent

---

## 5. Sicherheit

- **htpasswd** via nginx — ein gemeinsames Passwort für alle Nutzer (Kollegen + Agenturen)
- HTTPS (Let's Encrypt, bereits auf Server vorhanden)
- Keine Benutzerkonten, keine Rollen — einfaches shared secret
- "Erstellt von" Feld im Generator ist Freitext (Selbstauskunft, kein Auth)

---

## 6. Datenmodell

```sql
CREATE TABLE links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  campaign    TEXT NOT NULL,
  source      TEXT NOT NULL,
  medium      TEXT NOT NULL,
  content     TEXT,
  destination_url TEXT NOT NULL,
  utm_url     TEXT NOT NULL,
  created_by  TEXT,
  note        TEXT,
  status      TEXT DEFAULT 'active'  -- 'active' | 'archived'
);

CREATE TABLE ga4_cache (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  campaign    TEXT,
  source      TEXT,
  medium      TEXT,
  date_range  TEXT,
  sessions    INTEGER,
  users       INTEGER,
  conversions INTEGER,
  bounce_rate REAL,
  avg_engagement_time REAL
);
```

---

## 7. Deployment

- Subdomain: `utm.versino.de` oder `links.versino.de` (Hagen entscheidet)
- nginx vhost nach bestehendem Muster der anderen Apps
- htpasswd-Datei analog zu bestehenden geschützten Apps
- Systemd service oder PM2 für den App-Prozess (je nach bestehendem Setup)
- GA4 Service Account JSON: Pfad vom ausführenden Claude Code festlegen

---

## 8. Out of Scope

- Kein URL-Shortener (keine Short-Links wie utm.versino.de/abc123) — bewusst weggelassen, UTM-URLs bleiben lesbar
- Kein Multi-User mit Rollen
- Kein A/B-Test-Management
- Keine HubSpot-Integration (Phase 2 wenn Bedarf entsteht)

---

## 9. Übergabe an ausführenden Claude Code

1. Dieses Briefing vollständig lesen
2. Bestehenden Stack auf dem Hetzner-Server prüfen (welche Apps laufen bereits, welche Sprache/Framework?)
3. Stack-Entscheidung treffen basierend auf bestehendem Setup (Konsistenz > Perfektion)
4. App aufsetzen, Datenbank initialisieren, nginx konfigurieren
5. GA4 Service Account einbinden
6. htpasswd anlegen und Zugangsdaten an Hagen übergeben
7. Test: Link erstellen → in Registry prüfen → GA4-Daten abrufen
