# Responsive System

Documentazione dell'architettura responsive della webapp Fantacer e di come verificarla. Le regole operative per lo sviluppo sono in `AGENTS.md`; questo documento descrive il "come è fatto" e il "come si verifica".

## Architettura

La homepage è un **gioco a sezioni full-page** con scroll-snap verticale:

- Lo scroll container è `<main>` (`src/app/page.tsx`): `height: var(--app-height)`, `overflow-y-auto`, `snap-y snap-mandatory`, `scroll-smooth`. Il body non scrolla: è `main` a scorrere tra le sezioni.
- Ogni sezione è un `<section>` figlio diretto con `snap-start` e altezza full-page.

### Altezza di viewport

| Token | Valore | Uso |
|---|---|---|
| `--app-height` | `100vh` con fallback, poi `100dvh` via `@supports` (`globals.css:114,122-126`) | altezza di `main`, `.app-screen`, `.safe-shell` |
| `h-[100dvh]` | altezza fissa delle sezioni full-page | tutte le sezioni tranne `SearchSection` |
| `.app-screen` | `min-height: var(--app-height)` (crescita consentita) | `SearchSection` (contenuto dinamico) |

Non usare `100vh` nudo nei componenti: usa `h-[100dvh]` o il token. Valutare `svh`/`lvh` solo quando serve un comportamento specifico (URL bar mobile).

### Safe areas

Token in `globals.css:110-119` e classi `@layer components` (`globals.css:179-200`):

```
--safe-area-inset-*  → env(safe-area-inset-*)
--safe-top/--safe-bottom/--safe-x → max(1rem, inset)  (minimo garantito)
--safe-top-offset/--safe-bottom-offset → inset + 1rem
.safe-shell  → padding top/bottom/left/right dai token, min-height: var(--app-height)
.safe-pt/.safe-pb/.safe-px  → singole direzioni
```

- `viewportFit: cover` è attivo (`src/app/layout.tsx`).
- Ogni sezione usa `.safe-shell` come primo contenitore: i padding safe-area sono **integrati nel sistema di spacing**, mai aggiunti a mano a singoli elementi.
- Elementi ancorati ai bordi (footer legale del contact, bottom-nav admin) usano `var(--safe-bottom)`.

### Tipografia fluida

I testi usano `clamp()` con unità `vw`/`dvh` (es. `text-[clamp(2.5rem,7.5vw,91px)]`). Verifica sempre wrapping, CTA lunghe e localizzazione IT/EN.

## Matrice di verifica

Audit Playwright (`tests/e2e/`):

| Comando | Cosa copre | Gate CI |
|---|---|---|
| `npm run test:e2e` | `responsive-structural.spec.ts`: per ogni sezione, micro-scroll, overflow, altezza vs viewport, box nel viewport (chromium + mobile-webkit, 6 viewport) | sì |
| `npm run visual:audit:homepage` | 6 viewport × 9 sezioni + sub-elementi + score | no (decisionale) |
| `npm run visual:audit:ios` | homepage su 7 device WebKit (`--workers=1`) | no |
| `npm run visual:audit:ios:safearea` | safe-area simulata (notch/Dynamic Island/home indicator) su 7 device WebKit | no |
| `npm run visual:audit:ios:chrome` | viewport/chrome stress (URL bar, viewport basse/strette) su 7 device WebKit | no |

Viewport di riferimento (`tests/e2e/helpers/viewports.ts`): `mobile-small 320×640`, `mobile 375×812`, `tablet-portrait 768×1024`, `tablet-landscape 1024×768`, `desktop 1440×900`, `desktop-wide 1920×1080`.

### Criteri automatici (spec strutturale)

Per ogni sezione (`main > section`):

- `scrollHeight <= clientHeight + 1` — zero micro-scroll/clipping verticale.
- `scrollWidth <= clientWidth + 1` — zero overflow orizzontale.
- `height <= viewportHeight + 2` — sezione non più alta dello spazio disponibile.
- bounding box dentro il viewport (±2px).
- Se un criterio fallisce: correggi la causa (spacing/tipografia/layout fluido). Se il contenuto è realmente troppo grande e il prodotto richiede scroll interno, rendilo **esplicito e intenzionale**.

## Limitazioni note

- `SuccessSection` è condizionale (montata solo dopo il voto): non è coperta dagli audit standard (coperta parzialmente da `voting-flow.spec.ts`).
- WebKit/Playwright **non** simula `env(safe-area-inset-*)` reali: l'audit safe-area emula l'effetto sul layout overrideando i token CSS (`--safe-top`, `--safe-bottom`, `--safe-x`). Il notch reale e il comportamento Safari richiedono verifica manuale su device.
- Le liste sezione basate su `main > section:nth-child(n)` negli spec esistenti vanno aggiornate se cambia il DOM. Lo spec strutturale usa `main > section` (robusto al riordino).
