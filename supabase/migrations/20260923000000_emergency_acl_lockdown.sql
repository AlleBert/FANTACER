-- Emergency ACL/policy containment (restrittiva, idempotente).
--
-- Scope:
--  - revoca EXECUTE da PUBLIC/anon/authenticated sulle RPC sensibili;
--  - rimozione delle policy RLS permissive sulle tabelle legacy;
--  - revoca dei privilegi diretti non necessari su tabelle e sequence;
--  - hardening delle default privileges di `postgres` (e `supabase_admin` se
--    il ruolo corrente ne e' membro) per non concedere automaticamente i nuovi
--    oggetti a PUBLIC/anon/authenticated.
--
-- Non-goals (migration separate, successive):
--  - hardening di search_path e riscrittura dei corpi funzione;
--  - eliminazione di funzioni/tabelle;
--  - cancellazione/anonimizzazione di log o dati; rotazione chiavi.
--
-- Motivazione: in produzione `submit_vote` e' eseguibile da `anon` via
-- PostgREST, aggirando l'API Next.js (Turnstile, batch attivo, gate antibot).
-- L'applicazione usa il client service_role (src/lib/supabase/vote-api.ts:15-17,
-- src/lib/rate-limit.ts:28-29, src/app/api/public/ranking/route.ts:12-13),
-- quindi la revoca non impatta il percorso server-side.
--
-- Idempotente: usa `if exists`, `if not exists` e guardie `to_regprocedure` /
-- `to_regclass`, cosi' da poter girare su E2E e produzione anche con set di
-- oggetti/policy differenti. Nessun BEGIN/COMMIT esplicito (runner transazionale).

-- 1) Funzioni sensibili: revoca EXECUTE da PUBLIC, anon, authenticated.
--    REVOKE FROM PUBLIC e' obbligatorio: il privilegio puo' essere ereditato.
do $$
declare
  sig text;
  sigs text[] := array[
    'public.submit_vote(uuid,text,text,text,text)',
    'public.submit_vote(uuid,text,text,text,text,text,text,integer,integer,integer)',
    'public.submit_vote(text,text,text,uuid,uuid,uuid,text)',
    'public.submit_vote(text,text,text,uuid,uuid,uuid,text,text)',
    'public.check_rate_limit(text,integer,integer)',
    'public.check_can_vote(text)',
    'public.increment_vote(uuid,date)',
    'public.get_company_ranking(integer)',
    'public.bump_ranking_tick()',
    'public.maintain_company_totals()'
  ];
begin
  foreach sig in array sigs loop
    if to_regprocedure(sig) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;
end $$;

-- 2) Policy RLS permissive: rimozione (idempotente, nomi presenti in prod e/o E2E).
--    Restano intatte le policy pubbliche necessarie (companies, site_settings,
--    ranking_tick, sponsors) e le policy admin basate su auth.uid().
--    Guardia su to_regclass: `drop policy ... on <tabella inesistente>` fallisce.
do $$
declare
  rec record;
  drops text[][] := array[
    array['public.votes',           'anon_read_votes'],
    array['public.votes',           'Anyone insert votes'],
    array['public.daily_stats',     'Anyone insert daily_stats'],
    array['public.daily_stats',     'Anyone update daily_stats'],
    array['public.daily_stats',     'Public read daily_stats'],
    array['public.settings',        'public_full_settings'],
    array['public.device_sessions', 'Manage own sessions'],
    array['public.analytics_raw',   'Insert analytics'],
    array['public.companies',       'Allow authenticated insert']
  ];
begin
  for i in 1 .. array_length(drops, 1) loop
    if to_regclass(drops[i][1]) is not null then
      execute format('drop policy if exists %I on %s', drops[i][2], drops[i][1]);
    end if;
  end loop;
end $$;

-- 3) Privilegi diretti sulle tabelle legacy: revoca da PUBLIC, anon, authenticated.
do $$
declare
  tbl text;
  tbls text[] := array[
    'public.votes',
    'public.daily_stats',
    'public.settings',
    'public.device_sessions',
    'public.analytics_raw'
  ];
begin
  foreach tbl in array tbls loop
    if to_regclass(tbl) is not null then
      execute format('revoke all on table %s from public, anon, authenticated', tbl);
    end if;
  end loop;
  -- companies: la lettura pubblica resta necessaria (search client-side);
  -- si revocano solo le scritture dirette.
  if to_regclass('public.companies') is not null then
    execute 'revoke insert, update, delete on table public.companies from public, anon, authenticated';
  end if;
end $$;

-- 4) Sequence: revoca dei privilegi diretti non necessari.
do $$
declare
  seq text;
  seqs text[] := array[
    'public.votes_id_seq',
    'public.analytics_raw_id_seq',
    'public.audit_logs_id_seq',
    'public.vote_sessions_id_seq'
  ];
begin
  foreach seq in array seqs loop
    if to_regclass(seq) is not null then
      execute format('revoke all on sequence %s from public, anon, authenticated', seq);
      execute format('grant usage, select on sequence %s to service_role', seq);
    end if;
  end loop;
end $$;

-- 5) Default privileges di `postgres`: i nuovi oggetti in public NON devono
--    essere concessi automaticamente a PUBLIC/anon/authenticated.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;

-- 5b) `supabase_admin`: eseguito solo se il ruolo corrente ne e' membro
--     (guardia; in caso contrario viene saltato senza errore).
do $$
begin
  if pg_has_role(current_user, 'supabase_admin', 'MEMBER') then
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on functions from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public grant all on tables to service_role';
    execute 'alter default privileges for role supabase_admin in schema public grant execute on functions to service_role';
    execute 'alter default privileges for role supabase_admin in schema public grant all on sequences to service_role';
  end if;
end $$;
