# LIVE RANKING a fasce — Design

## Summary

Nuova modalità di **presentazione** della classifica pubblica (`LiveRankingSection`),
senza modifiche alla logica di voto, al calcolo del punteggio, al numero di aziende
o ai dati di backend. Il ranking reale resta completo (1-333) e il punteggio
(`total_pallets`) resta disponibile internamente per tutte le aziende.

La classifica viene mostrata come **una sola LIVE RANKING divisa in fasce**
derivate deterministicamente dal rank:

| Fascia | Rank | Punteggio mostrato |
|--------|------|--------------------|
| TOP 20 | 1-20 | sì (pallet) |
| GOLD | 21-50 | no |
| SILVER | 51-100 | no |
| BRONZE | 101-333 | no |

## Decisioni prese in brainstorming (visual companion)

1. **Niente classifica nella sezione ricerca**: la sezione voto (§6) resta
   invariata. La classifica a fasce sta **solo** nella sezione dedicata
   `LiveRankingSection` (§8), che **sostituisce** la vecchia UI a barre.
2. **TOP 20 sempre aperta** e consultabile, con punteggi.
3. **GOLD/SILVER/BRONZE chiuse** a fisarmonica, con **conteggio aziende**
   nell'header (30/50/233).
4. **Aziende votate evidenziate nella loro fascia**: niente blocco "il tuo voto"
   separato (lo gestisce già la `SuccessSection`, in lavorazione parallela).
   Se una fascia chiusa contiene aziende votate dall'utente, l'header mostra un
   badge compatto; all'apertura le righe interessate sono evidenziate (sfondo
   viola chiaro + badge "il tuo voto"). Regola per più aziende nella stessa
   fascia (vedi §3.1): 1 voto → `#37 MARAZZI`; 2+ → `2 · #37 #44`; 3+ su
   mobile → `3 · i tuoi voti`.
5. **CTA "request full ranking" FUORI SCOPO**: non si implementa, nessun
   componente, endpoint o chiave i18n. Rimosso dal design (vedi §11).
6. **Tie-breaker deterministico**: `ORDER BY total_pallets DESC, name ASC,
   id ASC` nella RPC `get_company_ranking` (vedi §6). Niente `vote_count` come
   chiave di ordinamento. Rank = posizione assoluta 1–333, **nessun pari
   merito**.
7. **Realtime**: canale Supabase su `vote_sessions` come meccanismo PRIMARIO;
   il polling 30s resta esclusivamente come FALLBACK quando il canale non è
   connesso/disponibile, e viene disattivato quando Realtime torna attivo.
   Gestione visibilità della sezione via `IntersectionObserver` (vedi §4.3).
8. **Nessuna ricerca nel ranking** per ora: la ricerca esiste solo nella
   sezione voto.

## 1. Analisi dello stato attuale

### Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Realtime) · framer-motion · canvas-confetti. Design system
neobrutalist: `ink #231f20`, `bright #fccb27`, `purple #8000ff`/`#4f03aa`,
`coral #ff803b`, `question-blue #c2e1ff`, bordi neri 2-4px, ombre hard
(`shadow-[4px_4px_0_#000]`), tipografia Open Sauce One.

### Struttura pagina (`src/app/page.tsx`)

`main` è il contenitore di scroll con snap (`AppShell`). Sezioni
`main > section` (via `SectionFrame` con `data-section`):

1. hero → 2. intro → 3. how-it-works → 4. play-again → 5. prize-location →
6. search → 7. success (condizionale, solo dopo voto) → 8. public-ranking
(sponsor) → 9. live-ranking → 10. contact.

⚠️ **Selettori posizionali** dei visual-audit: girano senza voto, quindi
success non è montata → `public-ranking` = `main > section:nth-child(7)` e
`live-ranking` = `nth-child(8)`. Se success è montata (post-voto), ogni
sezione successiva scala di +1 (`live-ranking` → `nth-child(9)`). Questo
design **non cambia l'ordine/DOM** delle sezioni, quindi i selettori degli
audit restano validi.

### Voto

`SearchSection` (§6): ricerca azienda (supabase `.ilike`), selezione di 3
aziende con pallet **4/2/1** ciascuna, Turnstile/BotD, `POST /api/vota` →
RPC `submit_vote` → `unlockGameStep('success')` → scroll alla
`SuccessSection`.

### Score

Punteggio azienda = somma pallet ricevuti (`total_pallets`). Ogni voto è una
`vote_sessions` con 3 aziende (company1=4, company2=2, company3=1).
`vote_count` = numero di sessioni in cui l'azienda compare.

### Rank

RPC `get_company_ranking(limit_count int)` (SQL in
`supabase/migrations/20260722000000_ranking_batch_filter.sql`):
`order by total_pallets desc` su tutte le aziende del batch attivo.
**Il rank è implicito (posizione in array), non c'è un campo `rank`.**
⚠️ **Nessun tie-breaker**: con `ORDER BY total_pallets desc` da solo, a parità
di punteggio l'ordine è non deterministico in Postgres.

### Fonte dati ranking

`GET /api/public/ranking` → RPC con `limit_count: null` (tutte le aziende del
batch attivo) → `{ companies: [{id, name, image_url, total_pallets, vote_count}] }`.

`LiveRankingSection` lo consuma: fetch al mount + **polling ogni 30s**.

### Realtime (oggi)

- Classifica pubblica: **polling 30s** di `/api/public/ranking`.
- La publication Supabase Realtime include già `vote_sessions`, `companies`,
  `site_settings`, `sponsors`, `batch_settings` — usata da admin e per il
  voting-flag. L'infrastruttura Realtime esiste ma non è usata per la
  classifica pubblica.

### Ricerca

`SearchSection`: query Supabase diretta, solo `id, name`, limit 4/50.
Serve al voto, non alla classifica. Non riusata nel ranking (decisione presa).

### Stato "ha votato"

`gameUnlock.success` in `VoteContext` (in-memory, resetta al reload).

### Responsive

Token fluidi (`--app-height`=100dvh, `--safe-*`, tipografia/spacing con clamp).
Gate strutturale P0 (`tests/e2e/responsive-structural.spec.ts`): 6 viewport ×
chromium+mobile-webkit, verifica zero micro-scroll / zero overflow / sezioni
dentro viewport. `LiveRankingSection` usa oggi una card con `max-h-[48svh]` e
scroll interno.

### Test esistenti (rilevanti)

- `tests/e2e/voting-flow.spec.ts` — flusso voto completo + overflow + WCAG.
- `tests/e2e/responsive-structural.spec.ts` — gate P0 strutturale.
- `tests/e2e/visual-audit-*.spec.ts` — screenshot sezioni (selettori
  `nth-child`).
- Unit: `success-section.test.tsx`, `prize-location-section.test.tsx`.
- Nessun test dedicato al ranking/cluster.

## 2. Valutazione di fattibilità

**Media.**

- La modifica è quasi tutta di presentazione: il backend restituisce già tutte
  le aziende con `total_pallets`/`vote_count`.
- Unico intervento backend: **tie-breaker deterministico** nella RPC
  `get_company_ranking` (migrazione SQL) + eventualmente l'esposizione del
  `rank` esplicito nel payload.
- Il lavoro principale è il refactor di `LiveRankingSection` in fasce
  collassabili + integrazione Realtime.
- Il vincolo più delicato è il **gate P0** (zero micro-scroll/overflow) con una
  card che può contenere fino a 333 righe: la card deve avere scroll interno
  esplicito (`overflow-y-auto`) come oggi, mai scroll di pagina accidentale.

## 3. Proposta UX

### Prima del voto

- La sezione ricerca (§6) è invariata (nessuna classifica lì).
- La classifica è raggiungibile scrollando alla sezione dedicata (§8).
  Nessun obbligo di votare per vederla. Nessun CTA intermedio: la sezione è una
  tappa normale dello scroll.

### Dopo il voto

- La `SuccessSection` mostra il risultato del voto (in lavorazione parallela,
  fuori scope).
- Quando l'utente arriva alla sezione ranking, le aziende votate sono
  evidenziate **nella loro fascia** (vedi §3.1). Nessun auto-scroll forzato.

### LIVE RANKING (sezione dedicata)

Una sola card: header "LIVE RANKING", poi la TOP 20 aperta, poi le fasce
chiuse con conteggio. Le fasce sono `<details>`-like (accordion nativo
accessibile) o controllate via stato React. **Nessuna CTA lead-gen.**

### TOP20/GOLD/SILVER/BRONZE

- TOP 20: rank + nome + punteggio (pallet). Medaglie 🥇🥈🥉 per le prime 3
  (come oggi).
- GOLD/SILVER/BRONZE: rank + nome, **senza punteggio**. Header con intervallo
  rank + conteggio aziende (es. `GOLD · 21-50 · 30`).

### 3.1 Più aziende votate nella stessa fascia

Un utente vota 3 aziende: più di una può cadere nella stessa fascia.
Regola degli indicatori (un solo badge, lato destro dell'header):

- **1 voto nella fascia** → `#37 MARAZZI` (posizione + nome, se il nome
  entra nel badge; altrimenti solo `#37`).
- **2+ voti nella fascia** → `2 · #37 #44` (conteggio + posizioni).
- **3+ voti (o viewport mobile stretta)** → `3 · i tuoi voti` (conteggio
  corto: le posizioni si vedono a fascia aperta, header mai affollato).

A fascia aperta ogni riga votata è evidenziata individualmente (sfondo viola
chiaro + badge `il tuo voto`); se sono 3 nella stessa fascia, tutte e 3 sono
evidenziate insieme. Fasce diverse con voti mostrano ognuna il proprio badge.

### Ricerca

Non presente nel ranking (per ora). L'utente può comunque trovare la posizione
di un'azienda solo scorrendo o cercandola nella sezione voto.

### Mobile

- Card a tutta larghezza (`content-max`), scroll interno esplicito
  (`overflow-y-auto no-scrollbar`) con altezza massima contenuta
  (`max-h-[60svh]` circa) per non creare micro-scroll di sezione.
- Header fascia e badge leggibili a basso contrasto ambientale (fiera):
  font-weight 900, dimensioni da token (`--fs-*`/clamp).
- Touch target dei trigger accordion ≥ 44px.
- Il badge header con 3+ voti si riduce a `3 · i tuoi voti` (mai affollato).

## 4. Proposta tecnica

### File modificati

- `supabase/migrations/<new>_ranking_tie_breaker.sql` — tie-breaker
  deterministico nella RPC `get_company_ranking` (SSOT ranking).
- `src/app/api/public/ranking/route.ts` — (opzionale) ritornare anche `rank`
  esplicito (1-based) e `cluster` calcolato lato server, oppure lasciare il
  calcolo al frontend (vedi §4.2).
- `src/components/sections/live-ranking-section.tsx` — refactor completo in
  fasce collassabili + Realtime channel su `vote_sessions`.
- `src/lib/ranking.ts` (nuovo) — helper puri: `getCluster(rank)`,
  `rankCompanies(companies)` (derivazione rank 1-based con tie-breaker),
  costanti fasce (`TOP20`, `GOLD`, `SILVER`, `BRONZE`), `CLUSTER_LABELS`.
- `src/i18n/dictionary.ts` + `it.ts` + `en.ts` — chiavi: titoli fasce, badge
  "il tuo voto", conteggi. **Nessuna chiave lead-gen.**
- `src/app/page.tsx` — invariato: la `LiveRankingSection` resta montata nella
  stessa posizione (9ª sezione, 8ª quando success non è montata).

### Componenti

- `RankingBand` (interno a `live-ranking-section.tsx` o file dedicato):
  header fascia + lista + stato aperto/chiuso + badge voto utente (regola
  §3.1: 1 voto → `#37 MARAZZI`; 2+ → `2 · #37 #44`; 3+/mobile → `3 · i tuoi
  voti`).
- `RankingRow` (interno): riga rank+nome(+punteggio se TOP20) + evidenziazione
  voto utente.

### API/endpoint

- `GET /api/public/ranking` — invariato (stesso payload). Se si sceglie il
  calcolo rank/cluster lato server, si aggiungono `rank` e `cluster` senza
  togliere nulla (additivo, non breaking).
- Nessun nuovo endpoint.

### Dati usati

- `id`, `name`, `image_url`, `total_pallets`, `vote_count` (esistenti).

### Dati NON toccati

- Nessun campo persistente `cluster` nel DB (derivato, deterministico).
- Nessuna modifica a `submit_vote`, `companies`, `vote_sessions`, `batch_settings`,
  `site_settings`. Nessuna modifica alla logica del voto/punteggio.

### 4.3 Realtime (architettura)

**INITIAL FETCH** → fetch di `/api/public/ranking` al mount (stato di carico
mostrato). Supabase Realtime è il meccanismo principale di aggiornamento.

1. **Channel Realtime** su `postgres_changes` (INSERT/UPDATE/DELETE) di
   `vote_sessions`. Su evento → refetch di `/api/public/ranking` e
   aggiornamento della UI (fasce + righe evidenziate si riconciliano con
   l'ultimo snapshot).
2. **Polling 30s = SOLO fallback**: attivo esclusivamente quando il canale
   Realtime non è connesso/disponibile (stato `SUBSCRIBED` non raggiunto,
   errore di connessione, sessione non supportata). Appena Realtime torna
   `SUBSCRIBED`, il polling viene **disattivato**.
3. **Visibilità sezione**: un `IntersectionObserver` sulla sezione (o il
   riuso di `use-active-section`) controlla il channel: quando la sezione non è
   visibile, il channel viene **sospeso** (rimozione/`removeChannel`) per
   risparmiare risorse; al rientro in viewport si ristabilisce il channel e si
   fa un refetch di sync. Il polling di fallback segue la stessa logica di
   visibilità (pausa fuori viewport).
4. **Debounce**: i refetch su eventi ravvicinati vengono coalescati (es.
   debounce ~500ms) per evitare raffiche di fetch durante il picco di voti in
   fiera.

### Cluster derivato

La catena è: `score → ordinamento (tie-breaker) → rank 1-based → cluster`.

Sia che si calcoli lato frontend (`getCluster(rank)` su array ordinato) sia
lato backend (campo `cluster` nel payload della RPC o della route), il cluster
è **una funzione deterministica del rank**, mai una colonna persistente.
Decisione consigliata: calcolo lato frontend in `src/lib/ranking.ts`, con la
route che ritorna `rank` esplicito per evitare di fidarsi dell'ordine dell'array
JSON. Il tie-breaker resta comunque nella RPC (SSOT dell'ordinamento).

## 5. Edge cases

- **0 voti**: ranking composta solo da aziende a 0 pallet; fasce piene di 0.
  La TOP 20 mostra 0 pallet; GOLD/SILVER/BRONZE non mostrano nulla. Testo empty
  esistente da riusare (`liveRanking.empty`).
- **Meno di 20 aziende con almeno un voto**: le fasce superiori restano definite
  dal rank (1-333), non dai voti: un'azienda a 0 pallet può essere in TOP20.
  Coerente con "rank su tutte le aziende".
- **Molte aziende con stesso punteggio**: il tie-breaker deterministico decide;
  il cluster segue il rank risultante.
- **Pareggio al confine 20/21**: con il tie-breaker la riga 20 e 21 sono
  totalmente ordinate → nessuna ambiguità TOP20/GOLD.
- **Pareggio 50/51 e 100/101**: idem con lo stesso tie-breaker.
- **Azienda votata che cambia cluster dopo il voto** (es. #19 → #21): la UI
  aggiorna l'evidenziazione: l'header della vecchia fascia perde il badge, la
  nuova fascia lo guadagna; la riga si sposta (animazione fluida opzionale,
  con `prefers-reduced-motion`).
- **Aggiornamenti realtime durante l'animazione**: aggiornare i dati prima di
  animare; le animazioni leggono l'ultimo snapshot (nessuna corsa di stato).
- **Ricerca di un'azienda Bronze**: non presente nel ranking (per ora) — la
  posizione si trova scorrendo/aprendo la fascia (casistica fuori scope).
- **Ranking vuota**: stato empty esistente (`liveRanking.empty`), nessun crash.
- **Dati temporaneamente non disponibili**: stato errore esistente
  (`liveRanking.error` + retry), invariato.

## 6. Strategia per i pareggi (importante)

**Stato attuale**: `get_company_ranking` ordina solo per `total_pallets desc`.
A parità di punteggio l'ordine relativo è **non deterministico** (Postgres non
garantisce l'ordine delle righe con chiave duplicata senza chiave secondaria).
Non esiste alcun tie-breaker.

**Regola proposta (deterministica, minima, senza nuove metriche)**:

```sql
order by total_pallets desc, name asc, id asc
```

- `total_pallets desc`: il punteggio (metrica esistente, invariata).
- `name asc`: ordine alfabetico stabile e predicibile per l'utente.
- `id asc`: ultima risorsa, UUID deterministica, rende l'ordine **totale**.

**NON si usa `vote_count` come tie-breaker**: il rank deriva esclusivamente da
`total_pallets` e, a parità, dall'ordinamento alfabetico. Il `vote_count` resta
un dato restituito dal payload ma non partecipa all'ordinamento.

Il **rank è una posizione assoluta 1–333**: non esistono pari merito ai fini
del rank. Ne derivano i cluster: TOP20 = 1-20, GOLD = 21-50, SILVER = 51-100,
BRONZE = 101-333. Ai confini (20/21, 50/51, 100/101) l'ordine è sempre
determinato e unico → nessuna ambiguità di fascia.

## 7. Impatto

- **Rischio regressioni**: medio-basso. La sezione cambia internamente ma resta
  `main > section` (8ª senza success, 9ª post-voto); i selettori dei
  visual-audit non cambiano (girano senza voto).
- **Rischio performance**: basso. Payload invariato; Realtime riduce i fetch
  periodici. Attenzione al rendering di 333 righe: virtualizzazione non
  necessaria se le fasce chiuse non renderizzano le righe (solo header).
- **Rischio realtime**: medio. Passare da polling a channel Supabase richiede
  gestione visibilità (pausa fuori viewport) e gestione errori (fallback
  polling se il channel non si connette).
- **Rischio UX**: basso se il gate P0 è rispettato (scroll interno card, mai
  scroll di sezione). Le fasce chiuse di default evitano la pagina infinita.
- **Accessibilità**: accordion accessibili (nativo `<details>` o `aria-expanded`
  + `aria-controls`), focus trap non necessaria, contrasto verificato (badge
  viola su bianco ≥ 4.5:1, testo bianco su viola ≥ 4.5:1), `prefers-reduced-motion`
  per le animazioni di spostamento.

## 8. Piano di implementazione

Ordine suggerito:

1. Migrazione SQL: tie-breaker (`total_pallets desc, name asc, id asc`) in
   `get_company_ranking` (+ eventuale campo `rank`/`cluster` nel payload, se
   si sceglie il calcolo server-side).
2. `src/lib/ranking.ts`: helper puri `getCluster`, `rankCompanies`,
   costanti fasce + unit test.
3. Refactor `LiveRankingSection`: card a fasce (TOP20 aperta, altre chiuse
   con conteggi), righe con/ senza punteggio, evidenziazione voto utente
   (regola §3.1 per più voti nella stessa fascia).
4. Integrazione Realtime (channel su `vote_sessions` come primario, polling
   30s come fallback, visibilità via IntersectionObserver).
5. i18n (it/en/dictionary).
6. Test (unit + e2e + audit).
7. Verifiche responsive/audit.

## 9. Test plan

### Automatici

- **Unit** (`tests/lib/ranking.test.ts`):
  - `getCluster(rank)` per i confini (1, 20, 21, 50, 51, 100, 101, 333, 0/negativo);
  - `rankCompanies` ordina con tie-breaker (`total_pallets desc`, poi
    `name asc`, poi `id asc`) e assegna rank 1-based univoco;
  - **pareggi ai confini** (20/21, 50/51, 100/101): aziende con lo stesso
    `total_pallets` ai confini → la fascia è decisa solo dal rank univoco
    (es. #20 in TOP20, #21 in GOLD; #50 in GOLD, #51 in SILVER; #100 in
    SILVER, #101 in BRONZE);
  - azienda con rank alto in fascia giusta.
- **Unit** (`tests/components/sections/live-ranking-section.test.tsx`):
  - render TOP20 con punteggi; GOLD/SILVER/BRONZE chiuse senza punteggi;
  - badge voto utente su header fascia chiusa + riga evidenziata;
  - **più voti nella stessa fascia**: 2 voti → `2 · #37 #44`; 3 voti →
    `3 · i tuoi voti`; a fascia aperta tutte le righe evidenziate;
  - **nessuna CTA lead-gen presente**.
- **Unit Realtime** (`tests/components/sections/live-ranking-realtime.test.tsx`):
  - initial fetch al mount;
  - evento `vote_sessions` → refetch;
  - channel non connesso → polling fallback attivo; quando `SUBSCRIBED` →
    polling disattivato;
  - fuori viewport → channel sospeso; rientro → ristabilito + refetch di sync.
- **E2E** (`tests/e2e/voting-flow.spec.ts` o nuovo spec):
  - dopo il voto, la sezione ranking mostra il badge dell'azienda votata
    (anche con più aziende nella stessa fascia);
  - fasce collassate/espandibili;
  - nessun overflow orizzontale/verticale su tutti i viewport del gate P0.
- **Audit**: `npm run visual:audit:homepage` + `:ios` (screenshot sezione
  ranking invariata come 8ª sezione, `nth-child(8)` senza voto).

### Manuali

- Verifica su tutti i viewport (mobile piccolo, mobile, tablet, desktop,
  wide) con ranking reale.
- Flusso post-voto: azienda in TOP20, in GOLD, in BRONZE; 2 o 3 aziende nella
  stessa fascia (header non affollato su mobile).
- Cambio fascia in tempo reale: azienda #19 → #21 mentre la sezione è aperta.
- Realtime con più dispositivi (due browser in parallelo); disconnessione
  rete → fallback polling attivo → riconnessione → polling disattivato.
- Test su iOS Safari (WebKit) con safe-area.

## 10. Mockup testuale

### Desktop (card larga ~600px)

```
┌───────────────────────────────────────────────┐
│                 🔥 LIVE RANKING               │
├───────────────────────────────────────────────┤
│ ██ TOP 20 · 1-20                              │
│  1  Ceramiche X           112                 │
│  2  Piastrelle Y   [il tuo voto]  98          │  ← riga evidenziata (viola chiaro)
│  3  Gres Z                  87                │
│  ⋮ fino a 20                                  │
├───────────────────────────────────────────────┤
│ ░ GOLD · 21-50 · 30         [2 · #37 #44] ▸   │  ← badge "2 voti + posizioni" se la fascia
│                                               │    contiene 2 tuoi voti (3+ → "3 · i tuoi voti")
├───────────────────────────────────────────────┤
│ ░ SILVER · 51-100 · 50                ▸        │
├───────────────────────────────────────────────┤
│ ░ BRONZE · 101-333 · 233   [#102 Gres Z] ▸    │  ← badge se la fascia contiene un tuo voto
└───────────────────────────────────────────────┘
        (scroll interno card)
```

### Mobile (card a tutta larghezza, scroll interno)

```
┌──────────────────────────────┐
│        🔥 LIVE RANKING       │
├──────────────────────────────┤
│ ██ TOP 20 · 1-20             │
│  1 Ceramiche X    112        │
│  2 Piastrelle Y    98        │   ← evidenziata se è un tuo voto
│  ⋮ fino a 20                 │
├──────────────────────────────┤
│ ░ GOLD · 21-50 · 30  3 · ▸   │   ← badge compatto "3 · i tuoi voti"
│                              │     (niente affollamento su mobile)
├──────────────────────────────┤
│ ░ SILVER · 51-100 · 50   ▸   │
├──────────────────────────────┤
│ ░ BRONZE · 101-333 · 233 ▸   │
└──────────────────────────────┘
        (scroll interno card)
```

## 11. Post-Cersaie / lead-gen — FUORI SCOPO

La CTA "Request full ranking" **non fa parte di questo lavoro**: nessun
componente, endpoint o chiave i18n. Il design attuale lascia libero il footer
della card (nessun elemento aggiuntivo), quindi un'eventuale CTA futura potrà
essere aggiunta senza refactoring. L'architettura esistente (form contatto
`/api/contact`) offre già un canale per una futura raccolta lead, ma non viene
toccata.

## Note operative

- Il cluster è derivato, mai persistito: nessuna migrazione dati oltre al
  tie-breaker (che è solo un `order by`).
- Rispettare il gate P0: card con `overflow-y-auto` esplicito, mai
  `overflow: hidden` per nascondere contenuto.
- Aggiornare i selettori posizionali dei visual-audit solo se il DOM delle
  sezioni cambia davvero (in questo design non cambia).