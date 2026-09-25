-- P0-4a1 — schema identità server-side. ADDITIVO e INERTE.
-- L'applicazione non legge/scrive queste tabelle/colonne: nessun cambio di comportamento.
-- Vedi docs/p0-4-server-side-identity-design.md e docs/p0-4-preflight-postdeploy.md.

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
comment on table public.voter_sessions   is 'P0-4a1 (inerte): sessioni (solo token_hash). Nessun accesso anon.';

commit;
