-- Migration: Add sponsors and vote_sessions tables
-- Date: 2026-07-18

-- ========== SPONSORS ==========

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  website_url text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sponsors enable row level security;

drop policy if exists "sponsors_public_select" on sponsors;
create policy "sponsors_public_select" on sponsors
  for select using (is_active = true);

drop policy if exists "sponsors_service_insert" on sponsors;
create policy "sponsors_service_insert" on sponsors
  for insert to service_role with check (true);

drop policy if exists "sponsors_service_update" on sponsors;
create policy "sponsors_service_update" on sponsors
  for update to service_role using (true) with check (true);

drop policy if exists "sponsors_service_delete" on sponsors;
create policy "sponsors_service_delete" on sponsors
  for delete to service_role using (true);

-- ========== VOTE SESSIONS ==========

create table if not exists vote_sessions (
  id bigint primary key generated always as identity,
  fingerprint text not null,
  ip_hash text,
  user_agent text,
  country text default 'IT',
  company1_id uuid not null references companies(id) on delete cascade,
  company2_id uuid not null references companies(id) on delete cascade,
  company3_id uuid not null references companies(id) on delete cascade,
  pallet1 integer not null default 4 check (pallet1 = 4),
  pallet2 integer not null default 2 check (pallet2 = 2),
  pallet3 integer not null default 1 check (pallet3 = 1),
  created_at timestamptz default now(),
  constraint different_companies check (
    company1_id != company2_id and
    company1_id != company3_id and
    company2_id != company3_id
  )
);

create index if not exists idx_vote_sessions_fingerprint
  on vote_sessions(fingerprint, created_at desc);
create index if not exists idx_vote_sessions_company1
  on vote_sessions(company1_id);
create index if not exists idx_vote_sessions_company2
  on vote_sessions(company2_id);
create index if not exists idx_vote_sessions_company3
  on vote_sessions(company3_id);

alter table vote_sessions enable row level security;

drop policy if exists "vote_sessions_service_select" on vote_sessions;
create policy "vote_sessions_service_select" on vote_sessions
  for select to service_role using (true);

drop policy if exists "vote_sessions_service_insert" on vote_sessions;
create policy "vote_sessions_service_insert" on vote_sessions
  for insert to service_role with check (true);

-- ========== CLEANUP OLD VOTES COLUMNS ==========

alter table votes
  drop column if exists comment,
  drop column if exists adjective,
  drop column if exists slider_innovation,
  drop column if exists slider_sales,
  drop column if exists slider_wow;

-- ========== DAILY STATS: ADD UNIQUE VOTERS ==========

alter table daily_stats
  add column if not exists unique_voters integer default 0;

-- ========== RPC: SUBMIT VOTE ==========

create or replace function submit_vote(
  fingerprint_param text,
  ip_param text,
  user_agent_param text,
  country_param text default 'IT',
  company1_id_param uuid,
  company2_id_param uuid,
  company3_id_param uuid
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
      and created_at::date = current_date
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
      'company3', company3_id_param
    )
  );

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ========== RANKING RPC ==========

create or replace function get_company_ranking(limit_count int default 10)
returns table(
  id uuid,
  name text,
  image_url text,
  total_pallets bigint,
  vote_count bigint
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.image_url,
    coalesce(sum(case
      when vs.company1_id = c.id then vs.pallet1
      when vs.company2_id = c.id then vs.pallet2
      when vs.company3_id = c.id then vs.pallet3
      else 0
    end), 0)::bigint as total_pallets,
    count(vs.id)::bigint as vote_count
  from companies c
  left join vote_sessions vs on c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
  group by c.id, c.name, c.image_url
  order by total_pallets desc
  limit limit_count;
$$;
