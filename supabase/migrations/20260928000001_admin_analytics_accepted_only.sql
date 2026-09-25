-- C11 review — analytics admin coerente con la classifica accepted-only.
--
-- Dopo C11 (`20260928000000_vote_quarantine.sql`) `company_totals`/ranking
-- contano SOLO i voti `status = 'accepted'`, ma le RPC di analytics admin
-- scansionavano `vote_sessions` senza filtro di stato: una volta popolata la
-- quarantena avrebbero conteggiato anche `quarantined`/`rejected`.
--
-- Questa migration `create or replace` le due RPC aggiungendo il filtro
-- `vs.status = 'accepted'` alla CTE `eff` ("scheda effettiva"). NON modifica la
-- migration storica `20260923000003_admin_analytics_rpc.sql`.
--
-- Additiva, **re-runnable/idempotente** (`create or replace` + `revoke/grant`),
-- nessun dato toccato, nessun BEGIN/COMMIT esplicito. ACL invariata:
-- solo `service_role`.

-- 1) Summary per KPI card + grafico (solo accepted).
create or replace function public.admin_analytics_summary(p_batch text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with eff as (
  select vs.created_at, vs.fingerprint
  from public.vote_sessions vs
  where vs.status = 'accepted'
  and not exists (
    select 1 from public.companies c
    where c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
      and c.blocked
  )
  and (
    p_batch is null or p_batch = '' or p_batch = 'all' or exists (
      select 1 from public.companies c
      where c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
        and c.batch = p_batch
    )
  )
),
days as (
  select generate_series(
    ((now() at time zone 'Europe/Rome')::date - 29),
    ((now() at time zone 'Europe/Rome')::date),
    interval '1 day'
  )::date as day
),
daily as (
  select (created_at at time zone 'Europe/Rome')::date as day,
         count(*)::bigint as votes,
         count(distinct fingerprint)::bigint as voters
  from eff group by 1
),
hourly as (
  select (created_at at time zone 'Europe/Rome')::date as day,
         extract(hour from (created_at at time zone 'Europe/Rome'))::int as hour,
         count(*)::bigint as votes
  from eff
  where (created_at at time zone 'Europe/Rome')::date >= (now() at time zone 'Europe/Rome')::date - 29
  group by 1, 2
)
select jsonb_build_object(
  'totalVotes', (select count(*) from eff),
  'uniqueVoters', (select count(distinct fingerprint) from eff),
  'todayVotes', (select count(*) from eff
     where (created_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date),
  'yesterdayVotes', (select count(*) from eff
     where (created_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date - 1),
  'activeNow', (select count(*) from eff where created_at >= now() - interval '15 minutes'),
  'dailyStats', coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', to_char(d.day, 'YYYY-MM-DD'),
             'vote_count', coalesce(dl.votes, 0),
             'unique_voters', coalesce(dl.voters, 0)
           ) order by d.day)
    from days d left join daily dl on dl.day = d.day
  ), '[]'::jsonb),
  'hourlyByDay', coalesce((
    select jsonb_object_agg(hd.day, hd.buckets)
    from (
      select h.day::text as day,
             jsonb_agg(jsonb_build_object('hour', g.hour, 'votes', coalesce(ho.votes, 0)) order by g.hour) as buckets
      from (select distinct day from hourly) h
      cross join generate_series(0, 23) as g(hour)
      left join hourly ho on ho.day = h.day and ho.hour = g.hour
      group by h.day
    ) hd
  ), '{}'::jsonb)
);
$$;
revoke execute on function public.admin_analytics_summary(text) from public, anon, authenticated;
grant execute on function public.admin_analytics_summary(text) to service_role;

-- 2) Statistiche per-azienda (pagina Aziende): punti effettivi + trend (solo accepted).
create or replace function public.admin_company_stats(p_batch text default null)
returns table(
  id uuid,
  name text,
  category text,
  image_url text,
  effective_pallets bigint,
  effective_votes bigint,
  today_votes integer,
  yesterday_votes integer,
  blocked boolean,
  has_override boolean
)
language sql
stable
security definer
set search_path = public
as $$
with eff as (
  select vs.company1_id, vs.company2_id, vs.company3_id, vs.created_at
  from public.vote_sessions vs
  where vs.status = 'accepted'
  and not exists (
    select 1 from public.companies c
    where c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
      and c.blocked
  )
  and (
    p_batch is null or p_batch = '' or p_batch = 'all' or exists (
      select 1 from public.companies c
      where c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
        and c.batch = p_batch
    )
  )
),
per as (
  select company_id, created_at from (
    select company1_id as company_id, created_at from eff
    union all select company2_id, created_at from eff
    union all select company3_id, created_at from eff
  ) t
),
daily as (
  select company_id,
    count(*) filter (where (created_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date)::int as today_votes,
    count(*) filter (where (created_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date - 1)::int as yesterday_votes
  from per group by company_id
)
select c.id, c.name, c.category, c.image_url,
  coalesce(o.base_pallets + (coalesce(ct.total_pallets, 0) - o.snapshot_pallets),
           coalesce(ct.total_pallets, 0))::bigint as effective_pallets,
  coalesce(o.base_votes + (coalesce(ct.vote_count, 0) - o.snapshot_votes),
           coalesce(ct.vote_count, 0))::bigint as effective_votes,
  coalesce(d.today_votes, 0) as today_votes,
  coalesce(d.yesterday_votes, 0) as yesterday_votes,
  c.blocked,
  (o.company_id is not null) as has_override
from public.companies c
left join public.company_totals ct on ct.company_id = c.id
left join public.company_score_overrides o on o.company_id = c.id
left join daily d on d.company_id = c.id
where p_batch is null or p_batch = '' or p_batch = 'all' or c.batch = p_batch;
$$;
revoke execute on function public.admin_company_stats(text) from public, anon, authenticated;
grant execute on function public.admin_company_stats(text) to service_role;
