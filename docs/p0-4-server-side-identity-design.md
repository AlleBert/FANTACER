# P0-4 — Identità server-side (design)

> **Stato: design. Nessuna migration applicata, nessun cutover, nessun deploy.**
> Implementazione solo dopo approvazione esplicita, e in fasi separate.

## Correzioni applicate (10)

1. **Rollout suddiviso**: `P0-4a1` → `P0-4a2` → `P0-4b` → `P0-4c` → `P0-4d/P1` (fasi separate, deploy separati).
2. **Prima migration (`a1`) additiva e completamente inerte**: nessuna lettura/scrittura nuova, nessun trigger, nessuna RPC, nessuna modifica a `submit_vote`/`vote_sessions` esistente.
3. **ACL/RLS esplicite** su tutte le tabelle nuove (deny-by-default per `anon`/`authenticated`).
4. **Dual-write non nello stesso deploy** dello schema: `a1` è solo schema; il dual-write è `a2`.
5. **Rimosso il fallback `voterId` dal payload**: l'identità non arriva mai dal body.
6. **Errore infrastrutturale → fail-closed**: nessuna nuova identità e nessun voto; `503`, non fallback.
7. **DDL completo di `a1`** incluso in questo documento.
8. **Matrice ACL/RLS** esplicita per ogni tabella.
9. **Query di preflight e post-deploy** definite.
10. **Backfill a batch + test legacy→409**: strategia di backfill resumibile e test che dimostra che un votante legacy già registrato riceve `409` e **non** una seconda scheda.

## Obiettivo

Identità **server-side**: il client non può rigenerarla per votare due volte. Fino
a P0-4 il sistema è *mitigato* (Turnstile, rate limit, ACL) ma un utente può
rigenerare l'UUID.

## Non-obiettivi

- Non rimuovere il dedup legacy `(fingerprint, vote_day)` prima del backfill verificato.
- Non toccare gli input Admin (`site_settings`, `batch_settings`).
- Mai fail-open: nessun nuovo voto su errore.

## Perché dual-read/dual-write

Il deploy di P0-4 non deve **azzerare l'identità** dei browser che hanno già
votato: un browser con fingerprint pregresso va agganciato al suo principal,
altrimenti il deploy stesso abiliterebbe un secondo voto.

## Modello dati

### `events`
`id uuid pk`, `slug text unique`, `name text`, `batch text unique`
(mappa su `batch_settings.active_batch`), `starts_at`/`ends_at timestamptz`,
`status text check in ('draft','active','archived')`, `created_at`.

Evento attivo = `events.batch = batch_settings.active_batch AND status='active'`.

### `event_principals`
`id uuid pk`, `event_id uuid fk events`, `legacy_fingerprint text` (`v1:<uuid>`),
`created_at`; `unique(event_id, legacy_fingerprint)`.

### `voter_sessions`
`id uuid pk`, `event_id uuid fk`, `principal_id uuid fk event_principals`,
`token_hash text` (solo hash), `key_id text`, `created_at`, `last_seen_at`,
`expires_at`, `revoked_at`; `unique(event_id, token_hash)`.

### `vote_sessions` (estensioni, nullable)
`event_id uuid`, `principal_id uuid`; `fingerprint` **mantenuto** per
compatibilità/rollback.

## P0-4a1 — DDL completo (additivo, inerte)

```sql
-- P0-4a1: schema additivo e INERTE. L'app non legge/scrive queste tabelle/colonne.
begin;

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  batch       text not null unique,
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text not null default 'draft'
              check (status in ('draft','active','archived')),
  created_at  timestamptz not null default now()
);

create table if not exists public.event_principals (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete restrict,
  legacy_fingerprint  text,
  created_at          timestamptz not null default now(),
  unique (event_id, legacy_fingerprint)
);

create table if not exists public.voter_sessions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete restrict,
  principal_id  uuid not null references public.event_principals(id) on delete restrict,
  token_hash    text not null,
  key_id        text not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  unique (event_id, token_hash)
);

alter table public.vote_sessions
  add column if not exists event_id uuid references public.events(id) on delete restrict,
  add column if not exists principal_id uuid references public.event_principals(id) on delete restrict;

create index if not exists idx_vote_sessions_event_principal_day
  on public.vote_sessions (event_id, principal_id, vote_day);
create index if not exists idx_voter_sessions_principal
  on public.voter_sessions (principal_id);
create index if not exists idx_event_principals_event
  on public.event_principals (event_id);

-- ACL/RLS: deny-by-default. Accesso applicativo solo via service_role.
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
comment on table public.voter_sessions   is 'P0-4a1 (inerte): sessioni server-side (solo token_hash). Nessun accesso anon.';

commit;
```

Nessun trigger, nessuna RPC, nessuna policy, nessuna modifica di comportamento.

## Matrice ACL/RLS

| oggetto | `anon` | `authenticated` | `service_role` | `postgres` |
|---|---|---|---|---|
| `events` | nessun privilegio | nessun privilegio | SELECT/INSERT/UPDATE/DELETE (RLS bypass) | owner |
| `event_principals` | nessun privilegio | nessun privilegio | SELECT/INSERT/UPDATE/DELETE | owner |
| `voter_sessions` | nessun privilegio | nessun privilegio | SELECT/INSERT/UPDATE/DELETE | owner |
| `vote_sessions.event_id/principal_id` | invariato | invariato | aggiunti (nullable) | owner |

RLS abilitata senza policy ⇒ nessuna riga visibile a `anon`/`authenticated`
anche in caso di grant residui. Nessuna sequenza creata (solo uuid).

## Cookie di sessione (fase `b`, non in `a1`)

- `fantacer_session` = `key_id.token` (token 32B base64url); `HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/`, `Max-Age` entro fine evento.
- Server salva `token_hash = HMAC-SHA256(SESSION_HMAC_KEY, key_id || token)`;
  keyring con più `key_id` per rotazione.

## Risoluzione identità (P0-4b, dual-read)

1. Cookie sessione valido → `voter_sessions` → principal.
2. Altrimenti **fingerprint legacy dal cookie first-party** `fantacer_voter_id`
   (UUID validato) → trova/crea principal (`event_id`, `legacy_fingerprint`) →
   sessione agganciata a quello.
3. Altrimenti → nuovo principal + sessione (nuovo utente).

- **Nessun `voterId` dal payload**: rimosso dal contratto.
- **Errore infrastrutturale** (DB/limiter) → `503`, **nessuna** creazione di
  identità e **nessun** voto. Fail-closed.

## Dual-write (P0-4a2, shadow)

Al submit: si scrive ancora `vote_sessions.fingerprint` e si valorizzano anche
`event_id`/`principal_id`; upsert idempotente del principal. Flag
`SESSION_IDENTITY_MODE=off` (default) → nessun effetto.

## Backfill (P0-4c) — strategia a batch

- Per evento attivo, per ogni `fingerprint` distinto del batch:
  `insert into event_principals(event_id, legacy_fingerprint) ... on conflict do nothing`.
- **Keyset** su `fingerprint` (batch 50k), resumibile: `where not exists (...)`.
- Connessione **diretta `pg`**, `set local statement_timeout = 0`, nessuna DELETE,
  nessun trigger, nessuna modifica a `vote_sessions`.
- Shadow comparison: contare quanti `vote_sessions` odierni risolvono a un
  principal; deve essere 100% prima di passare a `b`/cutover.

## Rollout e rollback

| Fase | Contenuto | Flag | Rollback |
|---|---|---|---|
| **a1** | schema additivo inerte + ACL/RLS | — | `drop` oggetti nuovi (nessun uso) |
| **a2** | dual-write shadow | `SESSION_IDENTITY_MODE=off` | flag→off |
| **b** | dual-read con fallback legacy | `dual` | flag→off |
| **c** | backfill + shadow comparison | `dual` | flag→off |
| **d/P1** | unique `(event_id, principal_id, vote_day)` + quarantena + cutover | — | indice rimosso |

Rollback non fail-open in ogni fase: si torna alla modalità precedente; su errore
di lookup si usa il legacy o si fallisce chiuso, mai un nuovo voto.

## Query di preflight (prima di `a1`)

```sql
-- collisioni di nome
select to_regclass('public.events') is null as events_free,
       to_regclass('public.event_principals') is null as principals_free,
       to_regclass('public.voter_sessions') is null as sessions_free;
-- colonne già presenti?
select column_name from information_schema.columns
 where table_schema='public' and table_name='vote_sessions'
   and column_name in ('event_id','principal_id');
-- baseline
select count(*) as vote_sessions_total from public.vote_sessions;
select value as active_batch from public.batch_settings where id='default';
-- grant anomali pre-esistenti
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name in ('events','event_principals','voter_sessions');
```

## Query di post-deploy (dopo `a1`)

```sql
-- esistenza e RLS
select relname, relrowsecurity from pg_class
 where relname in ('events','event_principals','voter_sessions');
-- nessun privilegio anon/authenticated
select has_table_privilege('anon','public.events','select') as anon_events,
       has_table_privilege('authenticated','public.voter_sessions','select') as auth_sessions;
-- tabelle vuote
select (select count(*) from public.events) e,
       (select count(*) from public.event_principals) p,
       (select count(*) from public.voter_sessions) s;
-- nessuna modifica di comportamento: conteggio voti invariato
select count(*) from public.vote_sessions;
select value from public.site_settings where key in ('voting_enabled','antibot_enabled');
```

## Test: votante legacy già registrato → 409, nessuna seconda scheda

Fixture (progetto E2E):
1. `event` attivo per il batch; riga `vote_sessions` con
   `fingerprint = 'v1:<uuid>'`, `vote_day = oggi`, senza sessione.
2. Bootstrap con cookie `fantacer_voter_id=<uuid>` (nessun payload `voterId`).
   - atteso: sessione creata e **principal mappato a `v1:<uuid>`**.
3. POST `/api/vota` con la sessione.
   - atteso: **`409` già votato**; `count(*)` di `vote_sessions` per quel
     fingerprint **invariato** (nessuna seconda scheda).
4. Varianti: due schede, cookie cancellato, localStorage presente, sessione
   scaduta/revocata, errore DB simulato → `503` e nessun principal creato.

## Domande aperte

1. Mappatura evento: `events.batch` ↔ `active_batch` o `active_event_id` dedicato?
2. TTL sessione e politica di rinnovo (per-evento vs rolling)?
3. Per quanto mantenere `fingerprint` come fallback dopo P1?
