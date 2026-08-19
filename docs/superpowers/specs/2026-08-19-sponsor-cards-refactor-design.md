# SponsorCards v2 — Refactor UI (coerenza visiva + layout fluido 1→4)

Data: 2026-08-19
Stato: Bozza
Stile: B (piatto morbido) · Layout fluido senza media query · Approccio A (componente unico)

## Contesto

Le card sponsor compaiono in **5 contesti** della homepage:

| # | Sezione | Oggi | Uso |
|---|---------|------|-----|
| 1 | IntroSection | `SponsorCards` default | sotto subtitle |
| 2 | PublicRankingSection | `SponsorCards` default | sotto titolo |
| 3 | LiveRankingSection | `SponsorCards compact` | in fondo |
| 4 | SuccessSection | `SponsorCards` default | colonna sinistra (dopo voto) |
| 5 | PrizeLocationSection | **markup inline separato** (stand sponsor) | card grandi |

Problemi attuali:
- **Doppia implementazione**: PrizeLocation non riusa `SponsorCards` (dimensione/raggio/ombra diversi: `w-36..52`, `rounded-3xl/4xl`, `shadow 6px`).
- **Nessuna coerenza tra i 5 contesti** (default vs compact vs inline).
- **Nessuna etichetta** (scelta confermata: loghi nudi).
- Fallback senza logo = testo grigio a basso contrasto.
- Il layout non è validato per 1–4 sponsor (quest'anno **max 4**, oggi 2 confermati).

Obiettivi approvati:
1. **Coerenza visiva** tra i 5 contesti → un solo componente, un solo linguaggio visivo.
2. **Layout corretto per 1–4 sponsor** su ogni viewport.
3. **Abolire la card retrostante strutturata** → stile B: piatto bianco morbido.
4. **Responsività senza media query** → solo `flex-wrap + clamp()`, wrapping guidato dalle dimensioni minime della card.
5. **Nessuna dimensione hardcoded** → sizing come token in `globals.css` (SSOT), il componente referenzia le CSS var.

## Stile della card (stile B)

- `background: var(--color-card)` (#fff), `border-radius: var(--radius-2xl)` (`rounded-2xl`, token nativo, **uniforme tra varianti e viewport** — oggi è divergente: `rounded-2xl md:rounded-[2rem]` nelle card default, `rounded-3xl/4xl` in PrizeLocation), **niente bordo nero**, **niente hard shadow**.
- Ombra morbida leggera per staccare il piatto dal gradiente di sezione.
- `aspect-ratio: 1/1` (le card restano quadrate: il selettore `.aspect-square` usato da `voting-flow.spec.ts` resta valido).
- Logo: `object-contain` centrato con padding interno fluido.
- Fallback senza logo: stesso piatto, nome in `font-black` colore ink a contrasto sufficiente (≥ 4.5:1 su bianco), centrato, `text-balance`.
- Link: card intera cliccabile (`<a target="_blank" rel="noopener noreferrer">`), hover `-translate-y-1`, `active:scale-95`, focus ring purple (accessibilità, già in stile attuale).
- Rispetta `prefers-reduced-motion` (già globale in `globals.css`).

## Sistema dimensioni fluido (SSOT in `globals.css`)

Nessuna media query: il layout scaturisce da `flex-wrap` + `clamp()`. Il **min** della card è calcolato perché il wrap scatti da solo:

- **4 sponsor** → min **112px**: quattro card non stanno in un viewport ≤ ~520px → wrap naturale **2×2**; sopra, fila unica.
- **3 sponsor** → min **80px**: a 375px tre card stanno **in fila**.
- **1 sponsor** → card grande centrale.
- **flex-grow** espande le card per occupare la riga (niente buchi su tablet/desktop); **max-width** le frena a una soglia armoniosa.

Token nuovi in `:root` (globals.css, SSOT):

```css
/* ---- Design tokens: sponsor cards (refactor 2026-08-19) ---- */
--sponsor-gap: clamp(0.75rem, 2.5vw, 1.5rem);
--sponsor-card-1: clamp(7rem, 22vw, 13rem);   /* 1 sponsor */
--sponsor-card-2: clamp(5.5rem, 17vw, 10rem); /* 2 sponsor */
--sponsor-card-3: clamp(5rem, 14vw, 8rem);    /* 3 sponsor */
--sponsor-card-4: clamp(7rem, 13vw, 7.5rem);  /* 4 sponsor */
--sponsor-card-maxh: calc(var(--app-height) * 0.2); /* guardia 20svh */
--sponsor-scale-compact: 0.72;
--sponsor-scale-large: 1.3;
```

Dimensioni risultanti (default, valori reali):

| Viewport | 1 | 2 | 3 | 4 |
|----------|-----|-----|-----|------|
| 375px | 112 | 88 | 80 | 112 (2×2) |
| 768px | 169 | 131 | 108 | 112 (fila) |
| 1280px | 208 | 160 | 128 | 120 (fila) |

Gap fluido `--sponsor-gap` (12px → 24px).

`compact`/`large` = stessa formula moltiplicata per lo scale token → niente token per-variante duplicati.

Guardia altezza: `min(var(--sponsor-card-N), var(--sponsor-card-maxh))` come `max-width` su ogni card → con `aspect-square` l'altezza non supera mai il 20% dell'altezza viewport (preserva il vincolo attuale `max-h-[20svh]` di PrizeLocation, incluso in short-landscape).

## Componente `SponsorCards` (Approccio A)

Un solo componente, riscritto in `src/components/sponsor/sponsor-cards.tsx`.

```ts
type SponsorCardsProps = {
  variant?: 'default' | 'compact' | 'large';
  standOnly?: boolean;              // filter has_stand (PrizeLocation)
  refreshKey?: number | string;     // bump per refetch (realtime PrizeLocation)
  className?: string;
};
```

Comportamento:
- Fetch interno `GET /api/public/sponsors` (resta come oggi; **fuori scope** la dedupe delle 4 chiamate).
- `standOnly` filtra `has_stand` dopo il fetch.
- `refreshKey` cambia → rifetch (usato da PrizeLocation per la subscription Supabase realtime già presente).
- 0 sponsor → `null`; loading → skeleton di 4 piatti morbidi (stesso styling, `animate-pulse`, niente bordi/hard shadow).
- Container: `flex flex-wrap items-center justify-center gap-(--sponsor-gap)`.
- Card: `flex-grow basis-[var(--sponsor-card-N)] max-w-[min(var(--sponsor-card-N),var(--sponsor-card-maxh))] aspect-square`, con `--sponsor-card-N` scelto in base a `sponsors.length` (1→1, 2→2, 3→3, ≥4→4) e allo scale della variant.
- `<a>` se `website_url`, `<div>` altrimenti (come oggi).

Sintassi Tailwind v4 per le CSS var: `basis-(--sponsor-card-1)`, `max-w-(--sponsor-card-1)`, `gap-(--sponsor-gap)`. La guardia 20svh richiede `min()`: valutare `max-w-[min(var(--sponsor-card-N),var(--sponsor-card-maxh))]` (arbitrary value valido in v4).

## Modifiche alle sezioni consumer

- **IntroSection**: `variant` default, invariato il resto.
- **PublicRankingSection**: default, invariato.
- **LiveRankingSection**: `variant="compact"`, invariato.
- **SuccessSection**: default, invariato.
- **PrizeLocationSection**: **rimuovere il markup inline** (righe 57–88) e renderizzare `<SponsorCards variant="large" standOnly refreshKey={refreshKey} />`. Mantiene la subscription Supabase realtime su `sponsors`, bump di `refreshKey` al cambio. Spostare il fetch in `useEffect` esistente (il componente ora fa fetch interno; il subscription continua a triggerare il refetch via `refreshKey`). La sezione non filtra più `has_stand` da sé (lo fa il componente).

## Verifiche (obbligatorie per il gate P0, vedi AGENTS.md)

- `npm run visual:audit:homepage` — matrice responsive (6 viewport) con 1/2/3/4 sponsor.
- `npm run visual:audit:ios` — 7 device WebKit (`--workers=1`).
- `npm run visual:audit:ios:safearea` e `...:chrome` (VISUAL_IOS_MODAL=1).
- `npm run visual:audit:summary` — rigenerare il report.
- `npm run test:e2e` — include `responsive-structural.spec.ts` (gate P0).
- `voting-flow.spec.ts` — il test "sponsor cards stay within the success section bounds at mobile" usa `.aspect-square`: resta valido perché le card restano quadrate; verificare comunque.
- Verificare **1 e 4 sponsor** oltre ai 2 reali (seed/override) per coprire il wrap 2×2 mobile.

## Fuori scope

- Deduplicazione delle 4 fetch a `/api/public/sponsors` (hook condiviso).
- Nuove etichette/contratto "sponsor/partner".
- Stile C/D/E (scartati in brainstorming).
- Admin (tabella sponsor invariata).
- Backend (`/api/public/sponsors`, schema DB) invariato.