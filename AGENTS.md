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
- `npm run visual:audit:ios` — homepage su 7 device iOS WebKit (`--workers=1`).
- `npm run visual:audit:ios:safearea` — modalità safe-area simulata.
- `npm run visual:audit:ios:chrome` — modalità viewport/chrome stress.
- `npm run visual:audit:summary` — report riepilogativo di tutte le suite (offline, da rigenerare dopo gli audit).
- `npm run test:e2e` include `responsive-structural.spec.ts` (gate P0 su chromium + mobile-webkit).

### Note operative audit

- **WebKit**: gli audit iOS richiedono `--workers=1`; **non lanciare due suite WebKit in parallelo** (connection-refused). Le suite modali (`safearea`, `chrome`) girano solo con `VISUAL_IOS_MODAL=1`.
- **Workers**: `playwright.config.ts` imposta `workers: 1` di default. I login MFA admin (AAL2) condividono rate limit e sessione (`cachedAdminCookies` per worker): il parallelismo li fa fallire in modo flaky anche senza modifiche al codice. Non sovrascrivere con `--workers` se non per un motivo esplicito.
- **Banner cookie**: gli spec che catturano schermate pubbliche pre-impostano il cookie `fantacer_cookie_consent` (`seedConsentCookie` in `tests/e2e/helpers/cookie-consent.ts`) → il banner non compare nelle schermate, zero attese. Se aggiungi screenshot a uno spec pubblico, chiama il seed prima del `goto`.
- Il **gate strutturale** e i **report riepilogativi** richiedono che le sezioni siano `main > section`; aggiorna selettori se il DOM cambia.

### Identificazione sezioni e limitazioni

- Le sezioni homepage sono `main > section`. Negli spec esistenti alcune liste usano `main > section:nth-child(1..9)`: se il DOM/ordine delle sezioni cambia, aggiornale.
- `SuccessSection` è condizionale (compare solo dopo il voto) e non è coperta dagli audit standard.
- WebKit/Playwright non simula `env(safe-area-inset-*)` reali: l'audit safe-area li emula via override dei token CSS (`--safe-top`, `--safe-bottom`, `--safe-x`). Non dichiarare una verifica superata senza averla eseguita.

## Esecuzione test su hardware limitato (PC dev)

La macchina di sviluppo ha RAM limitata (~3.7GiB, WSL2) e **si blocca se la suite e2e completa viene lanciata tutta insieme**. Regole vincolanti:

- **Mai `npm run test:e2e` nudo**: esegue tutti i 18 spec × 11 progetti e satura la RAM. Usa sempre i **batch dedicati**:
  - `npm run e2e:gate` — `responsive-structural` + `voting-flow` su `chromium` + `mobile-webkit` (gate P0)
  - `npm run e2e:home` — `homepage`, `legal-pages`, `smoke`, `scroll-blocking`, `accessibility` su `chromium`
  - `npm run e2e:admin` — `admin`, `admin-auth`, `admin-sponsor`, `viewer`, `repro-phantom-500` su `chromium`
  - Gli script includono già `--workers=1` (obbligatorio: login MFA admin condivisi) e `NODE_OPTIONS=--max-old-space-size=2560`.
- **Audit sempre con server production**: `CI=true npm run visual:audit:ios` / `:homepage` (webServer usa `npm run start`, ~metà RAM di `next dev`). Serve un build aggiornato.
- **Matrice iOS ridotta**: 3 iPhone (SE, 13, Pro Max) + iPad Mini portrait. Mai `--project=ios-*` oltre questo set, mai due suite WebKit in parallelo.
- **Una suite WebKit alla volta**, mai in parallelo con altri run.
- **`jest` limitato**: `--maxWorkers=4` (già in `npm test`); `build` ha `NODE_OPTIONS` dedicata.
- **Dopo un run interrotto** (Ctrl-C, crash, OOM) lancia `npm run e2e:cleanup`: uccide i browser Playwright orfani che altrimenti rubano RAM.
- **Swap WSL attivo**: `/swapfile` 4GiB + `vm.swappiness=10` (persistiti via `/etc/fstab` e `/etc/sysctl.conf`). Se spariscono da `swapon --show` dopo un reboot, riapplicare i comandi sudo relativi.
- Suite pesanti solo a macchina "quieta": chiudere browser/app prima di un audit.

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
- In `.env.local` sono già presenti `ADMIN_LOGIN_RATE_MAX=100` e `ADMIN_MFA_VERIFY_RATE_MAX=100` per le suite E2E. Se il server dev era già avviato prima di una modifica a `.env.local`, **riavviarlo** (le env sono lette allo startup da `next dev`).
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
- Canary manuale su production dopo un run E2E (mai automatizzato, vedi `docs/CI.md`):
  verificare che `batch_settings.active_batch` e `site_settings` non siano cambiati.