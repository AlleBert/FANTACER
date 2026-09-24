-- P0-4c — nonce di bootstrap pre-sessione. ADDITIVO e INERTE.
-- L'app popola/consuma questa tabella solo quando il bootstrap è invocato;
-- nessun cambio di comportamento finché SESSION_IDENTITY_MODE è `off`.
-- Vedi docs/p0-4-server-side-identity-design.md.

begin;

create table if not exists public.bootstrap_nonces (
  nonce       text primary key,
  purpose     text not null default 'bootstrap',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);

-- Cleanup per scadenza: supporta la delete `expires_at < now()`.
create index if not exists idx_bootstrap_nonces_expires
  on public.bootstrap_nonces (expires_at);

-- ACL/RLS: deny-by-default. Accesso applicativo solo via service_role.
alter table public.bootstrap_nonces enable row level security;

revoke all on public.bootstrap_nonces from public, anon, authenticated;
grant select, insert, update, delete on public.bootstrap_nonces to service_role;

comment on table public.bootstrap_nonces
  is 'P0-4c (inerte): nonce monouso di bootstrap pre-sessione. Nessun accesso anon.';
comment on column public.bootstrap_nonces.consumed_at
  is 'P0-4c: valorizzato alla consumazione atomica (single-use).';

commit;
