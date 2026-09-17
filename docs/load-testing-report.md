# Report load test — campagna 2026-09-17

Simulazione di carico su database reale non-production (`fantacer-e2e`) per
misurare performance, picchi e punto di rottura in vista di una sessione di
fiera (~500 utenti concorrenti attesi). Runbook operativo: [`docs/load-testing.md`](load-testing.md).

## Sintesi (per il capo progetto)

La campagna ha trovato **due problemi**, entrambi risolti, e **un limite residuo**.

1. **Classifica lenta (risolto).** La pagina classifica ricalcolava *tutti* i voti
   a ogni aggiornamento. A 500 utenti concorrenti saturava il database e faceva
   andare in timeout `tutto` il sito (17,4% di richieste fallite, latenze fino a
   60s). Ora la classifica legge valori precalcolati: **~1.450 ms → ~1,9 ms** di
   esecuzione DB per chiamata (**~780×**).
2. **DNS lento (risolto).** Un server DNS non raggiungibile in `/etc/resolv.conf`
   faceva attendere ~5s a ogni nuova connessione, falsando le misure. Corretto su
   portatile e server (ora 19–34 ms).
3. **Limite Realtime (residuo).** La classifica "in diretta" dipende dal servizio
   Realtime di Supabase. Il piano **Free consente ~200 connessioni simultanee**;
   con ~500 visitatori oltre il tetto la classifica non è più istantanea (si
   aggiorna ogni 30s) ma **resta corretta**. Serve **Supabase Pro** (~500
   connessioni) o una riduzione degli abbonamenti lato client.

**Risultato**: HTTP e database reggono **500 utenti concorrenti con p95 < 180 ms e
0 errori**, anche su un server self-hosted di casa a 2 core. L'unico punto da
coprire per la fiera è il Realtime.

---

## Metodo

- **Target**: `fantacer-e2e` (mai production). Le scritture sono limitate ai
  namespace `seed-loadtest-%` / `loadtest-%`.
- **Sorgente aziende**: production, solo in lettura (batch `cersaie_14092026`,
  312 aziende).
- **Dati sintetici**: 100.000 `vote_sessions` (nessuna PII).
- **Generatore**: k6 HTTP/WebSocket dal portatile in LAN.
- **App sotto test**: container Docker (`next start`) su server 2 core / 8 GB.
- **Monitoraggio**: sampler DB automatico (`load:run`) + `pg_stat_statements`;
  docker stats sotto carico; **preflight DNS**.

---

## 1. Baseline pre-fix (500 VU)

Run `baseline-20260917-145859` (14,5 min, rampa 0→500):

| Metrica | Valore |
|---|---|
| Error rate | **17,4%** (1.640 timeout) |
| Latenza media / p95 | **26.127 ms / 60.001 ms** (timeout k6) |
| Rollback DB | 3.470 |
| Classifica (DB) | **2.296 ms/chiamata** (3.558 chiamate) |
| Index scan su `vote_sessions` | 3.330.696 (**~936/chiamata**) |
| Lock / deadlock | 0 / 0 |

La latenza cresceva in modo continuo dalla rampa e non recuperava: saturazione.

## 2. Diagnosi

**Classifica O(n).** `EXPLAIN (ANALYZE)` della RPC:

```
Nested Loop Left Join  rows=301248  Buffers: shared hit=242070  time=1410ms
  -> Index Scan companies (312, filter batch)
  -> BitmapOr su idx_vote_sessions_company1/2/3   (312 loops)
```

Ogni chiamata leggeva ~301k righe e toccava ~242k buffer (CPU, non I/O), costo
che **cresce col numero di voti**. Con polling/realtime (~14 chiamate/s a 500 VU)
il percorso DB si saturava: l'heartbeat (1,5 ms di esecuzione) restava in coda
dietro la classifica → timeout su tutti gli endpoint.

**DNS.** `time_namelookup` = 5,03s (a volte 10,04s) per richiesta; `1.1.1.1`
irraggiungibile (timeout 6s), fallback a `8.8.8.8` (13–20 ms). Ogni nuova
connessione app→Supabase pagava il timeout. Questo ha **amplificato** il primo
baseline e reso inattendibili le misure end-to-end.

## 3. Fix applicati

### 3a. Classifica O(1) — migration `20260917000000_company_totals_ranking.sql`

- Tabella `company_totals(company_id PK → companies ON DELETE CASCADE, total_pallets, vote_count)`.
- Trigger **dedicato** `trg_maintain_company_totals` (separato da `trg_bump_ranking_tick`),
  che aggiorna i contatori con lock-ordering (anti-deadlock).
- `recompute_company_totals()` per bulk/drift.
- `get_company_ranking` legge i contatori e ordina con tie-breaker
  `total_pallets desc, name asc, id asc`.
- Backfill atomico in una transazione con `lock table vote_sessions`.

Esito: esecuzione DB **1,86 ms** (era ~1.450 ms); a 500 VU il delta
`pg_stat_statements` è stato **1,7 ms/chiamata** su 12.150 chiamate.

### 3b. DNS

Corretto `/etc/resolv.conf` su portatile e server (`nameserver 8.8.8.8` /
`8.8.4.4`). Preflight obbligatorio documentato nel runbook.

## 4. Baseline post-fix

| Run | VU | Errori | avg | p95 | p99 | Threshold |
|---|---|---|---|---|---|---|
| baseline 16:21 | 100 | 0% | 128 ms | 260 ms | 295 ms | ✅ |
| baseline 16:24 | 200 | 0% | 121 ms | 251 ms | 310 ms | ✅ |
| baseline 16:27 | 300 | 0% | 126 ms | 265 ms | 315 ms | ✅ |
| **baseline 16:31** | **500** | **0%** | **117 ms** | **177 ms** | **268 ms** | ✅ |

Run a 500 VU (866 s, 25.301 richieste) — endpoint p95: **vote 302 ms**,
**heartbeat 157 ms**, **ranking 159 ms**. DB: picco 21 connessioni, **0 lock,
0 query >2s, 0 rollback**.

## 5. Risorse server (docker stats sotto carico)

| Indicatore | Valore | Lettura |
|---|---|---|
| CPU container | picco **~89% di un core** (quota 1,5) | mai saturo |
| RAM | 358 → **455 MB** / 2,5 GB (~18%) | ampio margine |
| PIDS | 24 costanti | nessun leak |
| Egress | ~968 MB (sessione completa) | ~1 GB/run da monitorare su Free (5 GB/mese) |

**Il server di casa a 2 core non è il collo di bottiglia.**

## 6. Realtime (limite Free ~200 connessioni)

| Connessioni | connect success | join success | ws_connecting p95 | esito |
|---|---|---|---|---|
| **150** | **100%** | **100%** | 226 ms | ✅ tutte le threshold |
| **250** | **40,0%** | **39,6%** | 2.194 ms | ❌ (515 handshake falliti su 858) |
| 500 (run interrotto) | ~6% | ~8% | ~18.000 ms | ❌ |

Il punto di rottura è **tra 150 e 250**, coerente con il cap di ~200 connessioni
del piano Free. Il DB resta ininfluente (0 lock, 0 rollback).

**Nota importante sull'app**: una singola scheda apre **1 sola connessione
Realtime**, indipendentemente da quanti componenti si sottoscrivono.
`@supabase/ssr` (v0.10.2) rende `createBrowserClient` un **singleton nel browser**
(`node_modules/@supabase/ssr/dist/main/createBrowserClient.js:9,54`), quindi le
chiamate in `live-ranking-section.tsx` (canale classifica + canale flag voto) e in
`search-section.tsx` condividono lo **stesso** client → **una sola WebSocket**. I
canali sono multiplexati sulla stessa connessione (Supabase: fino a 100 canali per
connessione). Quindi il tetto di ~200 connessioni vale ~**200 schede/visitatori**
con la pagina aperta (anche in background), non ~100.

Cosa succede oltre il tetto: la classifica **continua a funzionare** e resta
corretta, ma per i client non collegati si aggiorna **ogni 30 s** (fallback di
polling) invece che in tempo reale; il cambio "voto on/off" dell'admin non arriva
istantaneo. Nessun voto perso, nessun crash.

## 7. Conclusioni

1. **HTTP/DB**: sistema validato a 500 concorrenti, p95 < 180 ms, 0 errori, anche
   su hardware modesto. Il fix `company_totals` è la chiave.
2. **Realtime**: unico limite strutturale per la fiera. Serve `Supabase Pro`
   (500 connessioni) o mitigazioni lato client.
3. **DNS**: causa esterna che falsava le misure; ora nel preflight.

## 8. Raccomandazioni

- **Fiera**: piano **Supabase Pro** (Realtime 500+). Costo indicativo ~25 $/mese
  (verificare listino attuale). Nessuna modifica di codice necessaria.
- **A costo zero (alternative/rinforzo)**:
  - usare **un solo client Supabase per pagina** (una connessione invece di due)
    → raddoppia il tetto effettivo (~200 visitatori);
  - **polling mirato**: con la classifica O(1), un aggiornamento ogni 10–15 s per
    tutti è sostenibile; perde l'effetto "live" ma elimina il tetto.
- **Rollout in produzione** della migration (vedi sotto).

## 9. Rollout in produzione

Applicare con il flusso normale (`supabase db push`) in **finestra a basso
traffico**:

1. `20260917000000_company_totals_ranking.sql` — **richiesta**: crea
   `company_totals`, i trigger, `recompute`, e sostituisce `get_company_ranking`.
   La migration prende un `lock` breve su `vote_sessions` durante il backfill dei
   voti esistenti. **Backup** prima (`scripts/loadtest/db-snapshot.mjs` è e2e-only;
   per prod usare lo snapshot Supabase/pg_dump) e **canary** dopo.
2. `20260917000001_vote_sessions_fingerprint_pattern_index.sql` — **opzionale in
   produzione** (nessun delete per prefisso in prod; l'indice è piccolo e
   innocuo). Si applica comunque insieme, essendo nello stesso set di migration.

**Rollback**: `scripts/loadtest/sql/rollback_company_totals.sql` (drop trigger/
funzioni/tabella + ripristino RPC precedente). Non tocca `trg_bump_ranking_tick`.

## 10. Limiti e note

- Server **self-hosted 2 core**: non copre Vercel (cold start, autoscaling).
- **Turnstile** bypassato e **FingerprintJS** esercitato solo dal mini-run browser.
- Rete **LAN ~0 ms**: non misura la latenza utente reale (quella verso il DB
  remoto sì).
- Realtime: il run a 500 è stato interrotto; 150/250 completi.
- `http_req_failed` di k6 conta i **409** (dedup voto) come errori: usare **RUN_ID
  distinti** per run (o `expectedStatuses(200,409)`) evita falsi positivi.

## 11. Artefatti

- Script: `scripts/loadtest/{lib,seed,cleanup,db-snapshot,run-scenario}.mjs`,
  `scripts/loadtest/sql/{trigger,rollback_company_totals}.sql`.
- Suite k6: `tests/load/{config,lib,scenarios}`; mini-run: `tests/load/browser`.
- Migration: `supabase/migrations/20260917000000_company_totals_ranking.sql`,
  `20260917000001_vote_sessions_fingerprint_pattern_index.sql`.
- Report grezzi: `loadtest-output/<scenario>-<ts>/` (gitignored).
- Commit: `acfefc6` (classifica O(1)), `a6cd157` (preflight DNS), `51cdc2e`
  (realtime configurabile), e il commit di questo report.
