# Load test fiera (k6 + Playwright)

Simulazione di carico su database reale non-production (`fantacer-e2e`) per
misurare performance, picchi e punto di rottura durante una sessione di fiera
(~500 utenti concorrenti attesi).

## Target e vincoli

- **Write target**: `fantacer-e2e` (mai production). Le scritture sono limitate
  al namespace `seed-loadtest-%` (seed) e `loadtest-%` (carico + heartbeat).
- **Source aziende**: production, **solo in lettura** (`.env`), batch attivo
  (`cersaie_14092026`). `image_url` viene azzerato per non caricare asset dal
  bucket storage di production.
- **Isolamento**: e2e e' condiviso con le suite E2E. L'isolamento e'
  **procedurale**: finestra esclusiva + cleanup obbligatorio. Vedi "Guardrail".

## Prerequisiti

- k6 installato sulla macchina generatrice (portatile in LAN).
- Docker sul server che ospita l'app.
- `.env` (production, read-only) e `.env.e2e` presenti in repo root.
- `.env.load` (gitignored) per l'env runtime dell'app, da `.env.load.example`.

### Preflight rete (DNS) — obbligatorio

Un DNS lento **falsa ogni misura**: ogni nuova connessione (app -> Supabase) paga
il timeout del resolver, gonfiando latenze e timeout ben oltre il DB.

```bash
getent hosts <e2e-ref>.supabase.co          # deve rispondere subito (< 50ms)
curl -s -o /dev/null -w 'dns=%{time_namelookup}\n' https://<e2e-ref>.supabase.co
```

Se compare un valore in **secondi**, il resolver e' lento (tipico: un nameserver
non raggiungibile in `/etc/resolv.conf`, es. `1.1.1.1`, che va in timeout prima
del fallback). Verificare i resolver:

```bash
node -e 'const d=require("dns").promises,t=Date.now();d.lookup("www.google.com").then(()=>console.log((Date.now()-t)+"ms"))'
```

Correggere **su portatile e server app** (es. solo `nameserver 8.8.8.8` /
`8.8.4.4`) prima di lanciare i test, altrimenti i risultati non sono attendibili.

## 1. Seed

```bash
npm run loadtest:seed                 # 100k voti sul batch attivo di prod
npm run loadtest:seed -- --votes=50000 --run-id=lt01
```

Cosa fa:

1. legge `active_batch` e le aziende da production (solo lettura);
2. le importa in e2e con `image_url = null`;
3. genera i `vote_sessions` sintetici `seed-loadtest-*`;
4. imposta `batch_settings.active_batch` al batch importato e salva lo stato in
   `.loadtest/state.json`.

Al termine stampa il `RUN_ID` da usare nei test k6.

> **Trigger su `vote_sessions`**: ogni insert/delete aggiorna `ranking_tick`
> (realtime) **e** `company_totals` (classifica). Per il seed da 100k righe e'
> accettabile ma lento; per velocizzare si puo' usare
> `scripts/loadtest/sql/trigger.sql` (disable/enable dall'SQL Editor di Supabase)
> e poi **ricalcolare** con `select public.recompute_company_totals()`. Riabilitare
> sempre entrambi i trigger a fine operazione.

### Classifica O(1) — `company_totals`

`get_company_ranking` aggregava tutte le `vote_sessions` a ogni chiamata
(301k righe / 242k buffer a 100k voti, ~1,45 s): con polling/realtime saturava il
percorso DB. La migration `20260917000000_company_totals_ranking.sql` introduce
`company_totals` (pallet pesati 4/2/1 + conteggio sessioni) mantenuta dal trigger
dedicato `trg_maintain_company_totals`, **separato** da `trg_bump_ranking_tick`.
La lettura e' passata a **~1,9 ms di esecuzione DB** (da ~1.450 ms).

- `recompute_company_totals()`: ricalcolo completo (bulk/drift), eseguibile solo
  da `service_role`; la chiamano `loadtest:seed` e `loadtest:cleanup`.
- Rollback manuale: `scripts/loadtest/sql/rollback_company_totals.sql`.
- Snapshot di sicurezza: `node scripts/loadtest/db-snapshot.mjs` →
  `backups/e2e-<ts>.json` (read-only, tutte le tabelle `public`).

## 2. App sotto test (Docker sul server)

Build con le env di e2e come build-arg (`NEXT_PUBLIC_*` sono inlined):

```bash
docker build --memory=3g \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$E2E_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$E2E_ANON" \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  -t fantacer-app:loadtest .
```

Run (limiti risorse sul server 2c/8GB):

```bash
docker run -d --name fantacer-app --restart unless-stopped \
  --cpus=1.5 --memory=2560m --memory-swap=3072m \
  -p 3000:3000 --env-file .env.load \
  fantacer-app:loadtest
```

`TURNSTILE_SECRET_KEY` resta assente: il server bypassa la verifica Turnstile.

## 3. Mini-run browser reali

Valida i path che k6 non esegue (FingerprintJS, heartbeat, polling,
IntersectionObserver, voto via UI):

```bash
LOAD_BASE_URL=http://<IP-SERVER>:3000 npm run load:browser
```

`LOAD_BROWSER_SESSIONS` (default 5) controlla il numero di contesti concorrenti.

## 4. Scenari k6

Tutti dal portatile, in LAN:

```bash
export BASE_URL=http://<IP-SERVER>:3000
export RUN_ID=<run-id-stampato-dal-seed>

npm run load:smoke       # 1m, 3 VU: correttezza script/dedup
npm run load:baseline    # rampa 0->500 in 3m, hold 10m
npm run load:spike       # raffica di voto 5 -> 50 req/s
npm run load:soak        # 250 VU per 30m
npm run load:realtime    # 0->500 connessioni WebSocket
```

Parametri via env (es. `VUS`, `PEAK`, `DURATION`, `SLEEP_MS`). Realtime richiede
in piu':

```bash
SUPABASE_ANON_KEY=<e2e-anon> \
REALTIME_URL=wss://<e2e-ref>.supabase.co/realtime/v1/websocket \
VUS=250 RAMP=30s HOLD=30s DOWN=10s HOLD_SECONDS=30 \
npm run load:realtime
```

Lo scenario realtime e' configurabile: `RAMP`/`HOLD`/`DOWN` (default `1m`/`5m`/`30s`),
`HOLD_SECONDS` (durata connessione per VU, default 300), `FAIL_BACKOFF_S`
(pausa dopo un tentativo fallito, default 1s). Con i valori qui sopra dura
~1,5 min, sufficiente perche' il cap di connessioni si manifesta durante la rampa.

Metriche utili: `realtime_connect_success` / `realtime_join_success` (Rate, devono
restare > 0.95), `realtime_join_ok` / `realtime_connect_failures` /
`realtime_join_failures` (Counter), `ws_connecting` (p95). Su piano Free il cap e'
~200 connessioni: oltre, le Rate crollano e `ws_connecting` sale.

## 4b. Monitoraggio DB automatico (`load:run`)

Invece dei comandi `load:*` semplici, usa il wrapper: avvia da sé un sampler DB
leggero, esegue k6 e produce un report con i delta DB allineati al run.

```bash
npm run load:run -- smoke
npm run load:run -- baseline
npm run load:run -- spike
npm run load:run -- soak
```

Per ogni run crea `loadtest-output/<scenario>-<ts>/` con:

| File | Contenuto |
|---|---|
| `db.ndjson` | campioni ogni 10s: connessioni per stato, lock bloccati, query >2s, transazioni, cache, temp, WAL, insert/seq-scan per tabella |
| `pgss-before.json` / `pgss-after.json` | snapshot `pg_stat_statements` per il delta della finestra |
| `k6.csv` / `k6-summary.json` | serie temporali e summary k6 |
| `summary.md` | report leggibile (sotto) |

Il report `summary.md` contiene: richieste/errori/p95/p99 k6 per endpoint, picco
connessioni e lock, delta transazioni/cache/WAL, delta per tabella e **top query
per tempo DB nella finestra** (da `pg_stat_statements`).

Il sampler e' **read-only** e si connette direttamente a Postgres via session
pooler (`aws-1-eu-west-1.pooler.supabase.com:5432`), **non** via PostgREST: non
consuma gli slot del pooler applicativo e non falsa le metriche dell'app.
Override connessione: `LOADTEST_DB_URL`. Intervallo: `SAMPLE_MS` (default 10000).

## SLO di riferimento (da calibrare sul baseline)

| Endpoint | p95 | Error |
|---|---|---|
| `POST /api/vota` | < 800 ms | < 1% |
| `POST /api/presence/heartbeat` | < 300 ms | < 1% |
| `GET /api/public/ranking` | < 800 ms | < 1% |
| `GET /` (page load) | < 1200 ms | < 1% |

Le threshold sono in `tests/load/config.js` e fanno fallire il run se violate.
La soglia ranking (800 ms) e' calibrata sulla baseline; **dopo** la migration
`company_totals` (classifica O(1)) il p95 reale e' ~120-160 ms.

## Report della campagna

I risultati completi (baseline prima/dopo, realtime, conclusioni, rollout in
produzione) sono in [`docs/load-testing-report.md`](load-testing-report.md).

## Osservabilita'

- k6: `http_req_duration` p95/p99, `http_req_failed`, RPS, metriche `ws_*`.
- Report automatico: `loadtest-output/<scenario>-<ts>/summary.md` (vedi 4b).
- Supabase Dashboard: Reports DB (CPU, connessioni, IOPS) e Realtime (client,
  messaggi/s).
- SQL: `pg_stat_activity`, `pg_stat_statements`.
- Post-run: `supabase inspect db outliers --project-ref ookipybsnjtvdrzqzpsl`.

## 5. Cleanup (obbligatorio)

```bash
npm run loadtest:cleanup                  # rimuove voti/company e ripristina active_batch
npm run loadtest:cleanup -- --keep-companies
```

Rimuove `seed-loadtest-%`, `loadtest-%` da `vote_sessions`/`audit_logs`/
`device_sessions`, cancella le company importate e ripristina `active_batch`
(il valore precedente salvato dallo seed). Svuota `.loadtest/state.json`.

Il cleanup usa una **connessione diretta a Postgres** (`pg`, ruolo `postgres`),
**non** PostgREST: le operazioni massive superano lo `statement_timeout` di 8s del
ruolo `authenticator` usato da PostgREST. In una **singola transazione**:

- `set local statement_timeout = 0`;
- **disabilita i due trigger** su `vote_sessions` (evita 100k x trigger per riga)
  e li **riabilita** prima del ricalcolo; in caso di errore il `rollback` ripristina
  anche lo stato dei trigger;
- cancella per prefisso da `vote_sessions`/`audit_logs`/`device_sessions` e le
  company del batch (salvo `--keep-companies`);
- `select public.recompute_company_totals()` per allineare i contatori;
- ripristina `batch_settings.active_batch`.

L'indice `idx_vote_sessions_fingerprint_pattern` (`fingerprint text_pattern_ops`,
migration `20260917000001`) rende usabile l'indice per i `LIKE 'prefisso%'`
selettivi (per prefissi quasi totali come `seed-loadtest-%` la Seq Scan resta
comunque la scelta ottimale).

La migration `20260918000000_atomic_vote_dedup.sql` (colonna generata `vote_day`
UTC + indice unico `(fingerprint, vote_day)`) è **applicata a e2e** e **pendente
su production**. Non rompe seed/load: i fingerprint sintetici sono unici
(`seed-loadtest-<n>`, `loadtest-<runid>-*`), quindi l'indice non blocca gli
insert; i 409 del dedup restano attesi e vanno conteggiati a parte in k6.

## Guardrail

- **Finestra esclusiva**: nessun run E2E/CI/visual audit durante un load test.
- Un run k6 alla volta; nessuna build durante i test.
- Stop se error rate > 5% o CPU DB > 80%.
- Cleanup **sempre**, anche in caso di errore (i dati di load contaminano gli E2E).

## Limiti dichiarati (da riportare nel report)

- Server 2 core: il picco puo' essere CPU-bound sull'app, non sul DB.
- Piano Free: Realtime limitato a 200 connessioni, quindi il muro a 500 e' atteso.
- Turnstile bypassato e FingerprintJS non esercitato da k6 (solo dal mini-run).
- Rete LAN ~0ms: non misura la latenza utente reale (quella verso il DB remoto si').
- Deployment self-hosted: non copre Vercel (cold start, autoscaling).
