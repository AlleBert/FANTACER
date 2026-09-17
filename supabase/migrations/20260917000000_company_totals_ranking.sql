-- Classifica O(1): contatori incrementali per azienda.
--
-- `get_company_ranking` calcolava l'aggregato su tutte le `vote_sessions` a ogni
-- chiamata (O(voti)): 301k righe lette e 242k buffer toccati per chiamata a
-- 100k voti. Con letture frequenti (polling/realtime) saturava il percorso DB.
--
-- Soluzione: tabella `company_totals` mantenuta da un trigger dedicato, separato
-- da `trg_bump_ranking_tick` (realtime). Lettura = 312 lookup su primary key.
--
-- Applicare in una sola transazione: il `lock` impedisce che voti concorrenti
-- tra il backfill e l'attivazione del trigger restino fuori dai contatori.

lock table public.vote_sessions in access exclusive mode;

create table if not exists public.company_totals (
  company_id uuid primary key references public.companies(id) on delete cascade,
  total_pallets bigint not null default 0,
  vote_count bigint not null default 0
);

alter table public.company_totals enable row level security;

comment on table public.company_totals is
  'Aggregati per azienda (pallet pesati 4/2/1 e numero di sessioni). Mantenuti dal trigger trg_maintain_company_totals su vote_sessions. Accesso solo via RPC/get_company_ranking (SECURITY DEFINER) e service_role.';

-- Trigger dedicato: aggiorna i contatori a ogni INSERT/UPDATE/DELETE di vote_sessions.
create or replace function public.maintain_company_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  ids uuid[];
begin
  if tg_op = 'INSERT' then
    ids := array[new.company1_id, new.company2_id, new.company3_id];
  elsif tg_op = 'DELETE' then
    ids := array[old.company1_id, old.company2_id, old.company3_id];
  else
    ids := array[
      new.company1_id, new.company2_id, new.company3_id,
      old.company1_id, old.company2_id, old.company3_id
    ];
  end if;

  -- Lock ordering canonico: evita deadlock tra voti concorrenti.
  perform 1 from public.company_totals
   where company_id = any(ids)
   order by company_id
   for update;

  if tg_op in ('DELETE', 'UPDATE') then
    update public.company_totals ct
       set total_pallets = ct.total_pallets - v.pallets,
           vote_count    = ct.vote_count - 1
      from (
        select old.company1_id as company_id, old.pallet1::bigint as pallets
        union all select old.company2_id, old.pallet2::bigint
        union all select old.company3_id, old.pallet3::bigint
      ) v
     where ct.company_id = v.company_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.company_totals (company_id, total_pallets, vote_count)
    select company_id, sum(pallets)::bigint, count(*)::bigint
      from (
        select new.company1_id as company_id, new.pallet1::bigint as pallets
        union all select new.company2_id, new.pallet2::bigint
        union all select new.company3_id, new.pallet3::bigint
      ) t
     group by company_id
    on conflict (company_id) do update
      set total_pallets = public.company_totals.total_pallets + excluded.total_pallets,
          vote_count    = public.company_totals.vote_count + excluded.vote_count;
  end if;

  return null;
end;
$function$;

drop trigger if exists trg_maintain_company_totals on public.vote_sessions;
create trigger trg_maintain_company_totals
  after insert or update or delete on public.vote_sessions
  for each row execute function public.maintain_company_totals();

-- Ricalcolo completo: per operazioni massive (seed/cleanup) e per sanare drift.
create or replace function public.recompute_company_totals()
returns void
language sql
security definer
set search_path = public
as $function$
  truncate table public.company_totals;
  insert into public.company_totals (company_id, total_pallets, vote_count)
  select company_id, sum(pallets)::bigint, count(*)::bigint
  from (
    select company1_id as company_id, pallet1::bigint as pallets from public.vote_sessions
    union all
    select company2_id, pallet2::bigint from public.vote_sessions
    union all
    select company3_id, pallet3::bigint from public.vote_sessions
  ) t
  group by company_id;
$function$;

revoke execute on function public.recompute_company_totals() from public, anon, authenticated;
grant execute on function public.recompute_company_totals() to service_role;

-- Backfill dai voti esistenti (idempotente).
insert into public.company_totals (company_id, total_pallets, vote_count)
select company_id, sum(pallets)::bigint, count(*)::bigint
from (
  select company1_id as company_id, pallet1::bigint as pallets from public.vote_sessions
  union all
  select company2_id, pallet2::bigint from public.vote_sessions
  union all
  select company3_id, pallet3::bigint from public.vote_sessions
) t
group by company_id
on conflict (company_id) do update
  set total_pallets = excluded.total_pallets,
      vote_count    = excluded.vote_count;

-- RPC: stessa firma, legge i contatori. Tie-breaker deterministico allineato
-- al commento in src/app/api/public/ranking/route.ts.
create or replace function public.get_company_ranking(limit_count int default null)
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
as $function$
  select c.id, c.name, c.image_url,
    coalesce(ct.total_pallets, 0)::bigint as total_pallets,
    coalesce(ct.vote_count, 0)::bigint as vote_count
  from companies c
  left join company_totals ct on ct.company_id = c.id
  where c.batch = (select active_batch from batch_settings where id = 'default')
  order by total_pallets desc, name asc, id asc
  limit limit_count;
$function$;
