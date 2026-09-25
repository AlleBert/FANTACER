# Runbook di rilascio — Fine Sicurezza Voto (P0-4 + P1)

> **Documento SOLO documentale. Non autorizza operazioni in produzione.**
> Nessun comando di questo runbook va eseguito senza autorizzazione esplicita,
> finestra concordata e snapshot di sicurezza. Le operazioni su produzione
> richiedono sempre un operatore umano che conferma ogni step e il GO/NO-GO.

Riferimenti:

- Piano: `docs/superpowers/plans/2026-09-24-fine-sicurezza-voto-p0-4-p1.md`
  (§13 = contenuto di questo runbook, §14 = GO/NO-GO, §10 = gate quantitativi).
- Design: `docs/p0-4-server-side-identity-design.md`.
- Preflight post-deploy: `docs/p0-4-preflight-postdeploy.md`.
- Retention (post-evento): `docs/retention-runbook.md`.
- Indice concorrente: `scripts/p0-4-create-unique-index.mjs` (§6-bis del piano).
- Backfill: `scripts/p0-4-backfill.mjs` (§6-quater del piano).

## Principi non negoziabili

- **Mai `voterId` dal body** in nessun mode.
- **Fail-closed**: errore infrastrutturale → `503`, nessuna identità nuova,
  nessun voto.
- **Rollback non distruttivo**: flag-driven, nessun `DELETE`/`TRUNCATE`.
- **`CREATE UNIQUE INDEX CONCURRENTLY`** solo fuori `db push` (script dedicato);
  mai `NOT VALID` su unique.
- Evento attivo coerente: `active_event_id` ↔ `active_batch` (fail-closed).
- Esecuzione globale con `--allow-prod` esplicito e snapshot prima.

## I 15 step

### 1. Snapshot read-only DB
- Snapshot di sicurezza **prima** di qualsiasi cosa.
- `node scripts/loadtest/db-snapshot.mjs` → `backups/<target>-<ts>.json`
  (read-only) + verifica PITR/backup automatici Supabase.
- **Gate**: snapshot presente e leggibile.

### 2. Validazione E2E completa
- Suite E2E verde sul progetto `fantacer-e2e` (`e2e:gate`, `e2e:home`,
  `e2e:admin`, targeted security gate + unit + integrazione + concorrenza +
  E2E production-like).
- **Gate**: tutti verdi, nessun flaky irrisolto.

### 3. Verifica env
- `SESSION_HMAC_KEYS` (keyring `k1:<b64>,k2:<b64>`), `SESSION_HMAC_ACTIVE`
  presente e referenziato dal keyring.
- Ogni chiave **≥ 32 byte** decodificati.
- `SESSION_IDENTITY_MODE=off` (partenza legacy puro).
- `SIGNAL_HMAC_KEY` / `SIGNAL_HMAC_KEY_ID` presenti (≥32B) se i segnali sono
  attivi; altrimenti il percorso shadow è non-bloccante.
- **Gate**: nessuna chiave corta, nessun mode inatteso.

### 4. Applicazione schema additivo (a1) a produzione — solo con autorizzazione
- Migration additive e **inerti**: `events`, `event_principals`, `voter_sessions`,
  `bootstrap_nonces`, segnali, `submit_vote_v2`, `vote_quarantine`; colonne
  `vote_sessions.event_id/principal_id`.
- Applicazione **solo** su autorizzazione esplicita, in finestra a basso traffico.
- **Gate**: schema applicato, app invariata (mode `off`).

### 5. Seed evento (`events` + `active_event_id`), verifica coerenza con `active_batch`
- Creare/attivare l'evento e valorizzare `batch_settings.active_event_id`.
- Verificare `events.batch == batch_settings.active_batch`; in caso di
  incoerenza → **fail-closed** (la risoluzione identità deve restituire `503`).
- **Gate**: coerenza verificata; nessun evento attivo duplicato per batch.

### 6. Deploy codice in `off` (legacy invariato)
- Deploy con `SESSION_IDENTITY_MODE=off`: comportamento legacy puro, nessuna
  scrittura principal, nessun bootstrap richiesto.
- **Gate**: nessuna regressione funzionale; voto legacy invariato.

### 7. `shadow`: dual-write + confronto, monitor
- `SESSION_IDENTITY_MODE=shadow`: read legacy, write legacy **+** principal
  (best-effort, **mai bloccante**); errori shadow loggati, voto legacy prosegue.
- Monitorare il confronto legacy vs principal.
- **Gate**: nessun impatto sul voto; metriche di confronto raccolte.

### 8. Backfill completo evento
- `node scripts/p0-4-backfill.mjs` per l'evento attivo
  (`BACKFILL_DB_URL=<url>` + `--allow-prod` solo con autorizzazione).
- Keyset, checkpoint, `statement_timeout`/`lock_timeout` finiti; solo le righe
  con le 3 aziende interamente nel batch dell'evento; le righe miste sono
  validate/skippate e riportate.
- **Gate**: mapping completo (coverage 100% dello scope evento), 0 divergenze.

### 9. Gate quantitativi (§10)
- 100% dei `vote_sessions` dell'evento risolvono a un principal.
- **0 secondi voti**: fingerprint legacy già votato oggi → dopo bootstrap+submit
  → `409`, conteggio invariato.
- **0 divergenze** dedup legacy vs principal.
- **0 errori infra anomali** (`503`) sul bootstrap.
- Finestra minima + volumi definiti (vedi §10 del piano).
- **Gate**: tutti soddisfatti; altrimenti STOP e rollback mode.

### 10. `dual`: sessione-first + fallback legacy
- `SESSION_IDENTITY_MODE=dual`: sessione → fallback cookie legacy first-party
  (mai body); errore di risoluzione primaria → `503` fail-closed.
- **Gate**: voti corretti, fallback solo su cookie legacy presente e valido.

### 11. Verifica compatibilità votanti già registrati
- Un utente che ha già votato (cookie **o** solo-localStorage migrato) non deve
  ottenere un secondo voto: nuovo tentativo → `409`, count invariato.
- **Gate**: 0 secondi voti su utenti preesistenti.

### 12. Vincoli/dedup P1 (`submit_vote_v2`, unique CONCURRENTLY via script)
- `submit_vote_v2`: idempotenza completa, errori strutturati, nessun IP in
  chiaro né `md5(ip)`, `audit_logs` senza `ip_address` in chiaro.
- Dedup `(event_id, principal_id, vote_day)`: pre-check duplicati; se presenti →
  **quarantena** (nessuna DELETE); poi
  `node scripts/p0-4-create-unique-index.mjs` (fuori `db push`, gestione
  `INVALID`, mai `NOT VALID`).
- **Gate**: indice unico valido; 0 duplicati; retry/concorrenza senza doppioni.

### 13. `session`: solo sessione
- `SESSION_IDENTITY_MODE=session`: identità **solo** sessione, nessun fallback
  legacy; bootstrap obbligatorio; fail-closed `503`.
- **Gate**: bootstrap unica fonte identità; nessun voto senza sessione.

### 14. Monitoraggio
- Monitorare: `429` (rate limit), errori `5xx`/`503`, marker telemetria
  (`rateWouldBlock`, scopes IP/id), quarantena, `409`.
- **Gate**: nessun picco anomalo; eventuali anomalie → rollback mode.

### 15. Rollback a mode precedente
- Rollback **non distruttivo**, flag-driven: `session → dual → shadow → off`.
- **Mai** riaccettare `voterId` dal body.
- Nessun `DELETE`/`TRUNCATE`; le tabelle additive restano inerti.
- **Gate**: comportamento legacy ripristinato senza perdita di voti.

## GO / NO-GO finale

GO solo se **tutti**:

- [ ] `voterId` non accettato dal client (route + status).
- [ ] bootstrap unica fonte identità; Turnstile-gated (cData nonce monouso) +
      rate-limited.
- [ ] sessione server-side revocabile/ruotabile; solo HMAC in DB; chiavi solo server.
- [ ] CSRF attivo (`X-CSRF-Token` + Origin/Host + rotazione).
- [ ] nuova sessione dopo cancellazione cookie → quarantena/step-up, mai voto
      accettato automatico.
- [ ] chi ha già votato (cookie o solo-localStorage) non ottiene un secondo voto
      in migrazione.
- [ ] dedup `(event_id, principal_id, vote_day)` atomico; quarantena/rejected
      consumano l'unicità.
- [ ] `submit_vote_v2` idempotente (matrice completa); nessun IP in chiaro né
      `md5(ip)` nei nuovi record; segnali tipizzati server-derived.
- [ ] totali aggiornati esattamente una volta per transizione; riconciliazione
      idempotente.
- [ ] retry/concorrenza senza duplicati; indice CONCURRENTLY applicato fuori
      `db push`.
- [ ] `active_event_id` coerente con `active_batch` (fail-closed).
- [ ] backfill per evento/batch completo, 0 divergenze, validazione aziende.
- [ ] quarantena senza impatto classifica.
- [ ] ACL/RLS e RPC chiuse.
- [ ] full CI riattivata e Vote security gate remoto verde.
- [ ] targeted gate + unit + integrazione + concorrenza + E2E prod-like verdi.
- [ ] worktree/branch pulito: nessuna modifica locale dell'utente inclusa.
- [ ] nessuna configurazione/migration di produzione modificata.

Se un solo punto è NO → **NO-GO**.

## Regola di design — mai challenge sui path API

Lezione dall'incidente edge (branch `feat/cloudflare-admin`, parcheggiato e fuori
scope): una **Managed Challenge / Challenge** Cloudflare su un path API risponde
con una **pagina HTML** (`403` "Just a moment..."), che rompe i
`fetch('/api/...')` dell'app (`Unexpected token '<'`).

- **Mai** applicare azioni `challenge` / `managed_challenge` su `/api` o
  `/api/*`.
- Le azioni **non-challenge** (`block`, `deny`, `rate_limit`, ...) restano
  consentite anche su `/api/*`: non restituiscono HTML e non rompono il
  contratto JSON.
- La regola è codificata come guardrail in
  `src/lib/edge/guardrails.ts` (`assertNoApiChallenge`, errore
  `challenge_on_api_path_forbidden`) e nasce dal revert
  `revert(cf): remove vote-challenge rules (HTML challenge breaks JSON API)`.

Nel contesto di questo rilascio: nessuna mitigazione edge deve introdurre
challenge sui path di voto/identità (`/api/vota`, `/api/vota/status`,
`/api/identity/*`).

## Dopo il rilascio

- Retention dati **dopo** la fine dell'evento + orizzonte: `docs/retention-runbook.md`.
- Canary manuale su produzione (mai automatizzato): verificare che
  `batch_settings.active_batch` e `site_settings` non siano cambiati dopo i run E2E.
