# Realtime — architettura e verifica

Client realtime della homepage (classifica live + flag voto) centralizzato in un
unico provider, con una sola connessione per scheda e canali multiplexati.

## Perché

Prima ogni componente apriva le proprie sottoscrizioni (`live-ranking-section` ne
aveva due, `search-section` una): la logica era sparsa e c'erano **due canali**
sullo stesso `site_settings`. Il refactor centralizza il lifecycle, elimina il
canale duplicato e rende il realtime un **enhancement non critico**: se non
disponibile, il polling copre gli aggiornamenti.

## Connessioni: 1 per scheda

`@supabase/ssr` v0.10 rende `createBrowserClient` un **singleton nel browser**
(`node_modules/@supabase/ssr/dist/main/createBrowserClient.js:9,54`): tutte le
chiamate a `createClient()` in una scheda restituiscono lo stesso client, quindi
**una sola WebSocket** indipendentemente dal numero di componenti/canali. Supabase
Realtime multiplexa fino a ~100 canali sulla stessa connessione.

Conseguenza sul piano Free (**~200 connessioni**): ~**200 schede/visitatori** (non
~100). Vedi `docs/load-testing-report.md` §6.

## Componenti

| File | Ruolo |
|---|---|
| `src/lib/RealtimeContext.tsx` | `RealtimeProvider`, `useRealtime()`, `useRankingTick(enabled)` |
| `src/components/sections/live-ranking-section.tsx` | consumer: viewport gate, refetch su `rankingVersion`, polling fallback |
| `src/components/sections/search-section.tsx` | consumer: `votingEnabled` dal contesto (niente canale proprio) |
| `src/app/page.tsx` | monta `RealtimeProvider` attorno alla pagina |

## Canali

| Canale | Tabella | Evento | Effetto |
|---|---|---|---|
| `realtime-voting-flag` | `site_settings` (`key=eq.voting_enabled`) | UPDATE | refetch `/api/public/flag/voting` → `votingEnabled` |
| `realtime-ranking-tick` | `ranking_tick` | UPDATE | debounce 500ms → `rankingVersion+1`, `realtimeActive=true` |

Il canale ranking è **refcounted** (`useRankingTick`): si apre solo se almeno un
consumer lo richiede (sezione classifica in viewport) e la scheda è visibile.

## Comportamento

- **Flag voto**: parte ottimistico (`true`, come lo storico preview di ricerca),
  poi viene corretto dal fetch; su evento UPDATE ri-fetcha. Esposto come
  `votingEnabled` (e `votingEnabledLoaded`).
- **Classifica**: `realtimeActive` è `true` **solo** dopo la consegna reale di un
  evento (mai dal solo status `SUBSCRIBED`: con RLS che blocca gli eventi il
  client resterebbe "connesso" ma muto). Finché `false`, la sezione fa **polling di
  fallback ogni 10s**; quando `true`, il polling si ferma.
- **Background**: su `document.visibilitychange` i canali vengono chiusi e
  `realtimeActive` torna `false`; al ritorno in primo piano si ri-sottoscrive e si
  fa **catch-up** (refetch del flag e della classifica se in viewport).
- **Degrado**: se `createClient()` o la sottoscrizione falliscono (storage
  bloccati su iOS, CSP, offline), `safeClient`/`safeSubscribe` degradano senza
  crash; resta il polling.

## Verifica

**Unit (Jest)**
```bash
npx jest --maxWorkers=4 tests/components/realtime/realtime-provider.test.tsx
npx jest --maxWorkers=4 tests/components/sections/live-ranking-realtime.test.tsx
npm test
```
Coprono: un solo canale flag, refetch su UPDATE, apertura refcounted del canale
ranking, `rankingVersion` debounced, `realtimeActive` solo su evento reale,
chiusura/riapertura su visibilità, refetch di catch-up.

**E2E (Playwright, progetto E2E, `--workers=1`)**
```bash
npx playwright test tests/e2e/realtime-live.spec.ts --project=chromium --workers=1
```
- un evento `ranking_tick` reale (voto inserito con service role) innesca il
  refetch della classifica (conteggio chiamate `/api/public/ranking`);
- il toggle `voting_enabled` via admin aggiorna la UI **senza reload**
  (il provider riceve l'UPDATE e la ricerca mostra il blocco "Quanta fretta!").

**Gate di non-regressione**
```bash
npm run e2e:gate   # responsive-structural + voting-flow (chromium + mobile-webkit)
```
Nota: in locale `playwright.config.ts` avvia `next dev`, quindi la scansione
accessibilità vede il toolbar di **react-scan** (`#react-scan-root`) e fallisce su
`button-name`; è un artefatto dev, non una regressione (su CI con `npm run start`
non compare).

## Load test su E2E prima della produzione

Dopo il refactor va rieseguito il carico su `fantacer-e2e` con l'app self-hosted
(come la campagna del 2026-09-17): `smoke → stepped 100/200/300 → baseline 500`
con `load:run`, poi `load:run -- realtime` (150/250) e `loadtest:cleanup`.
Dettagli: [`docs/load-testing.md`](load-testing.md) e
[`docs/load-testing-report.md`](load-testing-report.md).
