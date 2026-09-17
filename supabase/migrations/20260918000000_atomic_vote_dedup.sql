-- Dedup atomico del voto giornaliero.
--
-- Il check `select exists(...)` seguito da `insert` nella RPC `submit_vote` non
-- è atomico: due richieste concorrenti con lo stesso fingerprint (doppio tap,
-- retry di rete durante un timeout) possono superare entrambe il check e
-- inserire due sessioni. Una colonna generata `vote_day` + indice unico
-- spostano l'arbitraggio sull'INSERT: il secondo inserimento fallisce con
-- `unique_violation`, gestita dalla RPC come "Hai già votato oggi".
--
-- Nota sui fusi: `created_at::date` dipende dal TimeZone di sessione (STABLE,
-- non ammesso in una colonna generata). La conversione esplicita a UTC è
-- immutabile ed è equivalente al comportamento precedente (le sessioni Supabase
-- girano in UTC), oltre che coerente con `utcDayBounds()` di /api/vota/status.
--
-- Sicurezza dati: se esistono già gruppi (fingerprint, vote_day) duplicati
-- l'indice NON viene creato e la migrazione fallisce con un conteggio esplicito.
-- La bonifica non è automatica: è una decisione operativa separata.

alter table public.vote_sessions
  add column if not exists vote_day date
    generated always as ((created_at at time zone 'UTC')::date) stored;

do $$
declare
  dup_count bigint;
begin
  select count(*) into dup_count
  from (
    select fingerprint, vote_day
    from public.vote_sessions
    group by fingerprint, vote_day
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      'Trovati % gruppi (fingerprint, vote_day) duplicati: bonifica manuale richiesta prima di creare uq_vote_sessions_fingerprint_day',
      dup_count;
  end if;
end $$;

create unique index if not exists uq_vote_sessions_fingerprint_day
  on public.vote_sessions (fingerprint, vote_day);

-- RPC: fast-path sul nuovo indice + gestione atomica della race.
create or replace function submit_vote(
  fingerprint_param text,
  ip_param text,
  user_agent_param text,
  company1_id_param uuid,
  company2_id_param uuid,
  company3_id_param uuid,
  country_param text default 'IT',
  botd_param text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  already_voted boolean;
begin
  select exists (
    select 1 from vote_sessions
    where fingerprint = fingerprint_param
      and vote_day = (now() at time zone 'UTC')::date
  ) into already_voted;

  if already_voted then
    return jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  end if;

  insert into vote_sessions (
    fingerprint, ip_hash, user_agent, country,
    company1_id, company2_id, company3_id
  ) values (
    fingerprint_param,
    md5(ip_param),
    user_agent_param,
    country_param,
    company1_id_param,
    company2_id_param,
    company3_id_param
  );

  insert into daily_stats (company_id, date, vote_count, unique_voters)
  values
    (company1_id_param, current_date, 1, 1),
    (company2_id_param, current_date, 1, 1),
    (company3_id_param, current_date, 1, 1)
  on conflict (company_id, date)
  do update set
    vote_count = daily_stats.vote_count + 1,
    unique_voters = daily_stats.unique_voters + 1;

  insert into audit_logs (event_type, fingerprint, ip_address, metadata)
  values (
    'vote_submitted',
    fingerprint_param,
    ip_param,
    jsonb_build_object(
      'company1', company1_id_param,
      'company2', company2_id_param,
      'company3', company3_id_param,
      'botd', coalesce(botd_param, '')
    )
  );

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    -- Race persa: un'altra richiesta dello stesso fingerprint ha vinto il giorno.
    return jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;
