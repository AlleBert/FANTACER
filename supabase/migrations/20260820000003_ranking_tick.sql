-- Tabella "tick" per il realtime della classifica pubblica.
-- Contiene SOLO un contatore di versione (nessuna PII). Viene incrementata da
-- un trigger su vote_sessions a ogni cambio di voto. La policy anon select
-- consente ai client pubblici di ricevere gli eventi Realtime senza esporre
-- alcun dato sensibile (vote_sessions resta inaccessibile ai client).
-- Il client si sottoscrive a questa tabella e refetcha /api/public/ranking.

create table if not exists ranking_tick (
  id integer primary key default 1,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- una sola riga (singleton)
insert into ranking_tick (id, version) values (1, 0)
  on conflict (id) do nothing;

alter table ranking_tick enable row level security;

drop policy if exists "ranking_tick_public_select" on ranking_tick;
create policy "ranking_tick_public_select" on ranking_tick
  for select using (true);

-- REPLICA IDENTITY FULL: richiesto perché Realtime consegni l'evento (come per
-- le altre tabelle abilitate in 20260720000000_schema_fixes.sql).
alter table ranking_tick replica identity full;

-- Trigger: bump del contatore su ogni INSERT/UPDATE/DELETE di vote_sessions.
create or replace function bump_ranking_tick() returns trigger
language plpgsql
as $$
begin
  update ranking_tick set version = version + 1, updated_at = now() where id = 1;
  return new;
end;
$$;

drop trigger if exists trg_bump_ranking_tick on vote_sessions;
create trigger trg_bump_ranking_tick
  after insert or update or delete on vote_sessions
  for each row execute function bump_ranking_tick();

-- Abilita il realtime sulla tabella (coerente con enable_realtime_admin_tables).
-- Idempotente: evita l'errore duplicate_object se la tabella è già pubblicata.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ranking_tick'
  ) then
    alter publication supabase_realtime add table public.ranking_tick;
  end if;
end;
$$;