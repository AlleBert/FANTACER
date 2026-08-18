-- Migration: Admin RPC to reset votes (all or per-batch)
-- Date: 2026-08-16
-- Security: execute restricted to service_role only (destructive admin action).
-- Atomic: single function = single transaction; audit_logs is never touched.

create or replace function admin_reset_votes(
  p_scope text,
  p_batch text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_votes_deleted bigint;
  v_stats_deleted bigint;
  v_batch_company_ids uuid[];
begin
  if p_scope not in ('all', 'batch') then
    return jsonb_build_object('success', false, 'error', 'scope non valido');
  end if;

  if p_scope = 'batch' and (p_batch is null or p_batch = '') then
    return jsonb_build_object('success', false, 'error', 'batch obbligatorio');
  end if;

  if p_scope = 'all' then
    delete from vote_sessions;
    get diagnostics v_votes_deleted = row_count;

    delete from daily_stats;
    get diagnostics v_stats_deleted = row_count;
  else
    select coalesce(array_agg(id), '{}'::uuid[]) into v_batch_company_ids
      from companies
      where batch = p_batch;

    delete from vote_sessions
      where company1_id = any(v_batch_company_ids)
         or company2_id = any(v_batch_company_ids)
         or company3_id = any(v_batch_company_ids);
    get diagnostics v_votes_deleted = row_count;

    delete from daily_stats
      where company_id = any(v_batch_company_ids);
    get diagnostics v_stats_deleted = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'votes_deleted', v_votes_deleted,
    'stats_deleted', v_stats_deleted
  );
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

revoke execute on function admin_reset_votes(text, text) from public, anon, authenticated;
grant execute on function admin_reset_votes(text, text) to service_role;