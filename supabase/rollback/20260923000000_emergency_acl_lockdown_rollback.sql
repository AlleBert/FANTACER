-- Rollback SICURO del contenimento ACL/policy (20260923000000).
--
-- Questa migration NON ripristina i privilegi pubblici rimossi: farlo
-- riaprirebbe il bypass `anon` su `submit_vote`. Non concede mai privilegi a
-- PUBLIC, `anon` o `authenticated` e non ricrea policy permissive.
--
-- Garantisce soltanto che il percorso server-side (service_role) resti
-- operativo. Se dopo il contenimento un percorso applicativo legittimo smette
-- di funzionare:
--   1. NON allargare i grant;
--   2. identificare il consumer e proporre il grant minimo specifico;
--   3. in emergenza, sospendere il voto (`voting_enabled=false`) invece di
--      ripristinare i privilegi.
--
-- Idempotente; guardie `to_regprocedure`.

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
    'public.get_company_ranking(integer)'
  ];
begin
  foreach sig in array sigs loop
    if to_regprocedure(sig) is not null then
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;
end $$;

-- Grants di sola lettura/scrittura al service_role sulle tabelle legacy
-- (idempotenti, specifici, mai a PUBLIC/anon/authenticated).
grant all on table public.votes           to service_role;
grant all on table public.daily_stats     to service_role;
grant all on table public.device_sessions to service_role;
grant all on table public.analytics_raw   to service_role;
do $$
begin
  if to_regclass('public.settings') is not null then
    execute 'grant all on table public.settings to service_role';
  end if;
  if to_regclass('public.votes_id_seq') is not null then
    execute 'grant usage, select on sequence public.votes_id_seq to service_role';
  end if;
  if to_regclass('public.analytics_raw_id_seq') is not null then
    execute 'grant usage, select on sequence public.analytics_raw_id_seq to service_role';
  end if;
  if to_regclass('public.audit_logs_id_seq') is not null then
    execute 'grant usage, select on sequence public.audit_logs_id_seq to service_role';
  end if;
  if to_regclass('public.vote_sessions_id_seq') is not null then
    execute 'grant usage, select on sequence public.vote_sessions_id_seq to service_role';
  end if;
end $$;
