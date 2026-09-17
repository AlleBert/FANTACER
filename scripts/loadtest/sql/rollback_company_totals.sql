-- Rollback manuale della migration 20260917000000_company_totals_ranking.
-- NON viene applicato da `db push`: eseguirlo a mano solo se necessario.
begin;

drop trigger if exists trg_maintain_company_totals on public.vote_sessions;
drop function if exists public.maintain_company_totals();
drop function if exists public.recompute_company_totals();

-- Ripristina la RPC precedente (aggregazione O(voti), senza tie-breaker).
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
    coalesce(sum(case
      when vs.company1_id = c.id then vs.pallet1
      when vs.company2_id = c.id then vs.pallet2
      when vs.company3_id = c.id then vs.pallet3
      else 0
    end), 0)::bigint as total_pallets,
    count(vs.id)::bigint as vote_count
  from companies c
  left join vote_sessions vs on c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
  where c.batch = (select active_batch from batch_settings where id = 'default')
  group by c.id, c.name, c.image_url
  order by total_pallets desc
  limit limit_count;
$function$;

drop table if exists public.company_totals;

commit;
