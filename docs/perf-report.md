# Report Performance — Fantacer

Analisi incrociata di **bundle** (`@next/bundle-analyzer`, build webpack production) e
**re-render** (`react-scan`, run su `next dev` con journey utente reale, viewport 1280×800 + 390×844).

Data: 27/08/2026 · Build: Next 16.2.4, webpack (analyzer), Tailwind v4.

---

## 1. Bundle client — homepage (`app/page`)

JS **iniziale** (first paint) della homepage pubblica:

| Metrica | Valore |
|---|---|
| Totale JS iniziale | **447 kB gzip** (1458 kB parsed) |
| N. chunk iniziali | 12 |

### Pacchetti dominanti nel bundle iniziale homepage (gzip)

| Pacchetto | kB gzip | Note |
|---|---|---|
| `framer-motion` + `motion-dom` | **219 + 163 = 382** | Animazioni; anche causa di re-render (vedi §2) |
| `@sentry/nextjs` (+ core/browser) | **~272.7** | Inizializzato globalmente, presente su TUTTE le pagine pubbliche (sample rate = 0) |
| `@supabase/ssr` + `auth-js` + `@supabase` | **197 + 69 + 42.8 = ~309** | Stack Supabase su pagina pubblica |
| `react-cookie-manager` | **112** | Solo 2 moduli: dipendenza molto pesante per un cookie banner |
| `@fingerprintjs/*` | **~53** | Device fingerprinting |
| ~~`html-to-image`~~ | — | Rimosso: Salva genera la share card server-side (next/og) |
| `canvas-confetti` | 8 | Success |
| `lucide-react` | 7.6 | Ottimizzato (tree-shaking ok) |

> ✅ **Positivo**: `recharts` (**461 kB gzip**) e `@base-ui/react` full sono
> **code-split per route** — caricati solo nelle pagine admin (`panoramica`),
> NON nel bundle della homepage pubblica. La code-splitting per route funziona.

---

## 2. Re-render (react-scan)

Rilevati su journey reale (scroll completo + ricerca + selezione + resize mobile).
`afterLoad` = 0 perché il collector è installato dopo il mount (misura i re-render, non il primo render).

### Hotspot cumulativi (fine journey)

| Componente | Rendering | Tempo | Fonte / problema |
|---|---|---|---|
| `Anonymous` | **78x** | 27 ms | Componenti **anonimi** (senza nome): impossibile profilarli, code-quality |
| `MeasureLayout` / `MeasureLayoutWithContext` | **40x + 40x** | 2.1 ms | `framer-motion` `layout`/`AnimatePresence` |
| `PresenceChild` / `PopChild` / `PopChildMeasure` | **27x ciascuno** | ~5 ms | Interni `AnimatePresence` |
| `AnimatePresence` | 22x | 8 ms | Animazioni enter/exit frequenti |
| `LiquidFillButton` | **22x → 41x** | 21→33 ms | Re-render esplosivo al **resize** viewport (custom animation, SVG per frame) |
| `AppShell` / `BackgroundLayer` / `BrowserThemeColor` | 8x ciascuno | ~5 ms | Re-render a ogni cambio sezione scroll |
| `SearchSection` | 3x | 6.6 ms | Solo durante ricerca/select (ok) |
| `LiveRankingSection` | 2x | **26.4 ms** | Re-render pesante quando entra in viewport (fetch + lista ranking) |

---

## 3. Vulnerabilità performance incrociate (bundle × re-render)

### 🔴 Alta priorità

1. **`framer-motion` — doppio costo (bundle + re-render).**
   - Bundle: **382 kB gzip** (fram-motion + motion-dom) nel JS iniziale homepage.
   - Runtime: `AnimatePresence`/`PresenceChild`/`MeasureLayout` sono tra i componenti
     che più re-renderizzano (22–40x) durante il journey.
   - Rischio: pesa sia sul download sia sul main-thread. Valutare se tutte le animazioni
     di presenza/layout sono necessarie, o ridurre l'uso di `AnimatePresence` in favore
     di transizioni CSS dove possibile (come da policy AGENTS).

2. **`@sentry/nextjs` (272.7 kB gzip) caricato sulla homepage pubblica.**
   - Inizializzato globalmente via `sentry.client.config.ts` con tutti i sample rate a 0.
   - Costo: ~273 kB gzip di JS per **ogni visitatore pubblico**, inclusi i non-loggati.
   - Azione: verificare se caricare Sentry solo su route/app dove serve davvero
     (es. lazy/route-level) per non penalizzare LCP della pagina pubblica.

3. **`react-cookie-manager` (112 kB gzip, solo 2 moduli).**
   - Dipendenza sproporzionata per un cookie banner. Valutare sostituzione con un
     gestore più leggero o implementazione custom minimale.

### 🟠 Media priorità

4. **`LiquidFillButton` re-render esplosivo al resize (22x→41x).**
   - Custom animation (SVG ridisegnato per frame via ref) che però re-renderizza il
     componente React a ogni resize viewport. Insieme a `MeasureLayout` di framer-motion
     contribuisce al jank mobile. Valutare memoizzazione/debounce del resize o ricalcolo
     più contenuto quando il viewport cambia rapidamente.

5. **Stack Supabase (~309 kB gzip) interamente nel bundle pubblico.**
   - `@supabase/ssr` + `auth-js` + client sono necessari per il voto/search, ma pesano.
   - Verificare che i moduli auth non vengano inclusi dove non servono (es. page statica).

6. **Componenti anonimi (78x rendering "Anonymous").**
   - Non è un costo enorme in sé, ma impedisce la profilazione: dare un `name`/`displayName`
     ai componenti non nominati migliora ogni futura analisi.

7. **`AppShell`/`BackgroundLayer` re-render a ogni cambio sezione (scroll).**
   - Lo scroll tracking aggiorna sezioni attive → re-render dello shell. Memoizzare i
     sottostati che non dipendono dalla sezione attiva (es. BackgroundLayer statico).

### 🟢 Bassa / note

8. **~~`html-to-image`~~** — rimosso (il Salva ora usa una share card `next/og` server-side). **`canvas-confetti` (8 kB)**: costo contenuto e giustificato.
9. **`lucide-react`**: già ottimizzato (tree-shaking, 7.6 kB) — ok.
10. **`recharts`/`@base-ui`**: correttamente code-split (solo admin) — nessuna azione.

---

## 4. Priorità consigliate

| # | Azione | Impatto atteso | Sforzo |
|---|---|---|---|
| 1 | Ridurre/eliminare `@sentry/nextjs` dal bundle pubblico (lazy o route-scope) | −273 kB gzip LCP | Media |
| 2 | Valutare sostituzione `react-cookie-manager` | −112 kB gzip | Media |
| 3 | Ridurre uso `AnimatePresence`/layout anim in favore di CSS dove possibile | −JS + meno re-render main-thread | Media |
| 4 | Memoizzare/debounce `LiquidFillButton` su resize | Meno jank mobile | Bassa |
| 5 | Memoizzare `BackgroundLayer`/`AppShell` rispetto allo scroll | Meno re-render | Bassa |
| 6 | Dare nomi ai componenti anonimi | Miglior profilazione | Bassa |

**Obiettivo realistico**: il bundle iniziale homepage (447 kB gzip) può scendere a
**~300–330 kB gzip** affrontando Sentry + cookie-manager (item 1–2), senza toccare il
codice delle sezioni.
