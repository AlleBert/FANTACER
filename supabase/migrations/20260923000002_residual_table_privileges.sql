-- Hardening residuo: revoca dei grant di tabella diretti ad anon/authenticated
-- su `vote_sessions` e `rate_limits` (difesa in profondità, non solo RLS).
--
-- Contesto: dopo il contenimento 20260923000000 queste due tabelle hanno ancora
-- i grant impliciti Supabase per anon/authenticated. RLS le limita (policy
-- service_role-only), ma il grant diretto resta una superficie inutile.
--
-- Vincoli:
--  - nessun `GRANT ALL`: a service_role si assegnano solo SELECT/INSERT/UPDATE/DELETE;
--  - revoca da PUBLIC, anon, authenticated (PUBLIC per i privilegi ereditati);
--  - sequence solo se realmente necessaria (usage, select);
--  - idempotente, guardie `to_regclass`.

do $$
declare
  t text;
  tbls text[] := array['public.vote_sessions', 'public.rate_limits'];
begin
  foreach t in array tbls loop
    if to_regclass(t) is not null then
      execute format('revoke all on table %s from public, anon, authenticated', t);
      execute format('grant select, insert, update, delete on table %s to service_role', t);
    end if;
  end loop;
end $$;

-- Sequence di vote_sessions: già revocata dal contenimento; mantenuta esplicita
-- e con grant minimo (usage, select), mai GRANT ALL.
do $$
begin
  if to_regclass('public.vote_sessions_id_seq') is not null then
    execute 'revoke all on sequence public.vote_sessions_id_seq from public, anon, authenticated';
    execute 'grant usage, select on sequence public.vote_sessions_id_seq to service_role';
  end if;
end $$;
