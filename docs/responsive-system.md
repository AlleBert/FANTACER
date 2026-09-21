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
| `h-[100dvh]` | altezza fissa delle sezioni full-page | sezioni full-page a snap |
| `.app-screen` | `min-height: var(--app-height)` (crescita consentita) | `SearchSection` e `SuccessSection` (contenuto che può superare la viewport) |

`SectionFrame` applica `snap-screen` (fissa) di default o `snap-start app-screen` (cresce col contenuto) con la prop `grow`. `SearchSection` e `SuccessSection` usano `grow`: il contenuto può superare la viewport in modo intenzionale (mai clippato, mai scroll interno accidentale). Non usare `100vh` nudo nei componenti: usa `h-[100dvh]` o il token. Valutare `svh`/`lvh` solo quando serve un comportamento specifico (URL bar mobile).

### Design tokens (sistema 2026-08-16)

Definiti in `globals.css` (`:root` + `@layer components`) dopo una modifica strutturale, non per patch locali. Si usano via classi Tailwind v4: `gap-(--x)`, `text-(length:--x)`, `max-w-(--x)`, `leading-(--x)`, `py-(--x)`. **Per i token font-size serve sempre il tipo `text-(length:--fs-*)`** — `text-(--fs-*)` senza `length:` compila a `color`, non a `font-size` (verificato su Tailwind v4.3).

| Gruppo | Token | Valore | Uso |
|---|---|---|---|
| Spacing | `--space-xs/sm/md/lg/xl` | 0.5–2rem | scala fissa |
| Spacing | `--space-2xl/3xl` | `clamp(2rem,6svh,3rem)` / `clamp(2.5rem,8svh,4rem)` | spazi grandi fluidi |
| Ritmo | `--rythm-sec` | `clamp(1.25rem,3.5svh,3rem)` | gap tra blocchi di sezione |
| Ritmo | `--rythm-blk` | `clamp(0.5rem,2svh,1.5rem)` | gap interni ai blocchi |
| Ritmo | `--section-pad` | `clamp(0.5rem,2svh,1.5rem)` | padding verticale interno sezione |
| Ritmo | `--card-size` | `clamp(3.5rem,17svh,13rem)` | card quadrate (how-it-works) |
| Tipografia | `--fs-display` | `clamp(2rem,min(6vw,9svh),5.625rem)` floor 32px, height-aware | h1 hero/intro |
| Tipografia | `--fs-headline` | `clamp(1.5rem,6vw,4.5rem)` floor 24px | h2 sezioni |
| Tipografia | `--fs-headline-tight` | `clamp(1.5rem,4.5vw,4.5rem)` floor 24px | h2 con righe strette (how-it-works, live-ranking) |
| Tipografia | `--fs-cta` | `clamp(1.5rem,5vw,2.5rem)` | CTA |
| Tipografia | `--lh-display/headline/body` | 1.05 / 1.1 / 1.4 | line-height |
| Contenuto | `--content-max` | `1200px` (via `.content-max`) | larghezza contenuto unica (sostituisce `max-w-7xl`/`max-w-[1200px]`) |
| Contenuto | `--measure-display` | `min(100%,22ch)` | misura di lettura h1 |
| Contenuto | `--measure-body` | `min(100%,40ch)` | misura di lettura corpo |
| CTA | `--cta-pad-x/y` | `clamp(2rem,10vw,6rem)` / `clamp(1rem,min(4vw,6svh),3rem)` height-aware | padding CTA fluido |
| CTA | `--cta-scale` | 1 (sovrascritto inline da `CtaButton`) | scala extra (play-again 1.15) |

- La utility `.content-max` (`width:100%; max-width:var(--content-max); margin-inline:auto`) sostituisce `max-w-7xl mx-auto` e `max-w-[1200px]`. `intro` e `how-it-works` conservano `max-w-7xl mx-auto` (contenuto già vincolato dai `--measure-*`); la regola è comunque preferirla.
- I token con componente `vw`/`svh` preferita possono usare `min(...)` per essere height-aware su viewport short-landscape (es. `--fs-display: clamp(2rem,min(6vw,9svh),5.625rem)`, `--cta-pad-y: clamp(1rem,min(4vw,6svh),3rem)`): su portrait il comportamento è identico al solo `vw`, su viewport larghe e basse il valore si riduce per altezza.
- `@media (prefers-reduced-motion: reduce)` globale in `globals.css` riduce animazioni/transizioni a livello di CSS; le animazioni JS (es. confetti) hanno una guardia `matchMedia` dedicata.
- Il componente `CtaButton` (`src/components/ui/cta-button.tsx`) è l'unico CTA «GIOCA»: geometria fluida via `--cta-*`, `scale` prop per play-again.

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
- La **bottom-nav admin** è una pillola glass flottante (`fixed`, `bottom: var(--safe-bottom)`, `left/right: var(--safe-x)`, `max-w: 34rem`): lo spazio inferiore del contenuto è `pb-[calc(var(--safe-bottom)+5rem)]`. Le label collassano via container query (`@container (max-width: 22.5rem)`), non con breakpoint viewport.

### Tipografia fluida

I testi usano `clamp()` con unità `vw`/`dvh` (es. `text-[clamp(2.5rem,7.5vw,91px)]`). Verifica sempre wrapping, CTA lunghe e localizzazione IT/EN.

## Matrice di verifica

Audit Playwright (`tests/e2e/`):

| Comando | Cosa copre | Gate CI |
|---|---|---|
| `npm run test:e2e` | `responsive-structural.spec.ts`: per ogni sezione, micro-scroll, overflow, altezza vs viewport, box nel viewport (chromium + mobile-webkit, 6 viewport) | sì |
| `npm run visual:audit:homepage` | 6 viewport × 8 sezioni + sub-elementi + score | no (decisionale) |
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

- `SuccessSection` è condizionale (montata solo dopo il voto): non è coperta dagli audit standard (coperta parzialmente da `voting-flow.spec.ts`). Usa `grow` (`.app-screen`): il contenuto può superare la viewport senza clippare.
- WebKit/Playwright **non** simula `env(safe-area-inset-*)` reali: l'audit safe-area emula l'effetto sul layout overrideando i token CSS (`--safe-top`, `--safe-bottom`, `--safe-x`). Il notch reale e il comportamento Safari richiedono verifica manuale su device.
- Le liste sezione basate su `main > section:nth-child(n)` negli spec esistenti vanno aggiornate se cambia il DOM. Lo spec strutturale usa `main > section` (robusto al riordino).
