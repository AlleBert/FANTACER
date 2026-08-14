# Fantacer — Report finale revisione UI (branch `revisione-ui`)

Data: 2026-08-14 · Branch: `revisione-ui` · Stato: **lavoro completo, non committato** (commit sospeso su richiesta).

## 1. Obiettivo

Rendere la homepage multi-device davvero responsive (P0) eliminando dipendenze da viewport fisse,
unificando il sistema di layout (viewport SSOT, safe-area, modal) e verificando il risultato con le
suite Playwright automatiche (gate strutturale + audit visuali chromium/iOS WebKit).

## 2. Stato finale delle task

| Task | Stato | Evidenza |
|---|---|---|
| A — Nav admin condivisa (`admin-navigation.ts`) | ✅ | sidebar + bottom-nav usano la stessa source of truth |
| B — Viewport SSOT + safe-area (`--app-height`, `.snap-screen`, `.safe-*`) | ✅ | sezioni full-page su `100dvh`, safe-area integrate nel spacing |
| C — Modal system unificato (`modal-shell` + `use-scroll-lock`) | ✅ | migrati cookie, search, import, impostazioni sponsor |
| D — Internal sizing `svh` + landscape | ✅ | card how-it-works e tipografia hero fluide (svh) |
| E — Batch a11y | ✅ | remove del toggle button-name, baseline aggiornate in `docs/frontend-quality.md` |
| F — Token colore palette (`.app` tokens → `--color-*` + `optimizePackageImports`) | ✅ | token `orange/magenta/purple/ink/bright` in `globals.css` |
| G — Dead code cleanup | ✅ | 6 file orfani rimossi + 3 deps non usate |
| Fase 11 — Validazione finale | ✅ | gate P0 + 4 suite visuali verdi (vedi §6) |
| Report finale | ✅ | questo documento |

Nota: la todo list della sessione principale risultava aggiornata solo parzialmente (task A–F eseguite
ma mai marcate done). Questo report è lo stato di fatto verificato.

## 3. Regressione trovata e corretta durante la validazione

La suite `npm run visual:audit:ios:chrome` (viewport/chrome stress, 28 casi su 7 device WebKit) era
**rossa su 7/7 device** già prima del Task G (report del 2026-08-14 12:44–12:48; il summary del
13/08 la dichiarava a 0 errori → regressione introdotta dal WIP).

- **Causa root**: il WIP aveva cambiato `IntroSection` e `ContactSection` da sizing tipografico
  height-based (`dvh`) a width-based (`vw`). A viewport landscape larghe e basse (es. 1194×440/500/542,
  iPad Pro landscape con URL bar) il testo `clamp(...,5vw,...)` superava il contenitore full-page
  `100dvh` (micro-scroll +54..+176px). Era la causa anche del fallimento di `HowItWorksSection` a
  phone-landscape.
- **Fix applicato** (solo CSS, nessun cambio copy/structure a11y):
  - `intro-section.tsx`: tipografia `min(vw, svh)` (titolo `min(5vw,7.5svh)`, sottotitolo
    `min(3.25vw,4.5svh)`), sponsor `md:mt-[min(2.5rem,5svh)]`, bounce hint più compatto.
  - `contact-section.tsx`: layout due colonne da `lg:` (era `xl:`, quindi iPad landscape restava
    impilato), chip contatti in riga da `sm:`, form a 2 colonne (nome+email affiancati) da `sm:`,
    tipografia e padding `min(vw, svh)`.
  - `how-it-works-section.tsx`: griglia 3 colonne da `sm:` (era `md:`, quindi phone landscape
    664–739px restava impilato).

## 4. File toccati (57 cambi, tutti non committati)

**Rimossi (dead code):** `frame-component.tsx`, `layout/header.tsx`, `layout/section-container.tsx`,
`splash-preloader.tsx`, `admin/vote-card-list.tsx`, `admin/vote-log-table.tsx`, `company-card.tsx`,
`ui/skeleton.tsx`, `ui/wavy-divider.tsx`.

**Nuovi:** `ui/modal-shell.tsx`, `lib/use-scroll-lock.ts`, `lib/admin-navigation.ts`.

**Modificati (principali):** `globals.css` (tokens, `--app-height`, `.snap-screen`, `.safe-*`),
`app/page.tsx`, tutte le `components/sections/*`, `components/voting/*`,
`components/admin/{sidebar,bottom-nav,admin-theme-provider,sponsor-table}`,
`app/admin/**` (login, dashboard, import, sponsor, voti, impostazioni), `coming-soon/page.tsx`,
`i18n/*`, `lib/{VoteContext,admin-auth}.ts`, `cookie-consent.tsx`, `next.config.ts`
(`optimizePackageImports`), `playwright.config.ts`, `package.json`/`package-lock.json`,
`tests/e2e/**` (layout-analysis, accessibility, fixtures, voting.helper), `docs/frontend-quality.md`,
`README.md`.

## 5. Architettura del sistema responsive

- **Viewport SSOT**: `--app-height` = `100dvh` con fallback `100vh` (globals.css). Sezioni full-page
  con `.snap-screen` (`height: var(--app-height)`). `SearchSection` resta non fissa
  (`.app-screen`, min-height) per crescere col contenuto.
- **Safe-area**: token `--safe-area-inset-*`, `--safe-top/-bottom/-x`, classi `.safe-shell/.safe-pt/
  .safe-pb/.safe-px`; `viewportFit: cover` attivo in `layout.tsx`.
- **Modal system**: `modal-shell.tsx` (provider, z-index unico, scroll-lock via `use-scroll-lock.ts`,
  ECS) usato da cookie consent, search, import e impostazioni sponsor.
- **Token colore**: palette `--color-orange/magenta/purple/ink/bright/...` + `optimizePackageImports`
  per `@/components/ui` e `lucide-react`.
- **Tipografia fluida**: `clamp(min, min(vw, svh), max)` → scala con larghezza, ma si comprime su
  viewport basse (landscape) per non sforare la sezione.

## 6. Verifiche eseguite (tutte verdi)

| Verifica | Comando | Esito |
|---|---|---|
| Accessibilità a11y | `npm run test:a11y` / accessibilità (separata) | — (sessione dedicata) |
| TypeScript | `npm run typecheck` (+ `tsc --noUnusedLocals/Parameters`) | ✅ 0 errori |
| Lint | `npm run lint` | ✅ |
| Unit test | `npm run test` | ✅ 50/50 |
| Audit completo | `visual:audit` (9 route × 3 viewport) | ✅ 27/27 |
| Audit admin | `visual:audit:admin` (6 route × 3 viewport) | ✅ 18/18 |
| Gate strutturale P0 | `responsive-structural.spec.ts` (chromium + mobile-webkit) | ✅ 12/12 |
| Audit homepage | `visual:audit:homepage` (6 viewport) | ✅ 6/6, score 100% |
| Audit iOS | `visual:audit:ios` (7 device WebKit, `--workers=1`) | ✅ 7/7 |
| Audit safe-area | `visual:audit:ios:safearea` (7 device) | ✅ 7/7, footerIssue 0/7 |
| Audit chrome-stress | `visual:audit:ios:chrome` (28 casi) | ✅ 7/7 (era 0/7) |
| Riepilogo | `visual:audit:summary` | ✅ **7/7 suite**, 99 device, 0 errori |

### Warning residui (non bloccanti, 0 errori)

- **230 warning** nel summary: ~224 sono un **artefatto** del route `/coming-soon`
  (risponde `307 → /` quando il toggle è off: il selettore `main` dello spec analizza l'intera
  homepage e `checkOverflow` segnala ogni elemento oltre il bottom di un container full-page) +
  6 su `/admin/login` (input alti 32px < target 36px, **pre-esistenti**: il WIP non modifica il login).
- **Footer legale safe-area**: la suite safe-area segnalava `footer legal overlaps home indicator`
  (clearance 8px, inset 21/34px) su 6/7 device → **regressione del WIP** (il footer aveva perso
  `pb-[max(0.75rem,var(--safe-bottom))]`). **Corretto** in `contact-section.tsx`
  (`pb-[max(0.5rem,var(--safe-bottom))]`): ora clearance ≥ safe-bottom su tutti i device, suite 7/7
  con footerIssue vuoto ovunque.

## 7. Rischi e note operative

- **Dev server instabile sotto carico**: il dev server Turbopack viene ucciso dal sistema durante i
  run lunghi (Connection refused a metà suite). Workaround usato: avviarlo con `setsid nohup npm run dev`
  + pre-riscaldare le route (`curl`) o le pagine autenticate (spec Playwright one-off rimossa) prima
  degli audit. I timeout `page.goto`/`networkidle` (20s fail-fast) scattano su compilazione a freddo
  Turbopack delle route admin autenticate (>20s): pre-warm richiesto prima di `visual:audit*`.
- **WebKit**: gli audit iOS richiedono `--workers=1`; non lanciare due suite WebKit in parallelo.
- **Rate limit admin**: le suite autenticate riusano la sessione via `cachedAdminCookies`; `.env.local`
  ha già `ADMIN_LOGIN_RATE_MAX=100`/`ADMIN_MFA_VERIFY_RATE_MAX=100`. Riavviare il dev server dopo
  modifiche a `.env.local`.
- **`backup-src/`**: directory gitignored lasciata intatta (backup locale, non fa parte del repo).
- **Dipendenze**: rimosse `node-fetch`, `lightningcss`, `lightningcss-linux-x64-gnu` (mai importate).
  Tenute `@next/bundle-analyzer`/`@lhci/cli` (script `analyze`/`lighthouse`), `shadcn`/`supabase`
  (CLI), `tw-animate-css` e `@fontsource/open-sauce-one` (import in `globals.css`).
- **Commit sospeso**: tutto il lavoro è ancora non committato sul branch `revisione-ui`.

## 8. Decisioni e caveat aperti

- Il cap `min(vw, svh)` riduce leggermente (~5%) il titolo hero su desktop 1440px: accettato come
  tradeoff per garantire zero micro-scroll su landscape corti (P0).
- Layout due colonne di contact e griglia how-it-works ora partono da `lg:`/`sm:`: su
  tablet-landscape 1024×768 e phone-landscape il layout cambia rispetto a prima (verificato P0 green,
  ma è un cambio visivo deliberato).
- Suite `visual:audit` e `visual:audit:admin` non incluse in questo run (mancano dal riepilogo 5/7).
- Todo master non aggiornato in automatico (fuori scope sessione).

## 9. Prossimi passi consigliati

1. Commit del WIP su `revisione-ui` (decisione utente).
2. Valutare l'input login a 32px (< target 36px, pre-esistente, non bloccante) e l'artefatto
   `/coming-soon` nel selettore dello spec `visual-audit` (facoltativo, non legato al WIP).
3. Aggiornare la todo list della sessione master con lo stato A–G verificato qui.
