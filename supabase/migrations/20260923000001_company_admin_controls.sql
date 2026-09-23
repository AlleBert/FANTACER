-- Controlli admin sulle aziende: blocco voto/classifica, cancellazione voti,
-- punteggio manuale e backup dello stato. Idempotente.
-- RLS deny-by-default + grant service_role (coerente con 20260923000000).
--
-- Semantica override punteggio: base + delta live. Al momento dell'impostazione
-- `snapshot_*` cattura i contatori correnti, quindi la classifica mostra
-- esattamente `base_*`; i voti successivi si sommano da lì e la formula regge
-- anche dopo un `recompute_company_totals()`.

-- 1) Flag blocco.
alter table public.companies
  add column if not exists blocked boolean not null default false;
create index if not exists idx_companies_blocked
  on public.companies (blocked) where blocked;

-- 2) Override punteggio (base + snapshot live).
create table if not exists public.company_score_overrides (
  company_id uuid primary key references public.companies(id) on delete cascade,
  base_pallets bigint not null default 0,
  base_votes bigint not null default 0,
  snapshot_pallets bigint not null default 0,
  snapshot_votes bigint not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.company_score_overrides enable row level security;
revoke all on table public.company_score_overrides from public, anon, authenticated;
grant select, insert, update, delete on table public.company_score_overrides to service_role;

-- 3) Backup delle schede cancellate (in DB, atomico col delete).
create table if not exists public.admin_vote_backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  company_ids uuid[] not null,
  reason text,
  row_count integer not null,
  payload jsonb not null
);
alter table public.admin_vote_backups enable row level security;
revoke all on table public.admin_vote_backups from public, anon, authenticated;
grant select, insert on table public.admin_vote_backups to service_role;

-- 4) Backup dello stato (punteggi, blocco, override) prima di ogni azione.
create table if not exists public.admin_state_backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  label text,
  batch text,
  company_ids uuid[],
  payload jsonb not null
);
alter table public.admin_state_backups enable row level security;
revoke all on table public.admin_state_backups from public, anon, authenticated;
grant select, insert on table public.admin_state_backups to service_role;

-- 5) Ranking: esclude bloccate, applica override base+delta.
create or replace function public.get_company_ranking(limit_count int default null)
returns table(id uuid, name text, image_url text, total_pallets bigint, vote_count bigint)
language sql security definer set search_path = public
as $$
  select c.id, c.name, c.image_url,
    coalesce(o.base_pallets + (coalesce(ct.total_pallets, 0) - o.snapshot_pallets),
             coalesce(ct.total_pallets, 0))::bigint as total_pallets,
    coalesce(o.base_votes + (coalesce(ct.vote_count, 0) - o.snapshot_votes),
             coalesce(ct.vote_count, 0))::bigint as vote_count
  from companies c
  left join company_totals ct on ct.company_id = c.id
  left join company_score_overrides o on o.company_id = c.id
  where c.batch = (select active_batch from batch_settings where id = 'default')
    and c.blocked = false
  order by total_pallets desc, c.name asc, c.id asc
  limit limit_count;
$$;
revoke execute on function public.get_company_ranking(integer) from public, anon, authenticated;
grant execute on function public.get_company_ranking(integer) to service_role;

-- 6) submit_vote: rifiuta aziende bloccate (difesa in profondità). Copia di
--    20260921000000 con il solo check blocco aggiunto.
create or replace function public.submit_vote(
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
  if exists (
    select 1 from companies
    where id in (company1_id_param, company2_id_param, company3_id_param)
      and blocked
  ) then
    return jsonb_build_object('success', false, 'error', 'Azienda non disponibile');
  end if;

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
revoke execute on function public.submit_vote(text,text,text,uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.submit_vote(text,text,text,uuid,uuid,uuid,text,text) to service_role;

-- 7) Cancella voti di una o più aziende (backup + recompute + daily_stats + tick).
create or replace function public.admin_delete_company_votes(
  p_company_ids uuid[],
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_count int;
  v_backup_id bigint;
  v_dates date[];
begin
  if p_company_ids is null or array_length(p_company_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'nessuna azienda selezionata');
  end if;

  select coalesce(jsonb_agg(to_jsonb(vs)), '[]'::jsonb), count(*),
         coalesce(array_agg(distinct vs.vote_day), '{}'::date[])
    into v_payload, v_count, v_dates
  from vote_sessions vs
  where vs.company1_id = any(p_company_ids)
     or vs.company2_id = any(p_company_ids)
     or vs.company3_id = any(p_company_ids);

  if v_count = 0 then
    return jsonb_build_object('success', true, 'votes_deleted', 0, 'days', '[]'::jsonb);
  end if;

  insert into admin_vote_backups(company_ids, reason, row_count, payload)
  values (p_company_ids, p_reason, v_count, v_payload)
  returning id into v_backup_id;

  delete from vote_sessions
  where company1_id = any(p_company_ids)
     or company2_id = any(p_company_ids)
     or company3_id = any(p_company_ids);

  perform public.recompute_company_totals();

  delete from daily_stats where date = any(v_dates);
  insert into daily_stats (company_id, date, vote_count, unique_voters)
  select company_id, vote_day, count(*), count(distinct fingerprint)
  from (
    select company1_id as company_id, vote_day, fingerprint from vote_sessions where vote_day = any(v_dates)
    union all
    select company2_id, vote_day, fingerprint from vote_sessions where vote_day = any(v_dates)
    union all
    select company3_id, vote_day, fingerprint from vote_sessions where vote_day = any(v_dates)
  ) t
  group by company_id, vote_day;

  update ranking_tick set version = version + 1, updated_at = now() where id = 1;

  return jsonb_build_object('success', true, 'votes_deleted', v_count,
                            'backup_id', v_backup_id, 'days', to_jsonb(v_dates));
end;
$$;
revoke execute on function public.admin_delete_company_votes(uuid[],text) from public, anon, authenticated;
grant execute on function public.admin_delete_company_votes(uuid[],text) to service_role;

-- 8) Blocco/sblocco.
create or replace function public.admin_set_company_blocked(
  p_company_ids uuid[],
  p_blocked boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_company_ids is null or array_length(p_company_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'nessuna azienda selezionata');
  end if;
  update companies set blocked = p_blocked, updated_at = now()
   where id = any(p_company_ids);
  get diagnostics v_updated = row_count;
  return jsonb_build_object('success', true, 'updated', v_updated, 'blocked', p_blocked);
end;
$$;
revoke execute on function public.admin_set_company_blocked(uuid[],boolean) from public, anon, authenticated;
grant execute on function public.admin_set_company_blocked(uuid[],boolean) to service_role;

-- 9) Imposta punteggio manuale (snapshot = contatore live corrente).
create or replace function public.admin_set_company_score(
  p_company_ids uuid[],
  p_pallets bigint,
  p_votes bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_company_ids is null or array_length(p_company_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'nessuna azienda selezionata');
  end if;
  insert into company_score_overrides
    (company_id, base_pallets, base_votes, snapshot_pallets, snapshot_votes, updated_at)
  select c.id, greatest(p_pallets, 0), greatest(p_votes, 0),
         coalesce(ct.total_pallets, 0), coalesce(ct.vote_count, 0), now()
  from companies c
  left join company_totals ct on ct.company_id = c.id
  where c.id = any(p_company_ids)
  on conflict (company_id) do update set
    base_pallets = excluded.base_pallets,
    base_votes = excluded.base_votes,
    snapshot_pallets = excluded.snapshot_pallets,
    snapshot_votes = excluded.snapshot_votes,
    updated_at = now();
  get diagnostics v_updated = row_count;
  return jsonb_build_object('success', true, 'updated', v_updated);
end;
$$;
revoke execute on function public.admin_set_company_score(uuid[],bigint,bigint) from public, anon, authenticated;
grant execute on function public.admin_set_company_score(uuid[],bigint,bigint) to service_role;

-- 10) Rimuove punteggio manuale (torna ai voti reali).
create or replace function public.admin_clear_company_score(p_company_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if p_company_ids is null or array_length(p_company_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'nessuna azienda selezionata');
  end if;
  delete from company_score_overrides where company_id = any(p_company_ids);
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('success', true, 'cleared', v_deleted);
end;
$$;
revoke execute on function public.admin_clear_company_score(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_clear_company_score(uuid[]) to service_role;

-- 11) Backup dello stato: snapshot di companies + contatori + override.
--     Se p_company_ids è null salva l'intero batch attivo.
create or replace function public.admin_backup_company_state(
  p_company_ids uuid[] default null,
  p_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch text;
  v_payload jsonb;
  v_count int;
  v_id bigint;
begin
  select active_batch into v_batch from batch_settings where id = 'default';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'name', c.name,
           'batch', c.batch,
           'blocked', c.blocked,
           'total_pallets', coalesce(ct.total_pallets, 0),
           'vote_count', coalesce(ct.vote_count, 0),
           'override', case when o.company_id is null then null else jsonb_build_object(
             'base_pallets', o.base_pallets,
             'base_votes', o.base_votes,
             'snapshot_pallets', o.snapshot_pallets,
             'snapshot_votes', o.snapshot_votes,
             'updated_at', o.updated_at
           ) end
         )), '[]'::jsonb), count(*)
    into v_payload, v_count
  from companies c
  left join company_totals ct on ct.company_id = c.id
  left join company_score_overrides o on o.company_id = c.id
  where (p_company_ids is null or c.id = any(p_company_ids))
    and (p_company_ids is not null or c.batch = v_batch);

  insert into admin_state_backups(label, batch, company_ids, payload)
  values (p_label, v_batch, p_company_ids, v_payload)
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'backup_id', v_id,
    'company_count', v_count,
    'payload', v_payload
  );
end;
$$;
revoke execute on function public.admin_backup_company_state(uuid[],text) from public, anon, authenticated;
grant execute on function public.admin_backup_company_state(uuid[],text) to service_role;
