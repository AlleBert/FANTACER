-- Ordine deterministico della classifica pubblica.
-- Niente vote_count come tie-breaker: solo total_pallets (punteggio) e,
-- a parità, nome alfabetico e id (UUID). Il rank 1-based deriva dalla
-- posizione nell'array ordinato: nessun pari merito.

create or replace function get_company_ranking(limit_count int default null)
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
  where c.batch = (select active_batch from batch_settings where id = 'default')
  group by c.id, c.name, c.image_url
  order by total_pallets desc, name asc, id asc
  limit limit_count;
$$;
