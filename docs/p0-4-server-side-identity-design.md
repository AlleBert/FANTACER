# P0-4 — Identità server-side (design, rev. 2)

> **Stato: design. Nessuna migration applicata, nessun cutover, nessun deploy.**
> Implementazione solo dopo approvazione finale del DDL.

## Correzioni integrate (12 punti residui)

1. **FK composite** (principal∈event, sessione∈principal).
2. **`active_event_id`** esplicito (non implicito in `events.batch`).
3. **Schema completo della sessione** (versione hash, revoca, indici).
4. **HMAC versionato** con keyring e rotazione.
5. **Backfill con timeout finito** e resumibile.
6. **Semantica dei mode** esplicita e fail-closed.
7. **Rollback non distruttivo** (nessun DELETE/TRUNCATE, flag-driven).
8. **ACL/RLS complete** (deny-by-default).
9. **Unicità/idempotenza** (partial unique, dedup P1).
10. **Lifecycle evento** (immutabilità, un solo attivo per batch).
11. **Cookie/CSRF/contratto** (no `voterId` dal payload, fail-closed).
12. **Osservabilità e gate di rollout quantitativi**.

## Obiettivo / Non-obiettivi

Identità **server-side**: il client non può rigenerarla per votare due volte.
Non si rimuove il dedup legacy `(fingerprint, vote_day)` prima del backfill
verificato; non si toccano gli input Admin esistenti (si **aggiunge**
`active_event_id`); mai fail-open.

## Perché dual-read/dual-write

Il deploy non deve **azzerare l'identità** di chi ha già votato: un browser con
fingerprint pregresso va agganciato al suo principal, altrimenti il deploy
stesso abiliterebbe un secondo voto.

## Modello dati

### `events`
`id uuid pk`, `slug text unique`, `name text`, `batch text not null`,
`starts_at`/`ends_at timestamptz`, `status text check in ('draft','active','archived')`,
`created_at`.
Vincoli lifecycle (10): `id`/`slug`/`batch` immutabili dopo `status='active'`
(trigger `before update`); un solo `active` per batch
(`unique (batch) where status='active'`).

### `event_principals`
`id uuid pk`, `event_id uuid fk events`, `legacy_fingerprint text`,
`created_at`.
- `unique (event_id, legacy_fingerprint) where legacy_fingerprint is not null` (9)
- **`unique (event_id, id)`** — target delle FK composite (1).

### `voter_sessions` (schema completo, 3)
`id uuid pk`, `event_id uuid not null`, `principal_id uuid not null`,
`token_hash text not null`, `key_id text not null`,
`hash_version int not null default 1`, `created_at not null default now()`,
`last_seen_at not null default now()`, `expires_at not null`,
`revoked_at timestamptz`, `revoke_reason text`.
- **FK composite**: `foreign key (event_id, principal_id) references event_principals(event_id, id)` (1)
- `unique (event_id, token_hash)` (9)
- indici: `(principal_id)`, `(expires_at)`, `(event_id, revoked_at)`.
- **Nessun PII**: niente IP grezzo, niente user-agent.

### `vote_sessions` (estensioni, nullable)
`event_id uuid`, `principal_id uuid`; **FK composite**
`(event_id, principal_id) → event_principals(event_id, id)` (1).
`fingerprint` mantenuto per compatibilità/rollback.

### `batch_settings.active_event_id` (2)
`active_event_id uuid references events(id)` (nullable, **inerte** in a1).
Risoluzione evento attivo: `active_event_id` se valorizzato, altrimenti
fallback `events.batch = active_batch AND status='active'`.

## HMAC versionato (4)

- Keyring: `SESSION_HMAC_KEYS=k1:<b64>,k2:<b64>` + `SESSION_HMAC_ACTIVE=k2`.
- `token_hash = HMAC-SHA256(key(key_id), key_id || token)`; si salvano
  `key_id` + `hash_version`. Rotazione: le sessioni vecchie restano valide
  finché il loro `key_id` è nel keyring; nuove sessioni usano l'attivo.
- Token mai persistito in chiaro; nessun IP/UUID nei log.

## P0-4a1 — DDL completo (additivo, INERTE)

```sql
-- P0-4a1: schema additivo e inerte. L'app non legge/scrive queste tabelle/colonne.
begin;

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  batch       text not null,
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text not null default 'draft'
              check (status in ('draft','active','archived')),
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_events_active_per_batch
  on public.events (batch) where status = 'active';

create table if not exists public.event_principals (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete restrict,
  legacy_fingerprint  text,
  created_at          timestamptz not null default now(),
  unique (event_id, id),
  constraint uq_event_principals_legacy
    unique (event_id, legacy_fingerprint)
);
-- NB: unique(event_id, id) è il target delle FK composite.

create table if not exists public.voter_sessions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null,
  principal_id  uuid not null,
  token_hash    text not null,
  key_id        text not null,
  hash_version  integer not null default 1,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  revoke_reason text,
  unique (event_id, token_hash),
  constraint fk_voter_sessions_principal
    foreign key (event_id, principal_id)
    references public.event_principals(event_id, id) on delete restrict
);
create index if not exists idx_voter_sessions_principal on public.voter_sessions (principal_id);
create index if not exists idx_voter_sessions_expires on public.voter_sessions (expires_at);
create index if not exists idx_voter_sessions_event_revoked on public.voter_sessions (event_id, revoked_at);

alter table public.vote_sessions
  add column if not exists event_id uuid,
  add column if not exists principal_id uuid;
alter table public.vote_sessions
  add constraint fk_vote_sessions_principal
  foreign key (event_id, principal_id)
  references public.event_principals(event_id, id) on delete restrict;

create index if not exists idx_vote_sessions_event_principal_day
  on public.vote_sessions (event_id, principal_id, vote_day);

alter table public.batch_settings
  add column if not exists active_event_id uuid references public.events(id);

-- ACL/RLS: deny-by-default, accesso solo via service_role.
alter table public.events           enable row level security;
alter table public.event_principals enable row level security;
alter table public.voter_sessions   enable row level security;

revoke all on public.events, public.event_principals, public.voter_sessions
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.events, public.event_principals, public.voter_sessions
  to service_role;

comment on table public.events           is 'P0-4a1 (inerte): eventi di voto. Nessun accesso anon.';
comment on table public.event_principals is 'P0-4a1 (inerte): principal per evento. Nessun accesso anon.';
comment on table public.voter_sessions   is 'P0-4a1 (inerte): sessioni (solo token_hash). Nessun accesso anon.';

commit;
```

Nessun trigger applicativo in a1 (il trigger di immutabilità `events` è **a2**,
non in a1, per mantenere a1 inerte); nessuna RPC; nessuna policy.

## Matrice ACL/RLS (8)

| oggetto | `anon` | `authenticated` | `service_role` | `postgres` |
|---|---|---|---|---|
| `events` | nessuno | nessuno | CRUD (BYPASSRLS) | owner |
| `event_principals` | nessuno | nessuno | CRUD | owner |
| `voter_sessions` | nessuno | nessuno | CRUD | owner |
| `batch_settings.active_event_id` | invariato | invariato | colonna aggiunta | owner |
| `vote_sessions.event_id/principal_id` | invariato | invariato | colonne aggiunte | owner |

RLS abilitata senza policy ⇒ nessuna riga visibile anche con grant residui.
Nessuna sequenza creata. Debito separato: default privileges `supabase_admin`.

## Risoluzione identità (P0-4b, dual-read) — contratto (11)

1. Cookie sessione valido → `voter_sessions` → principal.
2. Altrimenti **fingerprint legacy dal cookie first-party** `fantacer_voter_id`
   (UUID validato) → trova/crea principal → sessione agganciata.
3. Altrimenti → nuovo principal + sessione (nuovo utente).

- **`voterId` rimosso dal payload**; l'identità non arriva mai dal body.
- **Errore infrastrutturale → `503`**, nessuna identità creata, nessun voto.
- Cookie `fantacer_session` = `key_id.token`; HttpOnly/Secure/SameSite=Lax/Path=/;
  Max-Age ≤ fine evento. CSRF double-submit legato alla sessione sulle rotte di stato.

## Semantica dei mode (6)

| mode | read | write | fallback legacy | note |
|---|---|---|---|---|
| `off` | legacy | legacy | n/a | default a1; nessun effetto |
| `shadow` | legacy | legacy + principal | sì | a2, confronto senza impatto |
| `dual` | sessione → legacy | legacy + principal | sì | b/c |
| `session` | sessione | sessione + legacy | no | cutover (d) |

Fail-closed in ogni mode: su errore di lookup/limiter → `503` (mode `dual`/`session`)
o fallback legacy (`off`/`shadow`), **mai** nuova identità e **mai** un voto.

## Backfill dell'intero evento (5) — strategia a batch

- Per l'evento attivo, per **ogni** `fingerprint` distinto delle `vote_sessions`
  del batch (intero storico dell'evento, non solo oggi).
- Keyset su `fingerprint`, batch 50k, resumibile (`where not exists`).
- Per batch: `set local statement_timeout = '30s'` e `lock_timeout = '5s'`
  (**finito**, mai `0`); su timeout, retry con batch ridotto.
- Connessione **diretta `pg`**, nessun trigger toccato, **nessuna DELETE**.
- Checkpoint in tabella dedicata (`backfill_checkpoints`) o stato in file.

## Procedura unique index concorrente (P1)

`CREATE UNIQUE INDEX CONCURRENTLY` non ammette `NOT VALID`; quindi:
1. **Pre-check duplicati** su `(event_id, principal_id, vote_day)` (query sotto).
2. Se esistono duplicati → **quarantena** (colonna `quarantined boolean default false`
   su `vote_sessions`, `update ... where ...` — additivo, reversibile), **nessuna DELETE**.
3. `CREATE UNIQUE INDEX CONCURRENTLY uq_vote_sessions_event_principal_day
   ON public.vote_sessions (event_id, principal_id, vote_day) WHERE event_id IS NOT NULL AND principal_id IS NOT NULL;`
4. Se il build fallisce, si ripete il passo 2.
5. Rollback: `DROP INDEX CONCURRENTLY` (nessun dato modificato).

```sql
-- pre-check duplicati (prima del build)
select event_id, principal_id, vote_day, count(*)
from public.vote_sessions
where event_id is not null and principal_id is not null
group by 1,2,3 having count(*) > 1;
```

## Gate shadow quantitativi (12)

Prima di passare da `shadow` a `dual`, e da `dual` a `session`:
- **Copertura principal**: 100% dei `vote_sessions` odierni risolvono a un principal.
- **Doppio voto**: 0 casi in cui un browser con fingerprint pregresso ottiene una
  seconda scheda (shadow compare).
- **Divergenza dedup**: 0 differenze tra dedup legacy e dedup per principal.
- **Errori infra**: 0 `503` anomali sui bootstrap.
- Soglia minima di osservazione per ciascun gate (finestra + volumi) definita nel
  runbook; nessun cutover se un gate non è soddisfatto.

## Rollback non distruttivo (7)

| Fase | Rollback |
|---|---|
| a1 | lasciare gli oggetti (inerti); drop solo se vuoti; **mai** `vote_sessions` |
| a2 | `SESSION_IDENTITY_MODE=off` |
| b | `SESSION_IDENTITY_MODE=shadow` |
| c | `SESSION_IDENTITY_MODE=dual` con fallback legacy |
| d/P1 | `DROP INDEX CONCURRENTLY`; quarantena reversibile (`quarantined=false`) |

Nessun DELETE/TRUNCATE in nessuna fase.

## Preflight / post-deploy

Vedi `docs/p0-4-preflight-postdeploy.md` (query di collisione, RLS, conteggi,
invarianti `voting_enabled`/`antibot_enabled` e conteggio `vote_sessions`).

## Test legacy→409

Fixture: `vote_sessions` con `fingerprint='v1:<uuid>'`, `vote_day=oggi`, senza
sessione → bootstrap con cookie legacy → principal mappato a `v1:<uuid>` →
POST `/api/vota` → **409**, `count(*)` invariato. Varianti: due schede, cookie
cancellato, sessione scaduta/revocata, errore DB simulato → `503` e nessun principal.

## Domande aperte

1. Trigger di immutabilità `events` in a2 o a1 (a1 resta inerte)?
2. TTL sessione e rinnovo (per-evento vs rolling)?
3. Per quanto mantenere `fingerprint` come fallback dopo P1?
