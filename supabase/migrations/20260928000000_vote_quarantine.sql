-- C11 / FASE E — Stati del voto (accepted|quarantined|rejected), totali
-- exact-once, RPC admin di review e riconciliazione.
--
-- Scope (plan docs/superpowers/plans/2026-09-24-fine-sicurezza-voto-p0-4-p1.md,
-- §4.3 "Semantica di accepted/quarantined/rejected" e §E-totali):
--   E1  colonne `status`, review (attore/ts/motivo) e `risk_findings` tipizzati.
--   E2  trigger `trg_maintain_company_totals` riscritto: `company_totals` riflette
--       SOLO i voti `accepted`, aggiornato esattamente una volta per transizione
--       reale (`old.status is distinct from new.status`).
--   E3  RPC admin `admin_review_vote` (idempotente), `admin_reconcile_totals`
--       (idempotente) e `admin_quarantine_counts` (conteggi per UI).
--
-- Additiva e **re-runnable/idempotente** (`if not exists` + `create or replace` +
-- guardie su `pg_constraint`): applicabile piu' volte senza effetti collaterali.
-- Nessun BEGIN/COMMIT esplicito (runner transazionale). Nessun dato cancellato.
--
-- Exact-once (come e' garantito):
--   * INSERT accepted            -> +delta (una volta);
--   * INSERT quarantined/rejected-> 0;
--   * UPDATE accepted->non-accepted -> -delta;
--   * UPDATE non-accepted->accepted -> +delta;
--   * UPDATE same status         -> 0 (early return, nessun tocco);
--   * DELETE accepted            -> -delta; DELETE non-accepted -> 0.
--   Il delta e' applicato dal trigger in modo incrementale: nessun ricalcolo,
--   nessun doppio conteggio. `recompute_company_totals()` ricalcola da zero dai
--   soli `accepted` (idempotente) e viene usato da `admin_reconcile_totals`.
--
-- `daily_stats` (decisione esplicita): **NON** viene accoppiato allo stato in
-- questa migration. `daily_stats` resta mantenuto dai percorsi di INSERT
-- esistenti (legacy `submit_vote` e `submit_vote_v2` inseriscono `accepted` per
-- default, quindi oggi coincide con gli accepted). Spostarlo nel trigger
-- exact-once richiederebbe di riscrivere ogni percorso di scrittura (inclusi gli
-- overload legacy) per evitare doppi conteggi: fuori scope e rischioso. Nota di
-- follow-up: quando la quarantena sara' applicata in `submit_vote_v2`, il suo
-- upsert su `daily_stats` andra' condizionato a `status='accepted'` (e la review
-- admin dovra' riflettere la transizione). Il ranking fa fede su
-- `company_totals` (accepted-only), che e' l'invariante di questa migration.

-- ---------------------------------------------------------------------------
-- 1) E1 — Stati + campi di review + risk findings tipizzati
-- ---------------------------------------------------------------------------
alter table public.vote_sessions
  add column if not exists status text not null default 'accepted',
  add column if not exists review_actor text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_reason text,
  add column if not exists risk_findings jsonb;

comment on column public.vote_sessions.status is
  'C11: stato del voto — accepted (default, conteggiato), quarantined, rejected (esclusi da classifica/totali; consumano comunque l''unicita'' giornaliera).';
comment on column public.vote_sessions.review_actor is
  'C11: attore della revisione admin (es. email/id admin). NULL per voti non rivisti.';
comment on column public.vote_sessions.reviewed_at is
  'C11: timestamp dell''ultima transizione di stato operata dalla review admin.';
comment on column public.vote_sessions.review_reason is
  'C11: motivazione testuale della review admin.';
comment on column public.vote_sessions.risk_findings is
  'C11: findings di rischio tipizzati, fixed-schema e server-derived (mai impostabili dal client). Schema logico: oggetto con campi noti; nullable.';

-- Vincolo di dominio sullo stato (idempotente: la ADD CONSTRAINT non supporta
-- `if not exists`, quindi guardia esplicita su pg_constraint).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.vote_sessions'::regclass
       and conname = 'vote_sessions_status_check'
  ) then
    alter table public.vote_sessions
      add constraint vote_sessions_status_check
      check (status in ('accepted', 'quarantined', 'rejected'));
  end if;

  -- `risk_findings` deve essere un oggetto JSON (o null): niente array/scalari.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.vote_sessions'::regclass
       and conname = 'vote_sessions_risk_findings_check'
  ) then
    alter table public.vote_sessions
      add constraint vote_sessions_risk_findings_check
      check (risk_findings is null or jsonb_typeof(risk_findings) = 'object');
  end if;
end $$;

-- Indice per la lista/quarantena admin (conteggi e lista filtrata per stato/giorno).
create index if not exists idx_vote_sessions_status_day
  on public.vote_sessions (status, vote_day);

-- ---------------------------------------------------------------------------
-- 2) E2 — Trigger totali exact-once (solo accepted)
-- ---------------------------------------------------------------------------
create or replace function public.maintain_company_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  ids uuid[];
begin
  -- INSERT: conta una sola volta, e solo se il voto nasce `accepted`.
  if tg_op = 'INSERT' then
    if new.status is distinct from 'accepted' then
      return null;
    end if;

    ids := array[new.company1_id, new.company2_id, new.company3_id];
    -- Lock ordering canonico: evita deadlock tra voti concorrenti.
    perform 1 from public.company_totals
     where company_id = any(ids)
     order by company_id
     for update;

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

    return null;
  end if;

  -- DELETE: sottrae solo se la riga uscente era `accepted`.
  if tg_op = 'DELETE' then
    if old.status is distinct from 'accepted' then
      return null;
    end if;

    ids := array[old.company1_id, old.company2_id, old.company3_id];
    perform 1 from public.company_totals
     where company_id = any(ids)
     order by company_id
     for update;

    update public.company_totals ct
       set total_pallets = ct.total_pallets - v.pallets,
           vote_count    = ct.vote_count - 1
      from (
        select old.company1_id as company_id, old.pallet1::bigint as pallets
        union all select old.company2_id, old.pallet2::bigint
        union all select old.company3_id, old.pallet3::bigint
      ) v
     where ct.company_id = v.company_id;

    return null;
  end if;

  -- UPDATE: si applica un delta SOLO a una transizione reale di stato.
  -- (`old.status is distinct from new.status`). Le colonne della scheda
  -- (aziende/pallet) sono immutabili per costruzione: nessun altro caso.
  if old.status is not distinct from new.status then
    return null;
  end if;

  ids := array[
    old.company1_id, old.company2_id, old.company3_id,
    new.company1_id, new.company2_id, new.company3_id
  ];
  perform 1 from public.company_totals
   where company_id = any(ids)
   order by company_id
   for update;

  if old.status = 'accepted' then
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

  if new.status = 'accepted' then
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

-- Trigger gia' esistente: ricreato in modo idempotente (stessa firma/eventi).
drop trigger if exists trg_maintain_company_totals on public.vote_sessions;
create trigger trg_maintain_company_totals
  after insert or update or delete on public.vote_sessions
  for each row execute function public.maintain_company_totals();

-- Ricalcolo completo dai soli `accepted` (idempotente). Usato da
-- `admin_reconcile_totals` e dalle operazioni massive (seed/cleanup).
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
    select company1_id as company_id, pallet1::bigint as pallets
      from public.vote_sessions where status = 'accepted'
    union all
    select company2_id, pallet2::bigint
      from public.vote_sessions where status = 'accepted'
    union all
    select company3_id, pallet3::bigint
      from public.vote_sessions where status = 'accepted'
  ) t
  group by company_id;
$function$;

revoke execute on function public.recompute_company_totals() from public, anon, authenticated;
grant execute on function public.recompute_company_totals() to service_role;

-- ---------------------------------------------------------------------------
-- 3) E3 — RPC admin
-- ---------------------------------------------------------------------------

-- 3a) Review di un voto: transizione di stato idempotente con audit.
--     - valida lo stato target;
--     - se lo stato coincide con quello corrente → no-op (nessun doppio delta);
--     - altrimenti aggiorna stato + campi review (il trigger applica il delta).
create or replace function public.admin_review_vote(
  p_vote_id bigint,
  p_status text,
  p_actor text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_prev text;
begin
  if p_status is null or p_status not in ('accepted', 'quarantined', 'rejected') then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_status',
      'message', 'Stato non valido');
  end if;

  select status into v_prev
    from public.vote_sessions
   where id = p_vote_id
   for update;

  if not found then
    return jsonb_build_object(
      'success', false, 'code', 'vote_not_found',
      'message', 'Voto non trovato');
  end if;

  if v_prev is not distinct from p_status then
    return jsonb_build_object(
      'success', true,
      'vote_id', p_vote_id,
      'previous_status', v_prev,
      'status', v_prev,
      'changed', false,
      'idempotent', true);
  end if;

  update public.vote_sessions
     set status = p_status,
         review_actor = p_actor,
         reviewed_at = now(),
         review_reason = p_reason
   where id = p_vote_id;

  return jsonb_build_object(
    'success', true,
    'vote_id', p_vote_id,
    'previous_status', v_prev,
    'status', p_status,
    'changed', true,
    'idempotent', false);
end;
$fn$;

comment on function public.admin_review_vote(bigint, text, text, text) is
  'C11: transizione di stato di un voto (idempotente). Solo service_role.';

-- 3b) Riconciliazione totali: ricalcolo completo dai soli accepted.
--     Riporta il diff (per azienda) rilevato PRIMA del ricalcolo; idempotente:
--     al secondo run `changed=false` e `before == after`.
create or replace function public.admin_reconcile_totals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_before jsonb;
  v_after jsonb;
  v_changed bigint;
  v_deltas jsonb;
begin
  select jsonb_build_object(
           'companies', count(*),
           'total_pallets', coalesce(sum(total_pallets), 0),
           'vote_count', coalesce(sum(vote_count), 0))
    into v_before
    from public.company_totals;

  with expected as (
    select company_id, sum(pallets)::bigint as total_pallets, count(*)::bigint as vote_count
    from (
      select company1_id as company_id, pallet1::bigint as pallets
        from public.vote_sessions where status = 'accepted'
      union all
      select company2_id, pallet2::bigint
        from public.vote_sessions where status = 'accepted'
      union all
      select company3_id, pallet3::bigint
        from public.vote_sessions where status = 'accepted'
    ) t
    group by company_id
  ),
  ids as (
    select company_id from public.company_totals
    union
    select company_id from expected
  ),
  diff as (
    select i.company_id,
           coalesce(ct.total_pallets, 0) as cur_pallets,
           coalesce(e.total_pallets, 0)  as exp_pallets,
           coalesce(ct.vote_count, 0)    as cur_votes,
           coalesce(e.vote_count, 0)     as exp_votes
      from ids i
      left join public.company_totals ct on ct.company_id = i.company_id
      left join expected e on e.company_id = i.company_id
     where coalesce(ct.total_pallets, 0) is distinct from coalesce(e.total_pallets, 0)
        or coalesce(ct.vote_count, 0)   is distinct from coalesce(e.vote_count, 0)
  )
  select count(*),
         coalesce(jsonb_agg(jsonb_build_object(
           'company_id', company_id,
           'pallets_delta', exp_pallets - cur_pallets,
           'votes_delta', exp_votes - cur_votes)), '[]'::jsonb)
    into v_changed, v_deltas
    from diff;

  perform public.recompute_company_totals();

  select jsonb_build_object(
           'companies', count(*),
           'total_pallets', coalesce(sum(total_pallets), 0),
           'vote_count', coalesce(sum(vote_count), 0))
    into v_after
    from public.company_totals;

  return jsonb_build_object(
    'success', true,
    'changed', v_changed > 0,
    'companies_changed', v_changed,
    'before', v_before,
    'after', v_after,
    'deltas', v_deltas);
end;
$fn$;

comment on function public.admin_reconcile_totals() is
  'C11: ricalcolo idempotente di company_totals dai soli accepted, con report before/after. Solo service_role.';

-- 3c) Conteggi per la UI admin: totali per stato + dettaglio per giorno.
create or replace function public.admin_quarantine_counts(p_days int default 30)
returns jsonb
language sql
security definer
set search_path = public
as $fn$
  with counts as (
    select status, count(*)::bigint as n
      from public.vote_sessions
     group by status
  ),
  by_day as (
    select vote_day,
           count(*) filter (where status = 'accepted')::bigint    as accepted,
           count(*) filter (where status = 'quarantined')::bigint as quarantined,
           count(*) filter (where status = 'rejected')::bigint    as rejected
      from public.vote_sessions
     group by vote_day
     order by vote_day desc
     limit greatest(coalesce(p_days, 30), 1)
  )
  select jsonb_build_object(
    'success', true,
    'totals', jsonb_build_object(
      'accepted', coalesce((select n from counts where status = 'accepted'), 0),
      'quarantined', coalesce((select n from counts where status = 'quarantined'), 0),
      'rejected', coalesce((select n from counts where status = 'rejected'), 0),
      'total', (select coalesce(sum(n), 0) from counts)
    ),
    'by_day', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'vote_day', vote_day,
                'accepted', accepted,
                'quarantined', quarantined,
                'rejected', rejected)
              order by vote_day desc)
         from by_day),
      '[]'::jsonb)
  );
$fn$;

comment on function public.admin_quarantine_counts(int) is
  'C11: conteggi voti per stato (+ per giorno) per la UI admin. Solo service_role.';

-- ---------------------------------------------------------------------------
-- 4) ACL: solo service_role puo' eseguire le RPC admin.
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_review_vote(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_review_vote(bigint, text, text, text)
  to service_role;

revoke execute on function public.admin_reconcile_totals()
  from public, anon, authenticated;
grant execute on function public.admin_reconcile_totals()
  to service_role;

revoke execute on function public.admin_quarantine_counts(int)
  from public, anon, authenticated;
grant execute on function public.admin_quarantine_counts(int)
  to service_role;
