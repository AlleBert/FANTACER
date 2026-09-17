# Fantacer — Agent Instructions

## Responsiveness (requisito P0)

La webapp è un gioco multi-device con sezioni full-page a snap. La responsiveness è un requisito **non negoziabile**: una feature non è completa se funziona solo sulla viewport usata durante lo sviluppo.

### Viewport e full-page sections

- Progetta ogni sezione per il **viewport disponibile**, mai per una dimensione fissa.
- Le sezioni full-page usano `h-[100dvh]` (o il token `--app-height` che è `100dvh` con fallback `100vh`, definito in `src/app/globals.css`). **Non usare `100vh` nudo** e non aggiungere `min-height: 100vh` senza verificare l'effetto reale su mobile.
- Valuta `dvh`/`svh`/`lvh` in base al comportamento desiderato (URL bar mobile, browser chrome).
- `SearchSection` e `SuccessSection` sono le sezioni non fisse: usano `grow` su `SectionFrame` → `.app-screen` (min-height `var(--app-height)`), crescono col contenuto in modo intenzionale. Tutte le altre sezioni usano `snap-screen` (`h-[100dvh]`).

### Zero micro-scroll

- Ogni sezione deve essere verificata contro micro-scroll: `scrollHeight <= clientHeight + 1`.
- Una sezione non deve creare scrollbar verticale per pochi pixel (padding, gap, font, safe-area, line-height, elementi assoluti).
- **Non risolvere** il micro-scroll con `overflow: hidden` se questo nasconde contenuti realmente necessari: correggi la causa del layout overflow (spacing, tipografia, layout fluido).
- Se una sezione deve davvero scrollare internamente, rendilo **esplicito e intenzionale** (`overflow-y-auto` sul contenitore giusto), mai accidentale.

### Overflow

- Zero overflow orizzontale accidentale (`scrollWidth <= clientWidth + 1`).
- Zero contenuti tagliati, zero elementi fuori viewport, zero collisioni tra componenti, zero testo che invade altri elementi, zero CTA/controlli non raggiungibili.
- Verifica contenuti dinamici, testi lunghi, font diversi e viewport insolite (strette, basse, larghe, alte, portrait e landscape).

### Layout

- Preferisci CSS Grid, Flexbox, `minmax()`, `clamp()`, unità relative, container queries quando migliorano davvero la soluzione, dimensioni/spacing fluidi, wrapping controllato.
- Niente breakpoint arbitrari creati solo per correggere un singolo screenshot.
- Non usare `transform`/`scale`/animazioni per nascondere problemi strutturali di layout.

**Safe Centering Rule.** **MAI usare `center` nudo** (`justify-content: center`, `align-items: center`, `items-center`, `justify-center`) su assi che possono overfloware. Usare sempre **safe center** (`justify-content: safe center`, `align-items: safe center`). Il `safe` garantisce: centra se il contenuto sta nel container/viewport, allinea all'inizio (`start`) se trabocca, evita clipping della parte superiore. In Tailwind v4 `items-[safe_center]` non è supportato: scrivere in CSS puro in `globals.css`. Override esplicito richiesto quando `display: grid` nel container query desktop: `justify-content: normal` (grid usa `justify-content` con semantica diversa).

### Tipografia

- La tipografia deve adattarsi alla viewport: font-size, line-height, letter-spacing, larghezza dei blocchi, wrapping, CTA, titoli multilinea, contenuto localizzato (IT/EN).
- Nessun testo importante deve essere troncato o sovrapposto per ottenere un layout apparentemente corretto.

### Padding e safe areas

- Usa il sistema già presente: `.safe-shell`, `.safe-pt`, `.safe-pb`, `.safe-px` e i token `--safe-area-inset-*`, `--safe-top`, `--safe-bottom`, `--safe-x` (definiti in `globals.css`).
- Le safe-area vanno integrate nel sistema di spacing, non aggiunte a singoli elementi. Attenzione a notch, Dynamic Island, home indicator, landscape, elementi fixed/sticky, HUD di gioco, CTA, nav, elementi ancorati ai bordi.
- `viewportFit: cover` è già attivo in `src/app/layout.tsx`.

### Design tokens

- Usa i token di sistema definiti in `globals.css`: spacing/ritmo (`--space-*`, `--rythm-*`, `--section-pad`, `--card-size`), tipografia (`--fs-*`, `--lh-*`), contenuto (`--content-max`, `--measure-*`), CTA (`--cta-*`). **Non introdurre nuove costanti di spacing/tipografia/misure.**
- Sintassi Tailwind v4: `gap-(--x)`, `max-w-(--x)`, `leading-(--x)`, `py-(--x)`; per i **font-size usa `text-(length:--fs-*)`** (senza `length:` compila a `color`).
- `.content-max` sostituisce `max-w-7xl mx-auto` e `max-w-[1200px]`; `CtaButton` (`src/components/ui/cta-button.tsx`) è l'unico CTA «GIOCA».
- Se un valore `clamp` si dimostra sbagliato in audit, correggi la causa strutturale (spacing/tipografia); rivedi il token in `globals.css` (SSOT) solo in caso estremo.

### Animazioni

- **NON introdurre Framer Motion/Motion per risolvere problemi responsive.** Prima risolvi il layout con CSS/HTML.
- Motion è già presente (`framer-motion`): usalo solo per transizioni, gesture, layout animation, stato visivo, animazioni di gioco. Separa layout responsivo e animazione.
- Ogni animazione deve rispettare `prefers-reduced-motion`.

### Verifiche (da eseguire prima di dichiarare completa una feature UI)

- `npm run visual:audit:homepage` — matrice responsive homepage (6 viewport).
- `npm run visual:audit:ios` — homepage su 4 device iOS WebKit (`--workers=1`).
- `npm run visual:audit:ios:safearea` — modalità safe-area simulata.
- `npm run visual:audit:ios:chrome` — modalità viewport/chrome stress.
- `npm run visual:audit:summary` — report riepilogativo di tutte le suite (offline, da rigenerare dopo gli audit).
- `npm run test:e2e` include `responsive-structural.spec.ts` (gate P0 su chromium + mobile-webkit).

### Note operative audit

- **WebKit**: gli audit iOS richiedono `--workers=1`; **non lanciare due suite WebKit in parallelo** (connection-refused) e mai una suite WebKit in parallelo con altri run. Le suite modali (`safearea`, `chrome`) girano solo con `VISUAL_IOS_MODAL=1`.
- **Workers**: `playwright.config.ts` imposta `workers: 2` **globale**, con cap per-project: chromium e mobile-chrome = 2, firefox / mobile-webkit / tutti gli ios-* = 1 (WebKit/iOS sempre seriali). Il cap per-project è un limite, non un target: nessun progetto supera il globale. I login MFA admin (AAL2) condividono rate limit e sessione (`cachedAdminCookies` per worker): il margine per i 2 worker è garantito dai rate-limit alzati (vedi sotto). I batch locali forzano `--workers=1` (seriali).
- **Banner cookie**: gli spec che catturano schermate pubbliche pre-impostano il cookie `fantacer_cookie_consent` (`seedConsentCookie` in `tests/e2e/helpers/cookie-consent.ts`) → il banner non compare nelle schermate, zero attese. Se aggiungi screenshot a uno spec pubblico, chiama il seed prima del `goto`.
- Il **gate strutturale** e i **report riepilogativi** richiedono che le sezioni siano `main > section`; aggiorna selettori se il DOM cambia.

### Identificazione sezioni e limitazioni

- Le sezioni homepage sono `main > section`. Negli spec esistenti alcune liste usano `main > section:nth-child(1..9)`: se il DOM/ordine delle sezioni cambia, aggiornale.
- `SuccessSection` è condizionale (compare solo dopo il voto) e non è coperta dagli audit standard.
- WebKit/Playwright non simula `env(safe-area-inset-*)` reali: l'audit safe-area li emula via override dei token CSS (`--safe-top`, `--safe-bottom`, `--safe-x`). Non dichiarare una verifica superata senza averla eseguita.

## Realtime (homepage) — invarianti

Client realtime centralizzato in `src/lib/RealtimeContext.tsx`. Dettagli,
comportamento e comandi di verifica: `docs/realtime.md`.

- **Un solo provider** (`RealtimeProvider`), montato in `src/app/page.tsx`. I
  componenti **non** devono chiamare `createClient().channel(...)` direttamente:
  usano `useRealtime()` / `useRankingTick(enabled)`.
- `@supabase/ssr` `createBrowserClient` è **singleton nel browser** → **1 WebSocket
  per scheda**, canali multiplexati. Non passare `isSingleton: false`, non creare
  client in loop.
- Canali: `realtime-ranking-tick` (refcounted via `useRankingTick`, evento
  `ranking_tick`, debounce `RANKING_DEBOUNCE_MS` 2000ms + jitter 0-1000ms) e
  `realtime-voting-flag` (`site_settings`, `key=eq.voting_enabled`).
- `realtimeActive` è `true` **solo** dopo la consegna reale di un evento (mai dal
  solo `SUBSCRIBED`): finché è `false` la classifica fa polling di fallback ogni
  **30s** (`PALLETS_POLLING_MS`), poi si ferma.
- **Visibilità**: canali chiusi quando la scheda va in background, ri-sottoscritti
  al ritorno con refetch di catch-up.
- Ogni modifica va coperta da unit test (`tests/components/realtime`,
  `tests/components/sections`) e dallo spec e2e `tests/e2e/realtime-live.spec.ts`;
  prima della produzione serve il **load test su e2e** (vedi sezione load test).
- In locale `playwright.config.ts` usa `next dev`, quindi l'a11y scan rileva il
  toolbar di `react-scan` (`#react-scan-root`) e fallisce su `button-name`: è un
  falso positivo dev (su CI con `npm run start` non compare).

## Performance & caching (homepage e API pubbliche) — invarianti

- La **homepage** (`/`) è **statica** (prerenderizzata): il root layout **non**
  deve leggere `cookies()`/`headers()`. Il locale è risolto client-side da
  `LocaleProvider` (cookie sticky impostato dal proxy). Reintrodurre API dinamiche
  nel layout riporta `/` in SSR a ogni richiesta. Verifica dopo `npm run build`:
  `/` deve comparire in `.next/prerender-manifest.json`.
- Le **GET pubbliche** (`/api/public/ranking`, `/sponsors`, `/batch`, `flag/*`)
  devono restituire `Cache-Control` con `s-maxage` + `stale-while-revalidate`:
  la maggior parte delle richieste è servita dal CDN. Non rimuovere quegli header
  e non rendere queste route dipendenti dalla request (perderebbero la cache).
- Il **proxy** (`src/proxy.ts`) copre pagine + `/api/admin` + `/api/analytics`:
  le API pubbliche sono escluse dal matcher (evita una doppia function invocation
  per chiamata). Il flag `coming_soon` è cachato in-memory con TTL 15s.
- Sponsor: fetch condivisa a livello modulo (`src/lib/sponsors.ts`) → una sola
  richiesta per pageview anche con `SponsorCards` montato più volte.
- Il polling cacheato è il **percorso primario** quando il realtime non è attivo
  (cap Free ~200 connessioni): non renderlo più aggressivo senza motivo.

## Esecuzione test su hardware limitato (PC dev)

La macchina di sviluppo ha RAM limitata (~3.7GiB, WSL2) e **si blocca se la suite e2e completa viene lanciata tutta insieme**. Regole vincolanti:

- **Mai `npm run test:e2e` nudo**: è un'operazione da CI (tutti gli spec × 11 progetti; il gating runtime via `test.skip` riduce le esecuzioni effettive ma `--list` continua a mostrare 1925 test listed). In locale satura la RAM. Usa sempre i **batch dedicati**:
  - `npm run e2e:gate` — `responsive-structural` + `voting-flow` su `chromium` + `mobile-webkit` (gate P0)
  - `npm run e2e:home` — `homepage`, `legal-pages`, `smoke`, `scroll-blocking`, `accessibility` su `chromium`
  - `npm run e2e:admin` — `admin`, `admin-auth`, `admin-sponsor`, `viewer`, `repro-phantom-500` su `chromium`
  - Gli script includono già `--workers=1` (seriali: login MFA admin condivisi) e `NODE_OPTIONS=--max-old-space-size=2560`.
- **Audit sempre con server production**: `CI=true npm run visual:audit:ios` / `:homepage` (webServer usa `npm run start`, ~metà RAM di `next dev`). Serve un build aggiornato. Per audit in modalità production **sul progetto E2E**, il build va fatto con `.env.e2e` (perché `NEXT_PUBLIC_SUPABASE_URL` è inlined a build-time; altrimenti "Invalid API key" sui write admin): `set -a; source .env.e2e; set +a; rm -rf .next && npm run build`. Dettagli in `docs/CI.md`.
- **Matrice iOS ridotta**: 3 iPhone (SE, 13, Pro Max) + iPad Mini portrait. Mai `--project=ios-*` oltre questo set, mai due suite WebKit in parallelo.
- **Una suite WebKit alla volta**, mai in parallelo con altri run.
- **`jest` limitato**: `--maxWorkers=4` (già in `npm test`); `build` ha `NODE_OPTIONS` dedicata.
- **Dopo un run interrotto** (Ctrl-C, crash, OOM) lancia `npm run e2e:cleanup`: uccide i browser Playwright orfani che altrimenti rubano RAM.
- **Swap WSL attivo**: `/swapfile` 4GiB + `vm.swappiness=10` (persistiti via `/etc/fstab` e `/etc/sysctl.conf`). Se spariscono da `swapon --show` dopo un reboot, riapplicare i comandi sudo relativi.
- Suite pesanti solo a macchina "quieta": chiudere browser/app prima di un audit.

## SuccessSection in anteprima (solo dev)

Tool di sviluppo per lavorare alla UI della pagina di successo senza votare davvero:

- **`?dev_success=1`** su `next dev` sblocca `SuccessSection` (+ scroll alla sezione).
- **`&dev_companies=1`** pre-seleziona le prime 3 aziende del batch attivo (SELECT read-only, nessuna scrittura).
- Implementazione: `src/components/dev/dev-success-preview.tsx` (render `null`), montato in `src/app/page.tsx`.
- **Guardia**: `process.env.NODE_ENV === 'production'` **inline** nel corpo dell'effect. NON avvolgere in un helper con default param (`nodeEnv = process.env.NODE_ENV`): impedisce l'inlining statico di NODE_ENV da parte di Next e il bypass resta attivo in build prod (difetto verificato). Con l'inline, in `next build`/`next start` il branch è eliminato dal bundle → parametro **inerte**.
- Funziona **solo in `next dev`**. Mai su produzione (`npm run start`, Vercel, tunnel).
- **Verifica di inertness**: `npm run start -p 3001` + aprire `http://localhost:3001/?dev_success=1` → sezione assente, e `grep -rl dev_success .next/static/chunks/` → 0 match. NON verificare su :3000 se un `next dev` è attivo (occupa la porta → EADDRINUSE e il test colpisce il server sbagliato).
- I test unit sono in `tests/components/dev/dev-success-preview.test.tsx` (ramo prod coperto via `jest.replaceProperty(process.env, 'NODE_ENV', ...)`).

## TOTP / Google Authenticator

- **Google Authenticator (inserimento manuale)** accetta il secret base32 **solo in minuscolo**. Se incollato in MAIUSCOLO rifiuta con "carattere non valido nel valore del codice".
- I secret TOTP generati da `npm run provision:e2e:admin` sono salvati in `.env.local` come `E2E_ADMIN_TOTP_SECRET` in maiuscolo: convertire in minuscolo prima di suggerirne l'inserimento in GA.
- Per gli utenti `admin` il provisioning genera anche il file **QR SVG** in `./.qr/` (gitignored) con URI `otpauth://`: suggerire di **scansionarlo con l'app authenticator** (carica label + secret senza digitazione, bypassa la regola minuscole).
- Il secret è visibile un'unica volta al provisioning; se perso si rigenera con `npm run provision:e2e:admin -- --force`.
- `--role=viewer` crea un utente **read-only senza TOTP** (AAL1): niente `E2E_ADMIN_TOTP_SECRET` nel relativo blocco `.env.local`.
- In `.env.local` vale l'**ultima** occorrenza di una chiave (il fattore attivo è la più recente). Tenere un solo blocco E2E per evitare ambiguità.

## E2E: rate limit e sessione admin

- Il login admin (`/api/admin/login`) e la verify MFA (`/api/admin/mfa/verify`) hanno **rate limit DB-backed** (finestra 15min): default **10** tentativi login, **5** verify per factorId. Overridabili via env `ADMIN_LOGIN_RATE_MAX` / `ADMIN_MFA_VERIFY_RATE_MAX` (vedi `.env.example`).
- Le suite E2E autenticate (visual-audit, accessibility, admin, viewer) **riusano la sessione admin a livello di modulo** (`cachedAdminCookies` in `tests/e2e/helpers/auth.ts`): il primo test esegue il login MFA completo, i successivi riutilizzano i cookie. Non duplicare il login: ogni MFA login consuma una verify nel rate limit.
- In `.env.local` sono già presenti `ADMIN_LOGIN_RATE_MAX=100` e `ADMIN_MFA_VERIFY_RATE_MAX=100` per le suite E2E; il job CI imposta gli stessi valori (`ci.yml`). Se il server dev era già avviato prima di una modifica a `.env.local`, **riavviarlo** (le env sono lette allo startup da `next dev`).
- **`DEV_BYPASS_VOTE_LIMIT` è una variabile locale/dev, non un'invariante CI**: in `next start`/production (`NODE_ENV=production`) è inerte. In CI le collisioni di voto si evitano con lo stub `e2e-voter-*` (`stubUniqueVoteFingerprint`), non con quella env.
- I counter del rate limit vivono in DB (`public.rate_limits`): un run fallito lascia tentativi conteggiati per 15min. In caso di "ratelimited" inspiegabile, svuotare le righe con key `admin:login:*` / `admin:mfa:*` o attendere la finestra.

## E2E e stato Admin — invarianti

- Gli input dell'Admin page (`site_settings`, `batch_settings`) sono stato di
  **competenza esclusiva dell'Admin**: nessun test può modificarli su production.
- Gli E2E girano **esclusivamente** sul progetto Supabase `fantacer-e2e`
  (`.env.e2e`), mai sul progetto production (`zdfverdwdsigizxktilz`).
- `playwright.config.ts` blocca all'avvio qualsiasi URL Supabase diverso da
  `fantacer-e2e` (guard fail-fast): E2E → production è impedito per costruzione.
- Nessun test riattiva/disattiva il voto o altera lo stato Admin su production.
- Se un test deve alterare stato Admin (batch, voting_enabled, sponsor, voti),
  lo fa esclusivamente sul progetto E2E (seeding in `global-setup.ts`).
- Percorso ufficiale setup: `.env.e2e` (gitignored) + `npm run provision:e2e:admin:test`.
  Il webServer Playwright parte sempre lui (`reuseExistingServer: false`):
  non riusare un `next dev` avviato a mano che potrebbe puntare a prod.
- Il job CI usa solo secrets `*_TEST`; i secrets production vivono solo in Vercel.
- Il CI serializza i job E2E con `concurrency: { group: e2e-suite, cancel-in-progress: false }` (dataset Supabase condiviso + seed/cleanup non idempotente): non rimuovere né parallelizzare i job E2E su CI.
- Canary manuale su production dopo un run E2E (mai automatizzato, vedi `docs/CI.md`):
  verificare che `batch_settings.active_batch` e `site_settings` non siano cambiati.

## Load test (k6) — invarianti

Test di carico per simulare una sessione di fiera (~500 utenti concorrenti) su
database reale non-production. Runbook completo: `docs/load-testing.md`.

### Target e sicurezza (non negoziabile)

- Le scritture del load test girano **solo** su `fantacer-e2e`
  (`ookipybsnjtvdrzqzpsl`), mai su production.
- Production si usa **solo in lettura** (`.env`), per importare le aziende del
  batch attivo. Mai scrivere, mai alterare stato Admin su production.
- `scripts/loadtest/lib.mjs` valida gli host con fail-fast (`PROD_HOST`/`E2E_HOST`):
  `.env` → prod (read-only), `.env.e2e` → target di scrittura. **Non bypassare la guardia.**
- La **CLI Supabase è linkata a production** (`zdfverdwdsigizxktilz`): ogni comando
  `supabase` va eseguito con `--project-ref` o `--db-url` espliciti. Mai
  `supabase db push` senza aver verificato il ref. Per ispezioni read-only usare
  `supabase inspect db <cmd> --project-ref <ref>`.
- Namespace righe: seed `seed-loadtest-*`, carico/heartbeat `loadtest-*`. Ogni riga
  scritta deve essere rimossa dal cleanup.

### Isolamento da E2E (stesso progetto Supabase)

- E2E e load test **condividono `fantacer-e2e`**: l'isolamento è **procedurale**,
  non architetturale.
- **Finestra esclusiva**: nessun run E2E, CI o visual audit mentre gira un load
  test. Il `concurrency: e2e-suite` di CI copre solo i job CI, non i run locali.
- E2E `globalSetup` riporta `active_batch='TEST'` ma **non** rimuove i voti seed:
  con i dati load presenti l'analytics summary E2E rallenta (legge tutte le
  `vote_sessions`, `src/app/api/analytics/route.ts`).
- **Cleanup obbligatorio** a fine sessione (`npm run loadtest:cleanup`), anche in
  caso di errore. Lo stato è in `.loadtest/state.json` (gitignored).
- Il re-seed **non deve** sovrascrivere `previousActiveBatch` se il batch coincide
  (altrimenti il cleanup ripristina il batch sbagliato).

### Comandi

- `npm run loadtest:seed [-- --votes=N --run-id=ID --batch=B]` — importa le company
  di prod (read-only, `image_url` azzerato) + genera voti sintetici + imposta
  `active_batch`; stampa il `RUN_ID` da usare con k6.
- `npm run loadtest:cleanup [-- --keep-companies]` — rimuove seed/load e ripristina
  `active_batch`. Usa una **connessione diretta `pg`** (non PostgREST) e disabilita
  temporaneamente i due trigger durante il bulk.
- `npm run load:smoke|baseline|spike|soak|realtime` — scenari k6 (richiedono
  `BASE_URL`; `realtime` anche `SUPABASE_ANON_KEY` + `REALTIME_URL`).
- `npm run load:run -- <scenario>` — **wrapper con monitoraggio DB automatico**:
  avvia `scripts/loadtest/db-monitor.mjs` (sampler read-only), esegue k6 e scrive
  `loadtest-output/<scenario>-<ts>/summary.md` con i delta DB allineati al run.
  Preferirlo ai `load:*` semplici. Output in `loadtest-output/` (gitignored).
- `npm run load:browser` — mini-run Playwright (`playwright.load.config.ts`, senza
  webServer/globalSetup e senza la guardia E2E di `playwright.config.ts`).

### Vincoli tecnici

- `vote_sessions` ha **due** trigger per riga: `trg_bump_ranking_tick` (realtime)
  e `trg_maintain_company_totals` (contatori classifica `company_totals`). Seed e
  cleanup da 100k righe generano 100k update per trigger. Opzionale
  `scripts/loadtest/sql/trigger.sql` (disable/enable dall'SQL Editor Supabase;
  **riabilitare sempre** entrambi) e poi
  `select public.recompute_company_totals()` per riallineare i contatori.
- La classifica e' O(1) via `company_totals` (migration
  `20260917000000_company_totals_ranking.sql`). **Applicata a e2e e production**
  (17/09/2026). L'indice `20260917000001` e' su e2e ma **non** su production
  (scelta esplicita): resta pendente nel repo, quindi un `db push` su prod lo
  applicherebbe. Rollback manuale:
  `scripts/loadtest/sql/rollback_company_totals.sql`.
  Snapshot di sicurezza prima di migrazioni:
  `node scripts/loadtest/db-snapshot.mjs` → `backups/e2e-<ts>.json` (read-only).
- Dedup atomico del voto: migration `20260918000000_atomic_vote_dedup.sql`
  (colonna generata `vote_day` UTC + indice unico `(fingerprint, vote_day)` +
  `submit_vote` che gestisce `unique_violation`). **Applicata a e2e** (verificata:
  10 submit concorrenti → 1 successo / 9 "Hai già votato oggi", cleanup ok),
  **pendente su production**. Un `db push` su prod applica **entrambe**
  `20260917000001` e `20260918000000`. Fail-safe: se esistono duplicati
  `(fingerprint, vote_day)` la migrazione si interrompe senza cancellare dati.
- Le operazioni massive (seed/cleanup/migrazioni) **non** devono passare da
  PostgREST: il ruolo `authenticator` ha `statement_timeout=8s` (verificato) e una
  DELETE su 100k righe viene cancellata. `cleanup.mjs` e `db-snapshot.mjs` usano
  `loadE2eDbUrl()` (connessione diretta `pg`); il cleanup fa
  `set local statement_timeout = 0` e disabilita i trigger su `vote_sessions`
  durante il bulk, riabilitandoli prima di `recompute_company_totals()`.
- Indice `idx_vote_sessions_fingerprint_pattern` (`fingerprint text_pattern_ops`,
  migration `20260917000001`) per i `LIKE 'prefisso%'` selettivi; resta comunque
  presente per l'app l'indice di uguaglianza `idx_vote_sessions_fingerprint`.
- Turnstile è bypassato solo se `TURNSTILE_SECRET_KEY` è **assente**: non
  impostarlo nell'ambiente di load (k6/Playwright non generano token reali).
- Il generatore k6 gira su macchina separata dall'app (mai stessa CPU): il
  portatile in LAN. Il server app è self-hosted (`next start`): **non** copre Vercel
  (cold start, autoscaling).
- Server casa 2 core/8GB: regge 500 VU HTTP/DB con p95 < 180ms e CPU < 1 core;
  il muro reale è il **Realtime del piano Free (~200 connessioni)**. Una scheda
  apre **1 connessione** (`@supabase/ssr` `createBrowserClient` è singleton nel
  browser: tutti i canali — classifica, flag voto, ricerca — sono multiplexati
  sulla stessa socket) → ~200 schede/visitatori. Per la fiera (~500) serve
  **Supabase Pro**. Dettagli e misure in `docs/load-testing-report.md`.
- k6 **non** è in CI: `tests/load/**/*.js` è escluso da ESLint (`__ENV`, moduli
  `k6/*`). Non aggiungere gli scenari k6 a `npm run test:e2e`.
- **Preflight DNS obbligatorio** su portatile e server app: un resolver lento
  (es. nameserver non raggiungibile in `/etc/resolv.conf` che va in timeout)
  aggiunge secondi a ogni nuova connessione verso Supabase e falsa ogni misura.
  Verifica con `getent hosts <ref>.supabase.co` (< 50ms) prima di testare.
- Il sampler DB (`db-monitor.mjs`) è **read-only** e si connette a Postgres via
  session pooler (`aws-1-eu-west-1.pooler.supabase.com:5432`), **non** via
  PostgREST: non consuma gli slot del pooler applicativo e non falsa le metriche.
  Override con `LOADTEST_DB_URL`; intervallo con `SAMPLE_MS` (default 10000).
  `pg` è una devDependency usata solo da questi script.

### Dopo un test

- Eseguire `npm run loadtest:cleanup` e verificare che
  `batch_settings.active_batch` sia tornato al valore precedente.

### Report della campagna

Risultati completi (baseline prima/dopo, realtime, conclusioni, rollout in
produzione): [`docs/load-testing-report.md`](docs/load-testing-report.md).