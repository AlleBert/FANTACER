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

> **Trigger `ranking_tick`**: ogni insert/delete su `vote_sessions` bumpa
> `ranking_tick`. Per il seed da 100k righe e' accettabile ma lento; per
> velocizzare si puo' usare `scripts/loadtest/sql/trigger.sql` (disable/enable
> dall'SQL Editor di Supabase). **Riabilitare sempre** il trigger a fine operazione.

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
npm run load:realtime
```

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
La soglia ranking (800 ms) e' calibrata sulla baseline osservata su 100k righe
(~640-690 ms p95); resta un endpoint lento, il fix e' un task separato.

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
