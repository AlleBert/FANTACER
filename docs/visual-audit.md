# Visual Quality Audit

## Perché esiste

Il visual audit è il terzo livello di qualità visuale, dopo:

| Livello | Scopo | Strumento |
|---------|-------|-----------|
| **Responsive tests** | Verificano che nulla si rompa | Playwright + helper responsive |
| **Visual regression** | Rilevano cambiamenti rispetto a baseline | `toHaveScreenshot()` |
| **Visual audit** | Valutano la qualità del design | Screenshot + metriche layout |

Il visual audit **non** controlla che l'interfaccia sia identica a una baseline.
Serve a produrre materiale per una revisione UX/UI umana o tramite LLM.

Sono disponibili 4 audit complementari, ciascuno con il proprio focus:

| Comando | Spec | Copertura | Report |
|---|---|---|---|
| `npm run visual:audit` | `tests/e2e/visual-audit.spec.ts` | 9 route × 3 viewport (chromium) | `tests/e2e/visual-audit/report.json` |
| `npm run visual:audit:admin` | `tests/e2e/visual-audit-admin-only.spec.ts` | 6 route admin × 3 viewport (chromium) | `tests/e2e/visual-audit/report-admin.json` |
| `npm run visual:audit:homepage` | `tests/e2e/visual-audit-homepage.spec.ts` | homepage × 6 viewport + sub-elementi + score (chromium) | `tests/e2e/visual-audit-homepage/report.json` |
| `npm run visual:audit:ios` | `tests/e2e/visual-audit-homepage-ios.spec.ts` | homepage × 7 dispositivi iOS (WebKit) | `tests/e2e/visual-audit-homepage-ios/report-{device}.json` |

Ogni comando è già **scoped al progetto corretto** (vedi "Limitazioni"): i primi tre girano solo su `chromium`, l'ultimo solo sui 7 progetti WebKit iOS. Non eseguire questi spec senza filtro di progetto: verrebbero raccolti su tutti gli 11 progetti e gli output (non scoped per progetto) si sovrascriverebbero a vicenda in modo non deterministico.

---

## 1. Audit completo — `npm run visual:audit`

Analizza tutto il sito (homepage, coming-soon, login admin e 6 dashboard admin) su 3 viewport.

```bash
npm run visual:audit
```

### Route analizzate

| Route | Sezioni |
|-------|---------|
| `/` | hero, intro, how-it-works, play-again, prize-location, search, public-ranking, live-ranking, contact |
| `/coming-soon` | hero |
| `/admin/login` | login-card |
| `/admin/dashboard/panoramica` | page-header, stat-cards, chart-area |
| `/admin/dashboard/aziende` | page-header, card-content |
| `/admin/dashboard/voti` | page-header, search-input, vote-content |
| `/admin/dashboard/impostazioni` | page-header, coming-soon-toggle |
| `/admin/dashboard/sponsor` | page-header, sponsor-list |
| `/admin/dashboard/import` | page-header, upload-area |

### Viewport testati

| Nome | Larghezza | Altezza |
|------|-----------|---------|
| mobile | 375 | 812 |
| tablet-portrait | 768 | 1024 |
| desktop | 1440 | 900 |

### Output

```
tests/e2e/visual-audit/
├── screenshots/{route}/{viewport}/
│   ├── viewport.png
│   └── {section}.png
└── report.json
```

Le route admin richiedono autenticazione: `setupAdminForTest()` in `tests/e2e/helpers/auth.ts` esegue il login e naviga alla route prima dell'analisi.

---

## 2. Audit admin — `npm run visual:audit:admin`

Sottoinsieme del primo, focalizzato solo sulle 6 dashboard admin. Oltre a `viewport.png` e `{section}.png`, cattura anche la **bottom-nav** mobile quando presente (`nav[role="tablist"]`).

```bash
npm run visual:audit:admin
```

### Route analizzate

Le 6 route admin elencate nella sezione 1 (panoramica, aziende, voti, impostazioni, sponsor, import), con gli stessi selettori di sezione.

### Viewport testati

Come sezione 1 (mobile, tablet-portrait, desktop).

### Output

```
tests/e2e/visual-audit/
├── screenshots/admin-dashboard-{route}/{viewport}/
│   ├── viewport.png
│   ├── bottom-nav.png
│   └── {section}.png
└── report-admin.json
```

---

## 3. Audit homepage responsive — `npm run visual:audit:homepage`

Analisi di dettaglio della sola homepage sui 6 viewport, con analisi per sub-elementi (interactive, images, headings, text blocks, layout anomalies) e un `responsivenessSummary` con score.

```bash
npm run visual:audit:homepage
```

### Sezioni analizzate

Le 9 sezioni della homepage (`main > section:nth-child(1..9)`): hero, intro, how-it-works, play-again, prize-location, search, public-ranking, live-ranking, contact.

### Viewport testati

| Nome | Larghezza | Altezza |
|------|-----------|---------|
| mobile-small | 320 | 640 |
| mobile | 375 | 812 |
| tablet-portrait | 768 | 1024 |
| tablet-landscape | 1024 | 768 |
| desktop | 1440 | 900 |
| desktop-wide | 1920 | 1080 |

### Output

```
tests/e2e/visual-audit-homepage/
├── screenshots/{viewport}/
│   ├── fullpage.png
│   └── {section}.png
└── report.json
```

Il report aggiunge, rispetto alla sezione 1:

- **subElementReports** per sezione — elementi interattivi (touch target ≥ 36px), immagini (distorsione aspect ratio > 0.05, alt mancante), heading, blocchi di testo (larghezza < 40% del container), anomalie di layout (elementi `absolute`/`fixed` che oltrepassano il viewport);
- **responsivenessSummary** — conteggio di elementi `fullyResponsive` / `partiallyResponsive` / `broken` e uno score percentuale complessivo.

---

## 4. Audit iOS — `npm run visual:audit:ios`

Valuta la homepage su dispositivi Apple reali tramite i progetti WebKit di Playwright.

```bash
npm run visual:audit:ios
```

**Importante**: deve girare con `--workers=1` (già impostato nello script npm) per evitare disconnessioni del browser WebKit.

### Dispositivi coperti

| Progetto | Dispositivo |
|---|---|
| `ios-se` | iPhone SE (3rd gen) |
| `ios-iphone` | iPhone 13 |
| `ios-pro-max` | iPhone 15 Pro Max |
| `ios-ipad-portrait` | iPad Mini (portrait) |
| `ios-ipad-landscape` | iPad Mini (landscape) |
| `ios-ipad-pro-portrait` | iPad Pro 11 (portrait) |
| `ios-ipad-pro-landscape` | iPad Pro 11 (landscape) |

### Output

```
tests/e2e/visual-audit-homepage-ios/
├── screenshots/{device}/
│   ├── fullpage.png
│   └── {section}.png
└── report-{device}.json
```

Ogni report per dispositivo include `device`, `userAgent`, `viewport`, `issueCount` e la stessa struttura per sezione/sub-elemento dell'audit homepage.

---

## Report JSON

Per ogni sezione contiene:

- **box** — Posizione e dimensione (x, y, width, height)
- **metrics** — Padding, offset, child count
- **typography** — Font size, line-height, numero righe per heading/paragrafi/button
- **issues** — Problemi rilevati automaticamente:
  - `error` — Elementi oltre il bordo del contenitore
  - `warning` — Touch target troppo piccoli, overflow
  - `info` — Sezioni vuote, padding eccessivo, wrapping anomalo

La logica di analisi è centralizzata in `tests/e2e/helpers/layout-analysis.ts` (`collectSectionReport()` e `collectSubElementReport()`).

## Cosa NON fa

- Non modifica CSS, layout o componenti
- Non introduce dipendenze esterne
- Non usa `toHaveScreenshot()` — non fa visual regression
- Non altera il comportamento dell'applicazione
- Non interferisce con i test esistenti

Serve esclusivamente come **strumento decisionale** per identificare aree di miglioramento.

## Limitazioni

- Le sezioni sono identificate tramite selettori CSS basati sulla struttura DOM corrente. Se la struttura cambia (nuovo ordine sezioni, classi rinominate), i selettori vanno aggiornati
- Le sezioni condizionali (es. SuccessSection dopo voto) non sono coperte
- La pagina admin/login viene reindirizzata automaticamente in sviluppo (dev bypass). Se serve l'analisi della pagina di login in produzione, eseguire il comando senza bypass
- Le metriche di tipografia e layout sono raccolte via `page.evaluate()` e dipendono dal rendering client-side
- L'audit iOS richiede `--workers=1` per evitare disconnessioni WebKit (già impostato nello script npm)
- **Scoping progetto**: `visual:audit`, `visual:audit:admin` e `visual:audit:homepage` ruotano su `chromium` (l'audit forza i viewport via `test.use`, quindi un singolo motore basta; girando su altri progetti i device context mobile/iOS resterebbero attivi su viewport forzati, e gli output senza scoping progetto si sovrascriverebbero). `visual:audit:ios` gira solo sui 7 progetti `ios-*` WebKit via `--project`. Non rimuovere i filtri `--project` dagli script npm
- Gli artefatti generati (screenshot e report) sono gitignored; gli spec e la documentazione sono versionati

## Esempio di revisione tramite LLM

Dopo aver generato screenshot e report:

```bash
# 1. Catturare il percorso degli screenshot
find tests/e2e/visual-audit/screenshots -name "*.png" > /tmp/screenshots.txt

# 2. Condividere con un LLM:
#    - Il report.json per metriche oggettive
#    - Gli screenshot per valutazione visuale
#    - Chiedere: "Analizza qualità UI/UX, spacing,
#      gerarchia visiva, responsive design e
#      problemi di layout"
```
