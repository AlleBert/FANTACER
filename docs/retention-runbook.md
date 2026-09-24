# Runbook — Retention e minimizzazione dati voto (C13 / FASE G)

Script: `scripts/retention.mjs`
Branch: `feat/vote-security`
Test: `tests/scripts/retention.test.ts` (integrazione su `fantacer-e2e`)

> **Stato: implementato. Dry-run di default.** Nessuna scrittura avviene senza
> `--apply` esplicito. La distruzione delle chiavi HMAC è **manuale** e non è
> eseguita da questo script.

## Obiettivo

Eliminare i dati operativi oltre l'orizzonte di retention e **anonimizzare** le
PII legacy, mantenendo intatti i voti (`vote_sessions` non viene mai cancellata).
Questo runbook descrive dry-run, apply, verifica e rollback.

## Orizzonte di retention

`event.ends_at + --days` (default **7 giorni**).

- Se l'evento non ha `ends_at` è obbligatorio `--before <iso>`.
- La retention si applica **solo dopo** il raggiungimento dell'orizzonte
  (`now >= cutoff`): con `cutoff` nel futuro il report riporta `reached=false` e
  nessuna riga è in scope. Questo evita di anonimizzare dati ancora coperti.
- `--before` sovrascrive l'orizzonte derivato da `ends_at`.

## Cosa è in scope (e cosa viene fatto)

| dato | condizione | azione |
|---|---|---|
| `voter_sessions` (evento) | `expires_at < cutoff` **oppure** `revoked_at < cutoff` | DELETE |
| `event_principals` (evento) | nessuna sessione residua **e** nessun voto associato | DELETE |
| `bootstrap_nonces` | scaduto, oppure consumato da > 1h | DELETE |
| `vote_sessions.ip_hash` / `user_agent` | `created_at < cutoff` e (`event_id = evento` o `event_id is null`) | UPDATE → `NULL` |
| `audit_logs.ip_address` / `user_agent` | `created_at < cutoff` | UPDATE → `NULL` |
| `audit_logs.fingerprint` | `created_at < cutoff` | UPDATE → `'redacted'` |

Invarianti:

- **`vote_sessions` non viene mai cancellata** (i voti restano per dedup e
  classifica). Nella tabella sopra compaiono solo colonne PII legacy.
- I `key_id` (keyring) che dopo l'apply non hanno più sessioni residue sono
  riportati come `destroyEligible`: il report è **informativo**, la distruzione
  della chiave va fatta a mano (vedi sotto).
- Le operazioni avvengono a batch (`--batch-size`, default 5000) con
  `statement_timeout = 30s` e `lock_timeout = 5s` finiti, connessione diretta
  `pg`; apply e ripetibile/idempotente.

## Sicurezza host

- Default: connessione **E2E** (`loadE2eDbUrl`, `.env.e2e`), con guard sul ref.
- Altri target (es. produzione): `RETENTION_DB_URL=<url>` **e** `--allow-prod`.
  Un ref di produzione viene **rifiutato** senza `--allow-prod`.
- Prima di qualunque apply su produzione: **snapshot read-only** del DB (vedi
  `npm run loadtest:snapshot`, `scripts/loadtest/db-snapshot.mjs`).

## Comandi

```bash
# 1) Dry-run sull'evento attivo (nessuna scrittura)
node scripts/retention.mjs

# 2) Dry-run su un evento specifico, orizzonte custom
node scripts/retention.mjs --event-id <uuid> --days 7

# 3) Dry-run con cutoff esplicito (evento senza ends_at)
node scripts/retention.mjs --event-id <uuid> --before 2026-10-01T00:00:00Z

# 4) Apply (distruttivo/anonimizzante) — richiede --apply
node scripts/retention.mjs --event-id <uuid> --apply

# 5) Verifica post-retention (esce non-zero se resta qualcosa in scope)
node scripts/retention.mjs --event-id <uuid> --verify

# 6) Produzione (snapshot PRIMA; solo con autorizzazione)
RETENTION_DB_URL='postgresql://...' node scripts/retention.mjs --apply --allow-prod
```

Output JSON per script/test: aggiungere `--json` (report su stdout, log su stderr).

## Report

```
{
  "mode": "dry-run" | "apply" | "verify",
  "target": "e2e" | "prod",
  "eventId": "...", "batch": "...",
  "retainsVoteSessions": true,
  "horizon": { "days": 7, "endsAt": "...", "cutoff": "...", "reached": true, "source": "ends_at" },
  "before":  { voterSessions, eventPrincipals, bootstrapNonces, voteSessionsPii, auditLogsPii },
  "after":   { ...stessi campi... },
  "deleted": { voterSessions, eventPrincipals, bootstrapNonces },
  "anonymized": { voteSessionsPii, auditLogsPii },
  "signalKeys": [ { keyId, source, sessions, inScope, remaining, destroyEligible } ],
  "voteSessions": { before, after },   // deve restare invariato
  "remaining": { ...same as after... },
  "durationMs": 123
}
```

- In **dry-run** `after == before` e non viene scritto nulla.
- In **apply** `deleted`/`anonymized` riportano i conteggi effettivi; `remaining`
  deve essere **tutto 0**. Se `voteSessions.after != before` lo script fallisce
  (invariante violata).
- `--verify` non scrive: esce non-zero se `remaining` contiene valori > 0.

## Verifica post-retention

```bash
node scripts/retention.mjs --event-id <uuid> --verify   # exit 0 atteso
node scripts/retention.mjs --event-id <uuid>            # dry-run: remaining tutti 0
```

## Distruzione chiavi (manuale)

`signalKeys` elenca i `key_id` di `voter_sessions` con:
`sessions` (totale), `inScope` (righe eliminate), `remaining`,
`destroyEligible` (`true` quando non resta alcuna sessione con quel `key_id`).

- Un `key_id` `destroyEligible` è un candidato alla **rimozione dal keyring**
  (`SESSION_HMAC_KEYS`/`SESSION_HMAC_ACTIVE`) e, per i segnali, di
  `SIGNAL_HMAC_KEY_ID`/`SIGNAL_HMAC_KEY`.
- La distruzione **non** è eseguita dallo script: va fatta manualmente, in
  modo coordinato (ruotare l'attivo prima di rimuovere la vecchia chiave).
- Non distruggere chiavi ancora in uso: prima verificare `remaining = 0` per
  tutti gli eventi, non solo quello corrente.

## Rollback

- L'anonimizzazione delle PII è **irreversibile**: `ip_hash`, `user_agent`,
  `ip_address`, `fingerprint` non sono recuperabili dallo script.
- Le DELETE (sessioni/principal/nonce) sono ricreabili dall'applicazione
  (nuovo bootstrap) ma non ripristinabili come ID storici.
- Per un ripristino reale serve lo **snapshot** preso prima dell'apply
  (`backups/<target>-<ts>.json`) o PITR Supabase.
- Le chiavi rimosse manualmente sono irreversibili: l'unica mitigazione è la
  rotazione pianificata e la verifica `remaining = 0`.

## Scheduling consigliato

- Esecuzione **manuale** per la prima applicazione (con revisione del dry-run).
- In seguito, schedulazione periodica (es. giornaliera) **dopo** la fine
  dell'evento + orizzonte, con dry-run nei log e apply solo se `remaining` a
  regime è atteso.

## Note

- I voti `accepted` **non** vengono toccati: la classifica e il dedup restano
  invariati.
- `audit_logs` e `bootstrap_nonces` non sono event-scoped: l'apply agisce
  globalmente sulle righe oltre l'orizzonte/1h.
- Su e2e, se `bootstrap_nonces` manca, applicare prima la migration additiva
  `supabase/migrations/20260926000000_bootstrap_nonces.sql` (solo E2E).
