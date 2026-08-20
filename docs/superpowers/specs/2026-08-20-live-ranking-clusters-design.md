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
   Se una fascia chiusa contiene un'azienda votata dall'utente, l'header mostra
   un badge compatto `#37 MARAZZI`; all'apertura la riga è evidenziata
   (sfondo viola chiaro + badge "il tuo voto").
5. **CTA "richiedi la classifica completa"** in fondo alla card: invito
   lead-gen post-Cersaie. **Non implementata ora** — il punto 10 analizza dove
   andrà e quali dati serviranno.
6. **Tie-breaker deterministico** da aggiungere all'ordinamento (vedi §6).
7. **Realtime da implementare**: sostituire il polling 30s con il canale
   Supabase Realtime su `vote_sessions` (già presente nella publication).
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
  evidenziate **nella loro fascia**: badge compatto sull'header della fascia
  chiusa (`#37 MARAZZI`) e riga evidenziata (sfondo viola chiaro + badge
  "il tuo voto") all'apertura. Nessun auto-scroll forzato.

### LIVE RANKING (sezione dedicata)

Una sola card: header "LIVE RANKING", poi la TOP 20 aperta, poi le fasce
chiuse con conteggio, poi la CTA lead-gen. Le fasce sono `<details>`-like
(accordion nativo accessibile) o controllate via stato React.

### TOP20/GOLD/SILVER/BRONZE

- TOP 20: rank + nome + punteggio (pallet). Medaglie 🥇🥈🥉 per le prime 3
  (come oggi).
- GOLD/SILVER/BRONZE: rank + nome, **senza punteggio**. Header con intervallo
  rank + conteggio aziende (es. `GOLD · 21-50 · 30`).

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
  "il tuo voto", conteggi, CTA lead-gen.
- `src/app/page.tsx` — invariato: la `LiveRankingSection` resta montata nella
  stessa posizione (9ª sezione, 8ª quando success non è montata).

### Componenti

- `RankingBand` (interno a `live-ranking-section.tsx` o file dedicato):
  header fascia + lista + stato aperto/chiuso + badge voto utente.
- `RankingRow` (interno): riga rank+nome(+punteggio se TOP20) + evidenziazione
  voto utente.
- `RequestFullRankingCTA` (interno): card CTA lead-gen (render condizionale,
  **disattivata di default** finché non esiste il backend lead-gen).

### API/endpoint

- `GET /api/public/ranking` — invariato (stesso payload). Se si sceglie il
  calcolo rank/cluster lato server, si aggiungono `rank` e `cluster` senza
  togliere nulla (additivo, non breaking).
- Nessun nuovo endpoint.
- Realtime: nuovo channel Supabase (client) su
  `postgres_changes` INSERT/UPDATE/DELETE su `vote_sessions` → refetch del
  ranking (o aggiornamento incrementale) quando la sezione è visibile.

### Dati usati

- `id`, `name`, `image_url`, `total_pallets`, `vote_count` (esistenti).

### Dati NON toccati

- Nessun campo persistente `cluster` nel DB (derivato, deterministico).
- Nessuna modifica a `submit_vote`, `companies`, `vote_sessions`, `batch_settings`,
  `site_settings`. Nessuna modifica alla logica del voto/punteggio.

### Realtime

- Mantenere il polling come fallback/sync iniziale; attivare il channel
  Realtime quando la sezione è in viewport (o sempre, con `refetch` su evento).
- Su evento `vote_sessions` → refetch di `/api/public/ranking` e aggiornamento
  delle fasce con transizione coerente (posizione/fascia delle righe già
  evidenziate).
- Pausare il channel quando la sezione è fuori viewport (risparmio risorse) —
  riutilizzare `IntersectionObserver` già presente in `use-active-section` o
  un observer dedicato.

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

**Regola proposta (deterministica, minima)**:

```sql
order by total_pallets desc, vote_count desc, name asc, id asc
```

- `vote_count desc`: chi ha più sessioni di voto (più "consenso diffuso") sale.
- `name asc`: ordine alfabetico stabile e predicibile per l'utente.
- `id asc`: ultima risorsa, UUID deterministica, rende l'ordine totale.

Questa regola è **deterministica e totale** (nessun pareggio possibile),
riutilizza dati già calcolati dalla RPC (`vote_count`) e non cambia la logica
del punteggio. Il rank 1-based deriva da questo ordinamento.

Nessuna nuova regola arbitraria: si formalizza l'unico punto di ordinamento
(la RPC) così da evitare ambiguità ai confini di fascia (20/21, 50/51, 100/101).

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

1. Migrazione SQL: tie-breaker in `get_company_ranking` (+ eventuale campo
   `rank`/`cluster` nel payload, se si sceglie il calcolo server-side).
2. `src/lib/ranking.ts`: helper puri `getCluster`, `rankCompanies`,
   costanti fasce + unit test.
3. Refactor `LiveRankingSection`: card a fasce (TOP20 aperta, altre chiuse
   con conteggi), righe con/ senza punteggio, evidenziazione voto utente.
4. Integrazione Realtime (channel su `vote_sessions`) con gestione visibilità
   e fallback polling.
5. CTA lead-gen (render condizionale, disattivata di default).
6. i18n (it/en/dictionary).
7. Test (unit + e2e + audit).
8. Verifiche responsive/audit.

## 9. Test plan

### Automatici

- **Unit** (`tests/lib/ranking.test.ts`):
  - `getCluster(rank)` per i confini (1, 20, 21, 50, 51, 100, 101, 333, 0/negativo);
  - `rankCompanies` ordina con tie-breaker (punteggio, poi vote_count, poi
    name, poi id) e assegna rank 1-based;
  - pareggi ai confini (20/21, 50/51, 100/101) risolti deterministicamente;
  - azienda con rank alto in fascia giusta.
- **Unit** (`tests/components/sections/live-ranking-section.test.tsx`):
  - render TOP20 con punteggi; GOLD/SILVER/BRONZE chiuse senza punteggi;
  - badge voto utente su header fascia chiusa + riga evidenziata;
  - CTA lead-gen assente di default.
- **E2E** (`tests/e2e/voting-flow.spec.ts` o nuovo spec):
  - dopo il voto, la sezione ranking mostra il badge dell'azienda votata;
  - fasce collassate/espandibili;
  - nessun overflow orizzontale/verticale su tutti i viewport del gate P0.
- **Audit**: `npm run visual:audit:homepage` + `:ios` (screenshot sezione
  ranking invariata come 8ª sezione, `nth-child(8)` senza voto).

### Manuali

- Verifica su tutti i viewport (mobile piccolo, mobile, tablet, desktop,
  wide) con ranking reale.
- Flusso post-voto: azienda in TOP20, in GOLD, in BRONZE.
- Cambio fascia in tempo reale: azienda #19 → #21 mentre la sezione è aperta.
- Realtime con più dispositivi (due browser in parallelo).
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
│ ░ GOLD · 21-50 · 30         [#37 MARAZZI] ▸   │  ← badge se la fascia contiene un tuo voto
├───────────────────────────────────────────────┤
│ ░ SILVER · 51-100 · 50                ▸        │
├───────────────────────────────────────────────┤
│ ░ BRONZE · 101-333 · 233   [#102 Gres Z] ▸    │  ← badge se la fascia contiene un tuo voto
├───────────────────────────────────────────────┤
│ 📩 Dopo Cersaie — la classifica completa      │
│ (333 aziende con punteggi) sarà disponibile   │
│ su richiesta.            [richiedi la        │
│                          classifica completa] │
└───────────────────────────────────────────────┘
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
│ ░ GOLD · 21-50 · 30   #37 ▸  │   ← badge "#37 MARAZZI" se tuo voto
├──────────────────────────────┤
│ ░ SILVER · 51-100 · 50   ▸   │
├──────────────────────────────┤
│ ░ BRONZE · 101-333 · 233 ▸   │
├──────────────────────────────┤
│ 📩 Dopo Cersaie              │
│ [richiedi la classifica      │
│  completa]                   │
└──────────────────────────────┘
        (scroll interno card)
```

## 11. Post-Cersaie / lead-gen (analisi, non implementazione)

L'architettura attuale permette di aggiungere una CTA "Request full ranking"
senza refactoring: esiste già `/api/contact` (form contatto con nome+email)
che può ospitare l'invio della richiesta (oggetto "richiesta classifica
completa" + messaggio). La CTA verrebbe inserita nel footer della card
ranking (come da mockup) e attivata **solo dopo l'evento** (config o flag).

Dati che servirebbero: nome, email, eventuale azienda di interesse. Nessun
nuovo endpoint richiesto ora; eventualmente un endpoint dedicato
`/api/lead/ranking` quando la feature diventa attiva. Non si crea alcun
sistema di raccolta email nel frattempo.

## Note operative

- Il cluster è derivato, mai persistito: nessuna migrazione dati oltre al
  tie-breaker (che è solo un `order by`).
- Rispettare il gate P0: card con `overflow-y-auto` esplicito, mai
  `overflow: hidden` per nascondere contenuto.
- Aggiornare i selettori posizionali dei visual-audit solo se il DOM delle
  sezioni cambia davvero (in questo design non cambia).