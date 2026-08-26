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
| `npm run visual:audit:ios` | `tests/e2e/visual-audit-homepage-ios.spec.ts` | homepage × 7 dispositivi iOS (WebKit) | `tests/e2e/visual-audit-homepage-ios/standard/report-{device}.json` |
| `npm run visual:audit:ios:safearea` | `tests/e2e/visual-audit-homepage-ios-safearea.spec.ts` | homepage × 7 dispositivi iOS (WebKit), safe-area simulata | `tests/e2e/visual-audit-homepage-ios/safe-area/report-{device}.json` |
| `npm run visual:audit:ios:chrome` | `tests/e2e/visual-audit-homepage-ios-chrome.spec.ts` | homepage × 7 dispositivi iOS (WebKit), viewport/chrome stress | `tests/e2e/visual-audit-homepage-ios/chrome-stress/report-{device}.json` |
| `npm run visual:audit:summary` | `scripts/generate-audit-summary.mjs` | aggregazione offline di tutti i report sopra | `tests/e2e/audit-summary/summary.json` + `summary.md` |

I due audit iOS modali richiedono la variabile `VISUAL_IOS_MODAL=1` (impostata negli script npm): senza, gli spec vengono saltati nel normale `test:e2e`. Tutti i comandi sono **scoped al progetto corretto** (vedi "Limitazioni"): i primi tre girano solo su `chromium`, gli ultimi tre solo sui 7 progetti WebKit iOS con `--workers=1`. Non eseguire questi spec senza filtro di progetto: verrebbero raccolti su tutti gli 11 progetti e gli output (non scoped per progetto) si sovrascriverebbero a vicenda in modo non deterministico.

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

Nota: con `voting_enabled=false` (pre-fiera, fuori progetto E2E) la sezione `live-ranking` non è renderizzata → le sezioni diventano 8 e gli indici `nth-child` slittano. Negli audit E2E il flag è `true` (default) quindi la lista resta valida.

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
├── report.json                      ← aggregato generale (vedi sotto)
├── standard/
│   ├── screenshots/{device}/
│   │   ├── fullpage.png
│   │   └── {section}.png
│   └── report-{device}.json
├── safe-area/
│   └── ...
└── chrome-stress/
    └── ...
```

Ogni report per dispositivo include `device`, `userAgent`, `viewport`, `issueCount` e la stessa struttura per sezione/sub-elemento dell'audit homepage.

### Report generale `report.json`

`npm run visual:audit:summary` aggrega anche un `report.json` nella radice di `visual-audit-homepage-ios/`, speculare a `tests/e2e/visual-audit-homepage/report.json` (stesse 4 chiavi top-level: `generatedAt`, `spec`, `responsivenessSummary`, `routes`):

- **`responsivenessSummary`** — stessa identica logica dell'audit homepage (touch target ≥ 36px + distorsione immagini ≤ 0.05) applicata ai 7 device della suite standard;
- **`routes`** — array con **tutti** i report raw delle tre cartelle (`standard`, `safe-area`, `chrome-stress`), ciascuno taggato `mode`. Le suite non ancora eseguite risultano semplicemente assenti (il tracking `missing` resta in `audit-summary/`).

---

## 5. Audit iOS safe-area — `npm run visual:audit:ios:safearea`

Valuta la homepage con **safe area simulate** (notch / Dynamic Island / home indicator) sugli stessi 7 dispositivi WebKit.

```bash
npm run visual:audit:ios:safearea
```

### Perché una modalità dedicata

Playwright/WebKit **non simula `env(safe-area-inset-*)` reali**: i device profile iOS di Playwright non rendono il notch né l'home indicator. L'audit emula l'effetto sul layout **overrideando i token CSS di consumo** (`--safe-area-inset-*` in `:root`), che il progetto usa in `--safe-top`/`--safe-bottom`/`--safe-x` (vedi `docs/responsive-system.md`). I valori sono i tipici di iPhone moderni e iPad:

| Device | `--safe-area-inset-top` | `--safe-area-inset-bottom` |
|---|---|---|
| iPhone SE (senza notch) | 20px | 0 |
| iPhone 13 / 15 Pro Max | 47px / 59px | 34px |
| iPad (portrait / landscape) | 24px | 20px / 21px |

### Cosa verifica

- Per ogni sezione: micro-scroll, overflow orizzontale, altezza vs viewport, box nel viewport (stessa logica dello spec strutturale).
- Elementi `fixed`/`sticky` o ancorati ai bordi che escono dalla viewport (layout anomalies).
- Nel `ContactSection`: il footer legale (ancorato in basso) non deve essere oscurato dall'home indicator simulato.
- Screenshot e report per device.

### Output

```
tests/e2e/visual-audit-homepage-ios/safe-area/
├── screenshots/{device}/{section}.png
└── report-{device}.json
```

**Nota (documentata):** questo è il miglior test automatizzabile possibile. Il notch reale, la Dynamic Island e il comportamento Safari richiedono verifica manuale su device fisici.

---

## 6. Audit iOS viewport/chrome stress — `npm run visual:audit:ios:chrome`

Valuta la homepage in **condizioni di viewport mobile variabile** (URL bar che compaiono/scompaiono, viewport strette e basse) sugli stessi 7 dispositivi WebKit.

```bash
npm run visual:audit:ios:chrome
```

### Viewport stress

Per ogni device vengono applicate delle viewport ridotte via `page.setViewportSize`, inclusi casi estremi e landscape:

| Stress | Esempio (iPhone 13) |
|---|---|
| viewport ridotta verticale (URL bar visibile) | 390×548 |
| viewport bassa | 390×480 |
| viewport stretta | 320×480 |
| landscape bassa | 844×390 |

### Cosa verifica

- Per ogni sezione e per ogni viewport stress: micro-scroll, overflow orizzontale, altezza vs viewport, box nel viewport, CTA/controlli raggiungibili.
- Se una sezione non ci sta nello spazio disponibile perché il contenuto è realmente troppo grande, il test **fallisce** (non è un warning): va corretta la causa (spacing/tipografia/layout fluido) o reso esplicito lo scroll interno intenzionale.

### Output

```
tests/e2e/visual-audit-homepage-ios/chrome-stress/
├── screenshots/{device}/{viewportW}x{viewportH}/{section}.png
└── report-{device}.json
```

---

## 7. Audit strutturale responsive — `npm run test:e2e`

`tests/e2e/responsive-structural.spec.ts` è parte del normale `test:e2e` (gate CI) e gira su **chromium** + **mobile-webkit** per i 6 viewport di `helpers/viewports.ts`. A differenza degli audit decisionali, usa **assert reali**: ogni violazione (micro-scroll, overflow, sezione più alta del viewport, box fuori viewport) fallisce il test. Identifica le sezioni con `main > section` (robusto al riordino del DOM). Scrive anche `tests/e2e/responsive-structural/report.json` (consumato dal riepilogo).

---

## 8. Report riepilogativo — `npm run visual:audit:summary`

Aggrega i report JSON di **tutte le suite** in un unico riepilogo:

```bash
npm run visual:audit:summary
```

- **`tests/e2e/audit-summary/summary.json`** — per ogni suite: comando, stato (`generated`/`missing`), report path, viewport/device analizzati con dimensioni, issue per severità, score homepage, gate strutturale, footer issue (safe-area) e failure strutturali (chrome). Contiene anche la sezione `overall.viewportsAnalyzed` con l'elenco preciso di ogni (suite, viewport, width×height, device).
- **`tests/e2e/audit-summary/summary.md`** — versione leggibile.
- **`tests/e2e/visual-audit-homepage-ios/report.json`** — report generale iOS (aggrega standard + safe-area + chrome-stress), speculare al report della homepage: vedi sezione 4.

È un post-processing offline (nessun browser): **non incide sui tempi degli audit**. Le suite non ancora eseguite vengono segnalate come `missing`. Rigenerare il riepilogo dopo ogni run per aggiornare i dati.

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

- Le sezioni sono identificate tramite selettori CSS basati sulla struttura DOM corrente. Se la struttura cambia (nuovo ordine sezioni, classi rinominate), i selettori vanno aggiornati. Lo spec strutturale (`responsive-structural.spec.ts`) usa `main > section` generico
- Le sezioni condizionali (es. SuccessSection dopo voto) non sono coperte dagli audit standard (parzialmente da `voting-flow.spec.ts`)
- La pagina admin/login viene reindirizzata automaticamente in sviluppo (dev bypass). Se serve l'analisi della pagina di login in produzione, eseguire il comando senza bypass
- Le metriche di tipografia e layout sono raccolte via `page.evaluate()` e dipendono dal rendering client-side
- Gli audit iOS richiedono `--workers=1` per evitare disconnessioni WebKit (già impostato negli script npm). I due audit modali (`safearea`, `chrome`) richiedono `VISUAL_IOS_MODAL=1` (impostato negli script npm): senza, vengono saltati nel normale `test:e2e` per non allungare il gate CI. **Non lanciare due suite WebKit contemporaneamente** (es. `visual:audit:ios:*` e `responsive-structural` su mobile-webkit in parallelo): WebKit va in connection-refused
- **Banner cookie**: gli audit che catturano schermate pubbliche impostano il cookie `fantacer_cookie_consent` prima del load (`seedConsentCookie` in `tests/e2e/helpers/cookie-consent.ts`), così il banner non compare nelle schermate e non servono attese per il dismiss. Le baseline `toHaveScreenshot` di `homepage.spec.ts` presuppongono il banner assente: rigenerarle con `npx playwright test tests/e2e/homepage.spec.ts --project=chromium --update-snapshots`
- Il **riepilogo** (`npm run visual:audit:summary`) legge i report già generati: eseguirlo dopo gli audit che interessano; le suite non eseguite risultano `missing`
- Playwright/WebKit non simula `env(safe-area-inset-*)` reali: l'audit safe-area emula l'effetto sul layout overrideando i token CSS. Il notch reale, la Dynamic Island e il comportamento Safari richiedono verifica manuale su device
- **Scoping progetto**: `visual:audit`, `visual:audit:admin` e `visual:audit:homepage` ruotano su `chromium` (l'audit forza i viewport via `test.use`, quindi un singolo motore basta; girando su altri progetti i device context mobile/iOS resterebbero attivi su viewport forzati, e gli output senza scoping progetto si sovrascriverebbero). Gli audit iOS (`visual:audit:ios`, `:safearea`, `:chrome`) girano solo sui 7 progetti `ios-*` WebKit via `--project`. Non rimuovere i filtri `--project` dagli script npm
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
