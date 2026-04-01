Einheitliche Konventionen fuer `utm_source`, `utm_medium`, `utm_campaign` und optional `utm_content` fuer alle Kanaele und Aktivitaeten. Alles lowercase, Trennzeichen Bindestrich (`-`), keine Leerzeichen, keine Umlaute.

---

## Grundregeln

| Parameter      | Bedeutung                                     | Konvention                              |
| -------------- | --------------------------------------------- | --------------------------------------- |
| `utm_source`   | Woher kommt der Traffic? (Plattform/Absender) | Plattformname, immer gleich geschrieben |
| `utm_medium`   | Wie kommt der Traffic? (Kanaltyp)             | Feste Liste, siehe unten                |
| `utm_campaign` | Warum? (Kampagne/Anlass)                      | Schema: `{typ}-{name}-{zeitraum}`       |
| `utm_content`  | Was genau? (optional)                         | Frei, zur Differenzierung innerhalb einer Kampagne |

---

## Source-Liste (utm_source)

| Source           | Verwendung                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linkedin`       | LinkedIn (organisch + paid)                                                                                                                              |
| `google`         | Google Ads                                                                                                                                               |
| `instagram`      | Instagram (organisch + paid)                                                                                                                             |
| `youtube`        | YouTube                                                                                                                                                  |
| `mailing`        | Von uns versendete Massenmailings und Newsletter                                                                                                         |
| `email`          | Direkte E-Mails von Mitarbeitern (inkl. Signaturen)                                                                                                     |
| `ext-{name}`  | Externe Websites, Blogs, Partner, Jobportale, Newsletter, Fachmedien. Z.B. `ext-b1-blog`, `ext-boyum`, `ext-stepstone`, `ext-sap-newsletter` |
| `webinar`        | Webinare                                                                                                                                                 |
| `doc`            | Links in digitalen Dokumenten (PDFs, Whitepapers, Angebote)                                                                                             |
| `off-banner`     | Physisch: Banner, Roll-Ups                                                                                                                               |
| `off-card`       | Physisch: Visitenkarten                                                                                                                                  |
| `off-flyer`      | Physisch: Flyer, Broschueren                                                                                                                             |
| `off-mail`       | Physisch: Direct Mail / Postsendungen                                                                                                                    |
| `off-merch`      | Physisch: Merchandise, Give-Aways                                                                                                                        |
| `off-{typ}`      | Physisch: weitere Offline-Touchpoints nach Bedarf                                                                                                        |

---

## Medium-Liste (utm_medium)

| Medium         | Beschreibung                               | Beispiel-Channels                                      |
| -------------- | ------------------------------------------ | ------------------------------------------------------ |
| `social`       | Organische Social-Media-Posts              | LinkedIn Posts, Instagram Posts, YouTube organisch      |
| `paid-social`  | Bezahlte Social-Media-Anzeigen             | LinkedIn Sponsored, Instagram Ads                      |
| `paid-search`  | Bezahlte Suchanzeigen                      | Google Ads Search                                      |
| `paid-display` | Display-/Banner-Werbung                    | Google Display Network, Programmatic                   |
| `paid-video`   | Video-Werbung                              | YouTube Ads                                            |
| `signature`    | Links in E-Mail-Signaturen                 | Mitarbeiter-Signaturen                                 |
| `link`         | Textlink / Verweis                         | Links in Mails, auf Websites, in Dokumenten            |
| `button`       | Button-Link (zur Abgrenzung von Textlinks) | CTA-Buttons in Mails, auf Landingpages, in Dokumenten  |
| `qr`           | QR-Codes auf physischen Materialien        | Banner, Flyer, Messestand, Visitenkarten               |

---

## Campaign-Namensschema

```
{typ}-{kurzname}-{zeitraum}
```

### Typ-Praefix

| Praefix  | Kategorie                     | Beispiele                                     |
| -------- | ----------------------------- | --------------------------------------------- |
| `k123-`  | Marketing-Kampagnen           | Produktlaunches, Themen-Kampagnen, Promotions |
| `brand-` | Everyday Marketing / Branding | Laufende Markenarbeit, Awareness              |
| `job-`   | Recruiting-Kampagnen          | Stellenanzeigen, Employer Branding            |
| `event-` | Event-/Messe-Kampagnen        | Messe-Auftritte, Webinare                     |
| `other-` | Sonstiges                     | Interne Projekte, Tests                       |

### Zeitraum

| Format    | Verwendung                           |
| --------- | ------------------------------------ |
| `q1-26`   | Quartal (laufende Aktivitaeten)      |
| `2026-04` | Monat (zeitlich begrenzte Kampagnen) |

Kein Zeitraum = dauerhaft (z.B. E-Mail-Signaturen, Visitenkarten).

### Beispiele

| Kampagne                            | utm_campaign                             |
| ----------------------------------- | ---------------------------------------- |
| SAP B1 Cloud Launch Q2              | `k123-b1-cloud-launch-q2-26`            |
| LinkedIn Thought Leadership laufend | `brand-linkedin-thoughtleadership-q2-26` |
| Recruiting Entwickler Altoetting    | `job-dev-altoetting-2026-04`             |
| DSAG Jahreskongress 2026            | `event-dsag-kongress-2026-10`            |
| E-Mail-Signatur dauerhaft           | `brand-signatur`                         |
| Whitepaper Download Kampagne        | `k123-whitepaper-migration-q2-26`        |

---

## utm_content (optional)

Zur Differenzierung innerhalb einer Kampagne. Frei benennbar, aber konsistent halten.

| Anwendung          | Beispiel utm_content                                       |
| ------------------ | ---------------------------------------------------------- |
| A/B-Test Varianten | `variante-a`, `variante-b`                                 |
| Dokumenttyp        | `whitepaper-sap-cloud`, `angebot-muster`, `casestudy-xyz`  |
| CTA-Position       | `hero-cta`, `footer-cta`                                   |
| Anzeigen-Variante  | `bild-1`, `video-kurz`                                     |
