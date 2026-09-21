-- Allinea il confine giornaliero del voto al fuso Europe/Rome.
--
-- La dedup atomica (20260918000000) usa `vote_day` in UTC: il reset avviene a
-- mezzanotte UTC = 02:00 italiane (CEST), disallineato rispetto a panoramica e
-- report che usano Europe/Rome. Questa migration sposta il confine a mezzanotte
-- locale.
--
-- Fail-safe: la conversione UTC -> Roma può creare gruppi (fingerprint, giorno)
-- duplicati per i voti nella finestra 00:00-02:00 locali; in tal caso la
-- migration si interrompe senza modificare i dati (bonifica manuale separata).

do $$
declare
  dup_count bigint;
begin
  select count(*) into dup_count
  from (
    select fingerprint, (created_at at time zone 'Europe/Rome')::date as day
    from public.vote_sessions
    group by fingerprint, (created_at at time zone 'Europe/Rome')::date
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      'Trovati % gruppi (fingerprint, giorno Roma) duplicati: bonifica manuale richiesta prima di uq_vote_sessions_fingerprint_day',
      dup_count;
  end if;
end $$;

-- La colonna generata non può essere modificata in place: drop + re-add
-- (l'indice unico dipende dalla colonna e cade con essa).
drop index if exists uq_vote_sessions_fingerprint_day;
alter table public.vote_sessions drop column if exists vote_day;
alter table public.vote_sessions
  add column vote_day date
    generated always as ((created_at at time zone 'Europe/Rome')::date) stored;

create unique index if not exists uq_vote_sessions_fingerprint_day
  on public.vote_sessions (fingerprint, vote_day);

-- RPC: fast-path e daily_stats sul giorno di Roma.
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
  vote_day_param date := (now() at time zone 'Europe/Rome')::date;
begin
  select exists (
    select 1 from vote_sessions
    where fingerprint = fingerprint_param
      and vote_day = vote_day_param
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
    (company1_id_param, vote_day_param, 1, 1),
    (company2_id_param, vote_day_param, 1, 1),
    (company3_id_param, vote_day_param, 1, 1)
  on conflict (company_id, date)
  do update set
    vote_count = daily_stats.vote_count + 1,
    unique_voters = daily_stats.unique_voters + 1;

  insert into audit_logs (event_type, fingerprint, ip_address, metadata)
  values
    ('vote_submitted',
     fingerprint_param,
     ip_param,
     jsonb_build_object(
       'company1', company1_id_param,
       'company2', company2_id_param,
       'company3', company3_id_param,
       'botd', coalesce(botd_param, '')
     ));

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;
