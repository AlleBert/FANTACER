# Fantacer

[![CI](https://github.com/AlleBert/FANTACER/actions/workflows/ci.yml/badge.svg)](https://github.com/AlleBert/FANTACER/actions/workflows/ci.yml)

Voting platform for Fantacitorio.

## Setup

```bash
npm install
cp .env.example .env.local  # then fill in Supabase credentials
```

### Turnstile (voto)

La verifica è server-side e **fail-closed** (`src/lib/turnstile.ts`). In
produzione sono obbligatori:

- `TURNSTILE_SECRET_KEY` — chiave **reale** (le testing key sono rifiutate in produzione);
- `TURNSTILE_ALLOWED_HOSTNAMES` — allowlist **esatta** (comma-separated, nessuna
  wildcard), es. `www.fantacer.com,fantacer.com`.

Il widget invia `action: "vote"`, verificata lato server; il timeout Siteverify è
4,5s. Se la configurazione manca, il voto viene rifiutato (fail-closed).

Le **testing key** Cloudflare sono rifiutate di default. L'unica eccezione è
l'**harness E2E locale**: sono ammesse solo se `VERCEL` è assente **e**
`E2E_ALLOW_TURNSTILE_TEST_KEYS === "true"` (variabile server-only, mai
`NEXT_PUBLIC_*`, impostata esclusivamente nel processo webServer di Playwright,
mai sugli environment Vercel). Su **qualsiasi** deployment Vercel (preview e
production) restano **sempre** rifiutate, anche se il flag fosse impostato per
errore. Per staging/preview usare una coppia reale dedicata all'hostname esatto
(es. `staging.fantacer.com`).

## Development

```bash
npm run dev
```

---

# Contact Form (Vercel + Resend)

Il form di contatto nella sezione «PARLA CON NOI» invia i dati a `POST /api/contact`
(Vercel Serverless Function), che valida, applica anti-spam/rate limiting e invia
l'email tramite **Resend**. Il browser non comunica mai direttamente con Resend e
non possiede alcuna API key.

- **Architettura**: `React` → `POST /api/contact` → validazione + honeypot + rate limiting (DB) → Resend API → tua casella email.
- **Documentazione completa**: [`docs/contact-form.md`](docs/contact-form.md)
- **Variabili richieste**: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (vedi [`.env.example`](.env.example)).
- **Prima del deploy**: verifica il dominio su Resend (record SPF/DKIM) e configura le env in Vercel.

---

# Accesso Admin (sistema di login)

L'area amministrativa è protetta da un **login** su `/admin/login` con due livelli di accesso:

1. **Password** — email + password verificata tramite Supabase Auth;
2. **Codice TOTP (MFA)** — obbligatorio per il ruolo `admin` (Google Authenticator, 1Password, ecc.), **non richiesto** per il ruolo `viewer`.

### Ruoli

| Ruolo | Livello sessione | MFA | Permessi |
|---|---|---|---|
| `admin` | AAL2 (password + TOTP verificato) | **Obbligatoria** | Completi: letture + tutte le scritture + export |
| `viewer` | AAL1 (sola password) | No | **Read-only**: stesse sezioni e navigazione, nessuna scrittura, nessun export |

Il server emette una **sessione sicura in cookie HttpOnly** (mai `localStorage`), valida solo se l'utente esiste nella tabella `admin_users` con `is_active = true`. Il ruolo è persistito nella colonna `role` di `admin_users` (`'admin' | 'viewer'`, default `'admin'`).

- Le pagine `/admin/dashboard/*` senza sessione reindirizzano al login; senza il livello richiesto rispondono secondo il ruolo.
- Gli **admin senza MFA configurata** vengono bloccati al login con l'errore `mfa_not_configured` (nessun auto-enroll, nessun loop): vanno ri-provisionati con `--force`.
- Tutte le **scritture** (sponsors CRUD, batch attiva/reset/elimina, import aziende, coming-soon) e l'**export analytics** sono gate **admin-only** server-side (`requireRoleAdmin`): un viewer riceve `403` anche forzando la chiamata. La UI read-only per i viewer è comfort, non sicurezza.

### Implementazione (file chiave)

| Componente | File |
|---|---|
| Verifica lato server (`requireAdmin` / `requireRoleAdmin`) | `src/lib/admin-auth.ts` |
| Protezione route (ex-middleware) + security headers | `src/proxy.ts` |
| Pagina di login | `src/app/admin/login/page.tsx` |
| API di login / challenge MFA / verify / logout / me | `src/app/api/admin/*` |
| Tabella amministratori | `admin_users` (migrazione `supabase/migrations/20260811_add_admin_role_column.sql`) |

### Protezioni incluse

- **Rate limiting** su DB — login: 10 tentativi / 15 min, verifica MFA: 5 / 15 min (per IP + email/factor);
- **Audit trail** — ogni evento (login, MFA, logout, rate-limit) viene scritto in `audit_logs`;
- **Security headers** — CSP nonce-based, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` applicati in `src/proxy.ts`.

## Aggiungere un nuovo utente admin / viewer

C'è un comando dedicato che crea l'utente completo (Auth + riga `admin_users` + codice TOTP):

```bash
npm run provision:e2e:admin -- --email=nuovo.utente@fantacer.it --password=una-password-lunga --yes
```

Cosa fa, in 3 passaggi:

1. crea (o trova) l'utente in **Supabase Auth** con email confermata;
2. garantisce la riga in **`admin_users`** con `is_active = true` e `role` (default `admin`);
3. **enrolla e verifica un factor TOTP** e stampa secret base32 + **URI `otpauth://`** + **QR SVG scansionabile** (per configurare l'authenticator).

Al termine scrive in `.env.local` le variabili `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` ed `E2E_ADMIN_TOTP_SECRET`, mostrandole anche a schermo.

**Requisiti**: nel file `.env` (o `.env.local`) servono `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` — lo script li carica automaticamente.

### Varianti utili

| Comando | Effetto |
|---|---|
| `npm run provision:e2e:admin` | Sessione interattiva (chiede email, password, conferma) |
| `... -- --email=a@b.it --password=P@ssw0rd --yes` | Non interattivo, scrittura automatica in `.env.local` |
| `... -- --role=viewer` | Crea/aggiorna un utente **viewer** (read-only, AAL1, **senza TOTP**) |
| `... -- --role=admin` | Default: ruolo admin con TOTP (equivalente a nessun flag) |
| `... -- --force` | Rimuove il factor TOTP esistente e ne crea uno nuovo |
| `... -- --verify` | Effettua un login completo (password + TOTP) per validare le env |
| `... -- --help` | Mostra la guida completa |

**Nota** sul codice TOTP: va aggiunto all'authenticator del nuovo utente (il secret base32 viene mostrato una sola volta). Se si perde, si rigenera con `--force`. Per gli utenti `admin` lo script genera anche un file **QR SVG** in `./.qr/` (gitignored): **apri il file e scansionalo con l'app authenticator** per caricare label + secret senza digitare.

> **Google Authenticator — inserimento manuale**: GA rifiuta il secret in MAIUSCOLO con l'errore "carattere non valido nel valore del codice". Incollare il secret **in minuscolo** (es. `5o72hzwtz5bpcwf2ed36w7tfosttuuzp`). Il valore in `.env.local` è in maiuscolo: convertire prima dell'inserimento. **Suggerimento**: con il QR SVG il problema non si pone (nessuna digitazione).

---

# Engineering Quality System

Il progetto include una pipeline automatizzata per garantire:

- **qualità del codice** — TypeScript strict, ESLint, typecheck automatico;
- **stabilità frontend** — test unitari (Jest), test E2E (Playwright), snapshot visivi;
- **compatibilità responsive** — 6 viewport, 4 browser, verifiche di overflow e clipping;
- **accessibilità** — scansioni WCAG 2.1 AA con `@axe-core/playwright` su tutte le route;
- **qualità visuale** — visual audit con screenshot, metriche layout e analisi tipografia: 9 route × 3 viewport (audit completo), 6 route admin, homepage × 6 viewport e homepage × 4 dispositivi iOS;
- **prevenzione regressioni** — smoke test (6 route), scroll-blocking regression, voting flow E2E;
- **controllo performance** — Lighthouse CI locale, bundle analysis;
- **osservabilità produzione** — Sentry noop-ready (attivabile con DSN).

**Principio**: ogni modifica significativa deve passare attraverso una serie di controlli automatici prima di essere considerata pronta.

---

# Architecture Overview

```
Developer / AI Agent
        |
        v
Local Quality Check (npm run ui:health)
        |
        v
GitHub Actions (CI)
        |
        v
Build Validation (npm run build)
        |
        v
E2E / Accessibility / Visual Checks (Playwright)
        |
        v
Deployment (manuale)
        |
        v
Monitoring (Sentry, opzionale)
```

**Local Quality Check** — `npm run ui:health` esegue lint, typecheck, unit test ed E2E in sequenza. È il gate più rapido, eseguito localmente prima di ogni commit.

**GitHub Actions** — riproduce esattamente la stessa sequenza in ambiente pulito. Blocca PR e push su `main`/`develop` in caso di fallimento.

**Build Validation** — `next build` verifica che il progetto compili e produca un bundle valido.

**E2E / Accessibility / Visual Checks** — Playwright esegue 21 spec file su 11 progetti browser (4 core + 7 iOS WebKit), inclusi snapshot, scansioni a11y, visual audit e verifica flussi utente reali.

**Deployment** — manuale, dopo approvazione CI.

**Monitoring** — Sentry è configurato ma inerte senza DSN. Attivandolo cattura errori runtime senza influenzare lo sviluppo.

---

# Phase 1 — Continuous Integration Foundation

## Cosa è stato introdotto

- **GitHub Actions workflow** (`.github/workflows/ci.yml`) — attivato su push a `main`/`develop` e su tutte le PR;
- `npm ci` per installazione deterministica;
- **ESLint** (`npm run lint`) con configurazione Next.js;
- **TypeScript strict** (`npm run typecheck`) — `tsc --noEmit`;
- **Jest** (`npm test`) — suite unit con `ts-jest` e jsdom (oggi 56 suite / 341 test);
- **Next production build** (`npm run build`).

## Perché

- evitare codice non compilabile nel repository;
- bloccare errori di tipo, lint e test logic prima del merge;
- avere un processo automatizzato e ripetibile in ambiente CI pulito.

## Comandi

```bash
npm run lint       # ESLint — zero-error policy
npm run typecheck  # TypeScript strict, noEmit
npm test           # Jest unit test
```

Nella pipeline CI questi tre comandi vengono eseguiti PRIMA della build, in modo da fallire velocemente sugli errori più economici da diagnosticare.

---

# Phase 2 — Responsive & Accessibility Validation System

## Responsive testing

### Browser (Playwright, 11 progetti)

| Progetto | Browser | Viewport |
|---|---|---|
| `chromium` | Chromium (Desktop Chrome) | 1440×900 |
| `firefox` | Firefox (Desktop) | 1440×900 |
| `mobile-chrome` | Pixel 5 (Mobile Chrome) | 375×812 |
| `mobile-webkit` | iPhone 13 (Mobile Safari) | 390×664 (nativo) |
| `ios-se` | iPhone SE (3rd gen) | nativo |
| `ios-iphone` | iPhone 13 | nativo |
| `ios-pro-max` | iPhone 15 Pro Max | nativo |
| `ios-ipad-portrait` | iPad Mini (portrait) | nativo |
| `ios-ipad-landscape` | iPad Mini (landscape) | nativo |
| `ios-ipad-pro-portrait` | iPad Pro 11 (portrait) | nativo |
| `ios-ipad-pro-landscape` | iPad Pro 11 (landscape) | nativo |

I 7 progetti `ios-*` (WebKit) sono definiti in `playwright.config.ts`; `npm run visual:audit:ios` ne esegue 4 (SE, iPhone 13, Pro Max, iPad Mini portrait) come da matrice ridotta in `AGENTS.md`. Lo spec resta eseguibile su tutti i 7 progetti.

### Viewport coperti

I test responsive nei file `homepage.spec.ts`, `admin.spec.ts` e `voting-flow.spec.ts` iterano su 6 viewport definiti in `tests/e2e/helpers/viewports.ts`:

| Viewport | Larghezza | Altezza |
|---|---|---|
| mobile-small | 320 | 640 |
| mobile | 375 | 812 |
| tablet-portrait | 768 | 1024 |
| tablet-landscape | 1024 | 768 |
| desktop | 1440 | 900 |
| desktop-wide | 1920 | 1080 |

### Cosa viene verificato

- **overflow orizzontali** (`checkNoHorizontalOverflow`) — `document.body.scrollWidth <= clientWidth + 1`;
- **clipping testo** (`checkNoTextClipping`) — elementi testo (p, span, h1-h4, button, a, label, li, td, th) che oltrepassano il bordo del genitore;
- **elementi interattivi non raggiungibili** (`checkInteractiveElementsReachable`) — button, a[href], input, [role="button"], [tabindex] con `display:none`, `visibility:hidden`, `opacity:0` o dimensioni zero ma con `offsetParent !== null`.

### Helper

Tutti i check sono in `tests/e2e/helpers/responsive.ts`.

---

## Accessibility testing

- **Strumento**: `@axe-core/playwright` con tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`;
- **Standard**: WCAG 2.1 AA;
- **Copertura**: 6 route (`/`, `/coming-soon`, `/admin/login`, `/admin/dashboard/panoramica`, `/admin/dashboard/aziende`, `/admin/dashboard/voti`).

### Violazioni conosciute

Le violazioni note sono documentate in `tests/e2e/accessibility.spec.ts` come `allowedViolations` per ogni route. Una nuova violazione non registrata blocca il test.

| Route | Violazioni permesse | Motivo |
|---|---|---|
| `/` | nessuna | — |
| `/coming-soon` | nessuna | — |
| `/admin/login` | `color-contrast` | brand orange su sfondo bianco |
| `/admin/dashboard/panoramica` | `color-contrast` | rosso/arancione palette brand |
| `/admin/dashboard/aziende` | `color-contrast` | pulsanti arancione |
| `/admin/dashboard/voti` | nessuna | — |

Ogni violazione permessa include una `reason` testuale che spiega perché è accettata e cosa serve per rimuoverla.
Le violazioni sono tracciate anche in `docs/frontend-quality.md`.

---

## Visual regression

### Screenshot testing

- **Strumento**: Playwright `toHaveScreenshot`;
- **Browser**: Chromium e Mobile WebKit (gli screenshot sono saltati su Firefox e Mobile Chrome);
- **Elementi catturati**:
  - Hero section (prima `section` della homepage);
  - Search section (sezione contenente "Cerca" o "Azienda");
- **Baseline**: immagini PNG in `tests/e2e/screenshots/{projectName}/{testFilePath}/`.

### Perché esiste

Evitare modifiche CSS accidentali che alterano l'aspetto visivo delle sezioni principali. Le baseline si aggiornano con:

```bash
npx playwright test --update-snapshots
```

**Nota**: le directory `screenshots/firefox/` e `screenshots/mobile-chrome/` contengono snapshot storici ma non vengono più aggiornati dal codice attuale (i test sono limitati a Chromium e Mobile WebKit). Possono essere rimossi.

---

## Visual audit

Analisi visuale proattiva che produce screenshot e metriche per valutare la qualità UI/UX. Comprende 4 audit complementari:

| Comando | Copertura | Output |
|---|---|---|
| `npm run visual:audit` | 9 route × 3 viewport (sito completo + admin) | `tests/e2e/visual-audit/report.json` |
| `npm run visual:audit:admin` | 6 route admin × 3 viewport (+ bottom-nav) | `tests/e2e/visual-audit/report-admin.json` |
| `npm run visual:audit:homepage` | homepage × 6 viewport + sub-elementi + score | `tests/e2e/visual-audit-homepage/report.json` |
| `npm run visual:audit:ios` | homepage × 4 dispositivi iOS (WebKit: SE, 13, Pro Max, iPad Mini portrait) | `tests/e2e/visual-audit-homepage-ios/standard/report-{device}.json` |

### Cosa fanno

- **Screenshot** full-page e per sezione (variabile per spec, vedi `docs/visual-audit.md`)
- **Metriche layout** — dimensione, padding, offset per ogni sezione
- **Analisi tipografia** — font-size, line-height, numero righe per heading e paragrafi
- **Rilevamento automatico** di overflow, touch target insufficienti, wrapping anomalo, immagini deformate e layout broken
- **Homepage** aggiunge l'analisi per sub-elementi (interactive, images, headings, text blocks, layout anomalies) e un `responsivenessSummary` con score
- **iOS** valuta la homepage su dispositivi Apple reali (iPhone SE / 13 / 15 Pro Max, iPad Mini/Pro portrait e landscape) via progetti WebKit

### Output

Per l'audit principale:

```
tests/e2e/visual-audit/
├── screenshots/{route}/{viewport}/{section}.png
└── report.json
```

Gli altri audit usano directory di output separate (`tests/e2e/visual-audit-homepage/`, `tests/e2e/visual-audit-homepage-ios/`, con sotto-cartelle `standard/`, `safe-area/`, `chrome-stress/` e un `report.json` aggregato in radice).

### Quando usarlo

- prima di revisioni UX/UI
- dopo modifiche globali di layout o stili
- per identificare aree di miglioramento specifiche

Dettagli in `docs/visual-audit.md`.

---

# Phase 2.5 — Test Reliability & Developer Experience

## Database test isolation

**Prima**: test dipendenti da dati manuali presenti in Supabase, senza garanzia di stato iniziale.

**Dopo**:
- seed automatico dei dati di test tramite `tests/e2e/global-setup.ts` che chiama `seedTestData()` in `tests/e2e/fixtures/test-data.ts`;
- dati TEST isolati con prefisso batch `TEST` e pulizia prima del seed (`DELETE` + `INSERT`);
- cleanup disponibile ma non eseguito automaticamente dopo i test (lo stato residuo è accettabile perché il seed è idempotente).

**Beneficio**: ogni esecuzione parte da uno stato prevedibile — 3 aziende (Test Co, GreenEnergy, Third Co) con batch `TEST`.

**Requisito**: la variabile `SUPABASE_SERVICE_ROLE_KEY` deve essere impostata. In locale va aggiunta a `.env.local`.

## Screenshot reliability

- `waitForLoadState('networkidle')` prima di ogni cattura;
- screenshot limitati a Chromium e Mobile WebKit;
- timeout generoso (`waitForTimeout(2000)` dopo network idle per render completo);
- `screenshot: 'only-on-failure'` in `playwright.config.ts` per debugging.

## UI health command

```bash
npm run ui:health
```

Esegue in sequenza:
1. `npm run lint` — zero-error policy ESLint;
2. `npm run typecheck` — TypeScript strict;
3. `npm test` — Jest unit test (341 test);
4. `npm run test:e2e` — Playwright (21 spec, 11 progetti).

### Quando usarlo

- prima di ogni commit;
- prima di aprire o aggiornare una PR;
- dopo modifiche importanti a componenti, stili, logica di voto o route;
- come primo passo dopo aver clonato il repository.

---

# Phase 2.6 — Real User Flow Testing

Il voting flow reale è testato E2E in `tests/e2e/voting-flow.spec.ts`.

**Prima**: test basati su componenti isolati, non allineati al flusso UI reale.

**Dopo**: test che riproducono il flusso completo:
1. **ricerca aziende** — `searchAndSelectCompany()` in `voting.helper.ts`: digita il nome in `input[placeholder*="Cerca"]`, attende la lista `ul`, seleziona il `li` corrispondente;
2. **selezione pallet** — `confirmPallet()`: click su `button:has-text("CONFERMA")`;
3. **aggiunta 3 aziende** — il voto richiede esattamente 3 aziende; `selectThreeCompanies()` esegue il loop;
4. **invio voto** — `submitVote()`: attende che `button:has-text("INVIA IL TUO VOTO")` sia abilitato, click, attende `[data-section="success"]`;
5. **validazione successo** — verifica visibilità della sezione successo e del titolo "sei forte!".

### Gestione concorrenza

- **Serial mode**: `test.describe.configure({ mode: 'serial' })` in `voting-flow.spec.ts` e `scroll-blocking.spec.ts` — i test che dipendono dallo stato della sessione (voto già espresso) vengono eseguiti in serie per evitare conflitti;
- **Fully parallel**: il resto dei test è parallelo (`fullyParallel: true` in `playwright.config.ts`);
- **Global setup condiviso**: `global-setup.ts` viene eseguito una volta prima di tutti i test;
- **Idempotenza**: `seedTestData()` cancella i dati esistenti prima di reinserirli.

---

# Phase 3 — Observability & Performance

## Lighthouse

```bash
npm run lighthouse
```

Esegue `lhci autorun` con la configurazione in `lighthouserc.json`.

### Cosa controlla (6 URL)

| URL | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | ≥ 0.80 | ≥ 0.85 | ≥ 0.90 | ≥ 0.90 |
| `/coming-soon` | ≥ 0.80 | ≥ 0.85 | ≥ 0.90 | ≥ 0.90 |
| `/admin/login` | ≥ 0.80 | ≥ 0.85 | ≥ 0.90 | ≥ 0.90 |
| `/admin/dashboard/panoramica` | ≥ 0.80 | ≥ 0.85 | ≥ 0.90 | ≥ 0.90 |
| `/admin/dashboard/aziende` | ≥ 0.80 | ≥ 0.85 | ≥ 0.90 | ≥ 0.90 |
| `/admin/dashboard/voti` | ≥ 0.80 | ≥ 0.85 | ≥ 0.90 | ≥ 0.90 |

### Note

- È un controllo **locale periodico**, non parte della CI (6 URL × 1 run ≈ 6 min, oltre il budget CI).
- Richiede Chrome/Chromium in PATH o variabile `CHROME_PATH`.
- I report HTML vengono salvati in `lhci-reports/`.
- La soglia accessibility è 0.85 (non 0.90) per via delle violazioni note della sidebar admin.

## Bundle analysis

```bash
npm run analyze
```

Esegue `ANALYZE=true next build --webpack` (attiva `@next/bundle-analyzer` in `next.config.ts`). I report interattivi vengono scritti in `.next/analyze/` (`client.html`, `nodejs.html`, `edge.html`).

**Nota**: il bundle-analyzer richiede webpack (`--webpack`); con Turbopack il report non viene generato. I pacchetti client di interesse per la homepage sono in `client.html`.

### Quando usarlo

- dopo aver aggiunto dipendenze pesanti;
- se le performance degradano;
- prima di cambiamenti a import/chunking.

## React Scan (re-render)

`react-scan` è integrato in `src/app/layout.tsx` (solo in `NODE_ENV=development` via CDN unpkg) e traccia i re-render dei componenti React durante l'uso reale.

```bash
npm run dev
# apri il sito e interagisci (scroll, ricerca, voto): i componenti che
# re-renderizzano vengono evidenziati; la toolbar react-scan mostra conteggi e FPS.
```

### Quando usarlo

- per individuare componenti che re-renderizzano a ogni scroll/resize/input;
- per validare che una modifica a stato/context non causi render non necessari.

## Report performance combinato

```bash
npm run perf:report
```

Comando unico che combina le 2 pratiche e produce un report:

1. **Bundle**: esegue `npm run analyze` (build webpack con bundle-analyzer);
2. **React Scan**: avvia un server dev, raccoglie le metriche di re-render su un journey utente reale (scroll + ricerca + selezione + resize) via Playwright;
3. **Report**: aggrega entrambi in `perf-output/`:
   - `bundle-*.html` — report interattivi del bundle (aprire `bundle-client.html`);
   - `react-scan-report.json` — metriche re-render per stadio;
   - `perf-report.md` — riassunto incrociato.

Analisi **locale/on-demand** (non in CI). Richiede RAM sufficiente per build + server dev.

## Sentry

### Configurazione

- **Client**: `sentry.client.config.ts` — init con `NEXT_PUBLIC_SENTRY_DSN`, sampling rate 0, replay disabilitato;
- **Server**: `sentry.server.config.ts` — init con `SENTRY_DSN`, sampling rate 0;
- **Boot hook**: `instrumentation.ts` — importa il server config in fase `register()` solo in runtime Node.js;
- **Error boundary**: `src/app/global-error.tsx` — cattura eccezioni con `Sentry.captureException()`, renderizza `<NextError statusCode={500} />`;

### Comportamento

- **Senza DSN**: Sentry è completamente inerte. L'app builda e funziona senza alcuna variabile d'ambiente Sentry;
- **Con DSN**: cattura errori runtime dal client e dal server. Source maps disabilitate, nessun tracing, nessun replay;
- **Non influenza lo sviluppo locale**: tutti i sampling rate sono 0. Abilitare solo in produzione.

---

# Load Test (k6)

Stress test per simulare una sessione di fiera (~500 utenti concorrenti) su
database reale non-production, per misurare latenze, picchi e punto di rottura.

- **Target**: `fantacer-e2e` (mai production). Production si usa **solo in lettura**
  per importare le aziende del batch attivo.
- **App sotto test**: container Docker self-hosted (`next start`) — vedi `Dockerfile`.
- **Generatore**: k6 (HTTP/WebSocket) + mini-run Playwright per i path browser reali
  (FingerprintJS, heartbeat, polling, IntersectionObserver).
- **Runbook completo**: [`docs/load-testing.md`](docs/load-testing.md).

```bash
npm run loadtest:seed                 # import company + 100k voti sintetici, stampa RUN_ID
npm run load:browser                  # valida i path browser reali (LOAD_BASE_URL)
npm run load:browser:budget           # budget richieste per sessione (before/after client-side)
BASE_URL=http://<app> RUN_ID=<id> npm run load:run -- smoke
BASE_URL=http://<app> RUN_ID=<id> npm run load:run -- baseline   # rampa 0 -> 500 + report DB
npm run loadtest:cleanup              # OBBLIGATORIO a fine sessione
```

`load:run` avvia un sampler DB automatico e produce
`loadtest-output/<scenario>-<ts>/summary.md` (k6 + delta DB allineati).

Risultati della campagna, fix classifica e limite Realtime (cap Free ~200
connessioni → serve Pro per la fiera): [`docs/load-testing-report.md`](docs/load-testing-report.md).

> Il load test condivide `fantacer-e2e` con le suite E2E: va eseguito in una
> **finestra esclusiva** (nessun E2E/CI/visual audit in corso) e chiuso **sempre**
> con `npm run loadtest:cleanup`.

---

# Daily Workflow

## Nuova feature

1. Modifica il codice.
2. Esegui il gate completo:

```bash
npm run ui:health
```

3. Risolvi eventuali errori (lint, typecheck, test falliti).
4. Committa.
5. Pusha.
6. GitHub Actions verifica nuovamente in ambiente CI pulito.

## Modifica componenti UI

1. Esegui `npm run dev` e verifica manualmente nei browser supportati.
2. Esegui `npm run test:e2e` per i test responsive e screenshot.
3. Se gli screenshot cambiano intenzionalmente:

```bash
npx playwright test --update-snapshots
```

4. Esegui `npm run ui:health` prima del commit.

## Aggiunta dipendenze

1. Installa la dipendenza.
2. Esegui `npm run analyze` per verificare l'impatto sul bundle.
3. Esegui `npm run ui:health` per verificare che tutto funzioni.

## Controllo performance

```bash
npm run lighthouse     # audit Lighthouse locale
npm run analyze        # analisi bundle
npm run perf:report    # bundle + react-scan (re-render) + report incrociato
```

---

# Workflow con AI Agent

## Using OpenCode / AI Coding Agents

Quando un agente AI (es. OpenCode) modifica il progetto, deve seguire questo processo:

1. **Analizzare la struttura esistente** — leggere i file pertinenti (test, helper, configurazioni) per capire le convenzioni in uso;
2. **Fare modifiche minimali** — rispettare lo stile del codice esistente, non introdurre pattern nuovi senza necessità;
3. **Eseguire il gate**:

```bash
npm run ui:health
```

4. **Analizzare i fallimenti** — se un test fallisce, determinare se è un falso positivo (es. violazione accessibilità già nota) o una regressione reale;
5. **Solo dopo** aver verificato che il gate passa, creare il commit.

Il sistema funziona come rete di sicurezza contro:
- regressioni UI (screenshot, responsive);
- errori TypeScript (typecheck strict);
- problemi responsive (overflow, clipping);
- problemi accessibilità (scansione WCAG);
- rotture dei flussi utente (voting flow E2E);
- degradi performance (Lighthouse locale).

---

# Commands Reference

| Comando | Utilizzo |
|---|---|
| `npm run dev` | Avvia il server di sviluppo Next.js |
| `npm run dev:tunnel` | Avvia `next dev` + quick tunnel Cloudflare e mostra in terminale l'URL pubblico e un QR scansionabile (per test da cellulare). Richiede cloudflared: `npm run setup:tunnel`. URL effimero e pubblico, muore con il server |
| `npm run setup:tunnel` | Installa `cloudflared` (Linux x86_64 / WSL2) in `~/.local/bin` |
| `npm run lint` | ESLint — zero-error policy |
| `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `npm test` | Unit test Jest (56 suite, 341 test) |
| `npm run test:e2e` | Playwright E2E (21 spec, 11 progetti) |
| `npm run test:e2e:ui` | Playwright UI mode per debugging interattivo |
| `npm run test:watch` | Jest in watch mode |
| `npm run build` | Next.js production build |
| `npm run ui:health` | Gate completo: lint → typecheck → test → E2E |
| `npm run lighthouse` | Lighthouse CI locale (6 URL, 4 categorie) |
| `npm run analyze` | Bundle analysis (webpack: richiede `--webpack`, vedi sezione Bundle analysis) |
| `npm run visual:audit` | Visual Quality Audit — 9 route × 3 viewport (screenshot + metriche layout) |
| `npm run visual:audit:admin` | Visual Quality Audit admin — 6 route admin × 3 viewport (+ bottom-nav) |
| `npm run visual:audit:homepage` | Homepage Responsive Visual Audit — 6 viewport + sub-elementi + score |
| `npm run visual:audit:ios` | iOS Safari Visual Audit — homepage su 4 dispositivi WebKit (SE, 13, Pro Max, iPad Mini portrait) |
| `npm run provision:e2e:admin` | Crea/aggiorna utente admin (Auth + `admin_users` + TOTP + QR SVG); `--role=viewer` per utenti read-only senza TOTP |
| `npm run loadtest:seed` | Load test: importa le company da production (read-only) + genera voti sintetici su `fantacer-e2e` |
| `npm run loadtest:cleanup` | Load test: rimuove seed/load e ripristina `active_batch` (obbligatorio a fine sessione) |
| `npm run load:smoke\|baseline\|spike\|soak\|realtime` | Scenari k6 (richiedono `BASE_URL`; `realtime` anche `SUPABASE_ANON_KEY` + `REALTIME_URL`) |
| `npm run load:run` | Wrapper con monitoraggio DB automatico: `npm run load:run -- baseline` → `loadtest-output/<scenario>-<ts>/summary.md` |
| `npm run load:browser` | Mini-run Playwright sui path browser reali (`playwright.load.config.ts`) |
| `npm run load:browser:budget` | Budget richieste per sessione (`tests/load/browser/request-budget.spec.ts`) → `loadtest-output/browser-<ts>/requests.json` |

---

# CI/CD Explanation

## Workflow GitHub Actions (`.github/workflows/ci.yml`)

**Trigger**: push su `main`/`develop`, tutte le pull request.

**Ordine di esecuzione**:

```
1. npm ci               (installazione deterministica)
2. npm run lint         (1-2 secondi — economico)
3. npm run typecheck    (10-20 secondi — economico)
4. npm test             (5-10 secondi — economico)
5. npm run build        (1-2 minuti — costoso)
6. npm run test:e2e     (3-5 minuti — costoso)
7. ✓ success
```

### Perché questo ordine

1. **Controlli economici prima** — lint, typecheck e unit test sono veloci e diagnosticano la maggior parte degli errori. Fallire presto evita di sprecare risorse su build ed E2E;
2. **Build al centro** — la build Next.js verifica che il codice compili correttamente. È un prerequisito per i test E2E che usano il server di produzione (`npm run start`);
3. **E2E per ultimo** — è lo step più costoso (avvia 11 progetti browser × test paralleli). Viene eseguito solo se tutto il resto è passato.

### Playwright browser caching

I binari Playwright sono cachati con `actions/cache@v4` (chiave basata su `package-lock.json`). L'installazione (`npx playwright install --with-deps`) avviene solo in caso di cache miss.

### Variabili d'ambiente richieste nei Secrets

| Secret | Usato per |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed dati test E2E |

---

# Philosophy

Con questo sistema il progetto passa da:

**"modifiche manuali senza controllo"**

a:

**"sviluppo assistito con validazione automatica continua"**.

L'obiettivo non è avere più test possibile, ma avere **feedback rapido e affidabile** su ciò che conta:
- il codice compila e rispetta le regole (lint + typecheck);
- le funzionalità esistenti non si rompono (test unitari + E2E);
- l'interfaccia rimane utilizzabile su tutti i dispositivi (responsive);
- l'accessibilità non peggiora inosservata (WCAG scans);
- le performance sono sotto controllo (Lighthouse + bundle analysis).

Ogni fase è stata costruita per risolvere un problema reale emerso durante lo sviluppo, non per accumulare strumenti. Il risultato è una pipeline che dà confidenza a sviluppatori umani e agenti AI di poter modificare il codice senza paura dirompere qualcosa.

---

# Riferimenti

| Documento | Contenuto |
|---|---|
| `docs/CI.md` | Dettagli CI, troubleshooting, secrets |
| `docs/frontend-quality.md` | Dettagli responsive, a11y, snapshot, viewport |
| `tests/e2e/accessibility.spec.ts` | Violazioni WCAG permesse per route |
| `tests/e2e/scroll-blocking-test-plan.md` | Test plan scroll blocking bug fix |
| `docs/visual-audit.md` | Visual Quality Audit — workflow e formato report |
| `docs/load-testing.md` | Load test k6 — runbook, SLO, guardrail, cleanup |
| `docs/load-testing-report.md` | Load test — report campagna (risultati, fix classifica, limite Realtime, rollout) |
| `lighthouserc.json` | Configurazione Lighthouse |
| `.env.example` | Variabili d'ambiente richieste e opzionali |
