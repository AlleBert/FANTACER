# Fantacer — Agent Instructions

## Responsiveness (requisito P0)

La webapp è un gioco multi-device con sezioni full-page a snap. La responsiveness è un requisito **non negoziabile**: una feature non è completa se funziona solo sulla viewport usata durante lo sviluppo.

### Viewport e full-page sections

- Progetta ogni sezione per il **viewport disponibile**, mai per una dimensione fissa.
- Le sezioni full-page usano `h-[100dvh]` (o il token `--app-height` che è `100dvh` con fallback `100vh`, definito in `src/app/globals.css`). **Non usare `100vh` nudo** e non aggiungere `min-height: 100vh` senza verificare l'effetto reale su mobile.
- Valuta `dvh`/`svh`/`lvh` in base al comportamento desiderato (URL bar mobile, browser chrome).
- `SearchSection` è l'unica sezione non fissa: usa `.app-screen` (min-height `var(--app-height)`), cresce col contenuto in modo intenzionale.

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
- **Banner cookie**: gli spec che catturano schermate pubbliche pre-impostano il cookie `fantacer_cookie_consent` (`seedConsentCookie` in `tests/e2e/helpers/cookie-consent.ts`) → il banner non compare nelle schermate, zero attese. Se aggiungi screenshot a uno spec pubblico, chiama il seed prima del `goto`.
- Il **gate strutturale** e i **report riepilogativi** richiedono che le sezioni siano `main > section`; aggiorna selettori se il DOM cambia.

### Identificazione sezioni e limitazioni

- Le sezioni homepage sono `main > section`. Negli spec esistenti alcune liste usano `main > section:nth-child(1..9)`: se il DOM/ordine delle sezioni cambia, aggiornale.
- `SuccessSection` è condizionale (compare solo dopo il voto) e non è coperta dagli audit standard.
- WebKit/Playwright non simula `env(safe-area-inset-*)` reali: l'audit safe-area li emula via override dei token CSS (`--safe-top`, `--safe-bottom`, `--safe-x`). Non dichiarare una verifica superata senza averla eseguita.

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