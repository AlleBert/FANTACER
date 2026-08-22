# Legal Pages Clean Design — Design Spec

**Data**: 22 agosto 2026
**Status**: Approvato per implementazione
**Direzione**: Clean Document + velatura brand tenue

## Obiettivo

Ridisegnare le 3 pagine legali (`/privacy-policy`, `/terms-and-conditions`, `/cookie-policy`) rendendole più semplici, leggibili ed equilibrate. Le pagine attuali usano contenuto in card galleggianti dentro un background a gradiente: si perde equilibrio visivo, ottimizzazione dello spazio e semplicità di lettura. Nuova direzione: documento pulito su superficie chiara con velatura brand tenue, piccolo richiamo al design della webapp (non il design completo), bottone per tornare alla webapp, TOC desktop davvero sticky con scrollspy.

## Problemi identificati (stato attuale)

1. **Card in gradiente**: l'articolo è una card bianca (`lg:rounded-[2.25rem] lg:border-[3px] lg:border-ink` + ombra) galleggiante su un gradiente viola a tutta pagina (`sectionThemes.legal`). Equilibrio visivo e ottimizzazione spazio pessimi.
2. **Card tagliate**: il foglio bianco con bordo e padding fisso tronca il contenuto su alcuni viewport.
3. **Manca bottone per tornare alla webapp**.
4. **TOC desktop non sticky**: lo scroll avviene su un contenitore interno (`overflow-y-auto` nel layout), quindi `position: sticky` del TOC è relativo a quel contenitore e "si muove", rendendolo inutile.
5. **TOC mobile brutto**: pill giganti con ombra nera (`shadow-[4px_4px_0_#000]`), doppio livello, poco pulito.
6. **Summary box**: box incorniciato pesante invece di una banda sobria.

## Decisioni di Design

### 1. Superficie e sfondo

- Sfondo pagina: `linear-gradient(180deg, #f0eaff 0%, #faf9f6 ~40%, #faf9f6 100%)`.
  - Velatura lilla/viola brand (tenue) nella parte alta, che sfuma a caldo off-white (#faf9f6).
  - Niente gradiente dominante a tutta pagina.
- **Niente card galleggianti**: il contenuto vive su un foglio bianco full-bleed (colonna che si estende col testo, senza bordo né ombra che la tronchi).
- **Scroll sulla finestra**: rimosso il contenitore interno `overflow-y-auto` → il documento scorre sul viewport, il TOC sticky resta fermo.

### 2. Header sticky

- Barra sticky top (visibile sempre durante lo scroll):
  - Sinistra: wordmark **FANTACER★**.
  - Destra: bottone pill **«← torna al gioco»** con `href="/"` (HOME), `bg-ink text-bright`, coerenza brand.
- Sfondo semi-trasparente con `backdrop-blur`, bordo inferiore sottile.
- Safe-area top rispettata (`--safe-top-offset`).

### 3. TOC (indice)

- **Desktop (≥ lg)**: colonna fissa a sinistra, sticky `top`, lista di pill semplici:
  - Pill attiva (scrollspy): bordo nero + testo pieno.
  - Pill inattive: grigio tenue, nessuna ombra pesante.
  - Scrollspy: evidenzia la sezione attualmente in viewport (IntersectionObserver, `prefers-reduced-motion` rispettato).
- **Mobile**: **singolo accordion** pulito (`<details>`), pill semplici dentro, niente doppio livello né ombre pesanti.

### 4. Contenuto (article)

- Foglio bianco full-bleed: `bg-white`, padding generoso responsivo.
- **Rimossi**: `border-3 border-ink`, `rounded-[2.25rem]`, ombra.
- `prose-legal` semplificata: h2 con bordo superiore tenue (niente tratti pesanti), tipografia esistente conservata.
- Tabelle: restano brand-styled (utili per retention/cookie) ma nel flusso del testo; fallback card mobile (`table-card-mobile`) conservato.

### 5. Summary box

- Da box incorniciato → **banda colorata** con `border-left` di accento:
  - Privacy → blu (`bg-question-blue/15`, `border-question-blue`)
  - Terms → verde
  - Cookie → giallo
- Testo invariato, struttura interna semplificata.

### 6. Footer (variante chiara)

- `SiteFooter` ottiene una **prop `variant`** (`'dark'` default per ContactSection, `'light'` per legal).
- Su legal: testo **scuro** (`text-ink/70`) su sfondo chiaro.
- **Solo le 3 legal pages** (no bottone «Preferenze cookie»): prop `showCookieButton={false}`.

## Componenti

### 1. `LegalPageLayout` (refactor)

**File**: `src/components/legal/legal-page-layout.tsx`

**Struttura**:
- `SectionFrame theme="legal" grow` + `className="flex flex-col"` (invariato, `overflow-hidden` ok perché scroll sulla finestra).
- Background di superficie: velatura brand tenue (inline style o classe).
- Header sticky (wordmark + bottone torna al gioco).
- Container: `flex flex-col lg:flex-row`, scroll naturale sulla finestra (rimosso `overflow-y-auto` interno).
- TOC desktop sticky + scrollspy; TOC mobile accordion.
- Article bianco full-bleed con `prose-legal`.
- Banda summary colorata.
- `SiteFooter variant="light" showCookieButton={false}`.

**Props** (invariate): `toc`, `summaryBox`, `summaryColor`, `className`, `titleKey`, `lastUpdatedKey`.

### 2. `SiteFooter` (variante)

**File**: `src/components/layout/site-footer.tsx`

**Props nuove**:
- `variant?: 'dark' | 'light'` (default `'dark'`).
- `showCookieButton?: boolean` (default `true`).

**Comportamento**:
- `dark` (default): comportamento attuale, per `ContactSection`.
- `light`: testo `text-ink/70`, hover `text-ink`, separatori `text-ink/40`, sfondo trasparente.
- `showCookieButton={false}`: rimuove il bottone «Preferenze cookie» (solo 3 link legali).

### 3. Pagine legali

**File**: `src/app/privacy-policy/page.tsx`, `terms-and-conditions/page.tsx`, `cookie-policy/page.tsx`

- `summaryColor` mappato alle nuove bande (nessun cambio di API; eventualmente micro-tweak dei colori).
- Nessuna altra modifica strutturale (contenuto invariato).

## CSS (globals.css)

- Classe superficie legale: `background: linear-gradient(180deg, #f0eaff 0%, #faf9f6 40%, #faf9f6 100%)`.
- Banda summary: utilty inline o classe (border-left accent + bg tenue).
- TOC: pill semplificate (niente `shadow-[2px_2px_0_#000]` su mobile/details), stato attivo scrollspy.
- `prose-legal`: h2 bordo tenue, eventuale rimozione regole pesanti ridondanti (nota: ci sono 2 blocchi `prose-legal h2` in globals.css — unificare).
- Tweak sticky TOC per scroll su finestra.

## Test

### Aggiornare

- `tests/e2e/legal-pages.spec.ts`:
  - Rimozione asserzione bottone «Preferenze cookie» nel footer legale (ora `showCookieButton=false`).
  - `#legal-content` deve restare `bg-white` (conservato).
  - Aggiungere verifica scroll su finestra + TOC sticky (posizione TOC invariata dopo scroll).
  - Verifica bottone «torna al gioco» presente, `href="/"`.
  - `h1` e `footer` invariati (3 link legali, stesso tab).

### Eseguire

- `npx playwright test tests/e2e/legal-pages.spec.ts --project=chromium --workers=1`
- `npm run e2e:home` (homepage + legal-pages + smoke + scroll-blocking + accessibility)
- `npm run build`

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/legal/legal-page-layout.tsx` | Refactor layout (header sticky, scroll finestra, TOC, article, summary, footer light) |
| `src/components/layout/site-footer.tsx` | Prop `variant` + `showCookieButton` |
| `src/app/globals.css` | Superficie velatura, banda summary, TOC semplificato, prose-legal unificato |
| `tests/e2e/legal-pages.spec.ts` | Aggiornare asserzioni (footer, sticky, bottone torna) |
| `src/components/sections/contact-section.tsx` | Invariato (usa default `variant="dark"`) |

## Scope Escluso

- Modifiche al footer della homepage/ContactSection (resta `dark`).
- Modifiche al modal `CookieConsentUI`.
- Modifiche a `SectionFrame` o `sectionThemes`.
- Modifiche al contenuto legale formale (testi GDPR/terms invariati).
- Nuove dipendenze.