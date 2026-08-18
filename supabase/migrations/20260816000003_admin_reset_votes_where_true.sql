-- Migration: Fix admin_reset_votes for PostgREST + safeupdate
-- Date: 2026-08-16
-- Supabase enables pg-safeupdate: bare "delete from <table>;" (no WHERE) is
-- rejected with "DELETE requires a WHERE clause" on every PostgREST session
-- (GUC is PGC_SUSET, authenticator cannot disable it). The documented
-- workaround is an explicit always-true condition: "delete ... where true;".

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
    delete from vote_sessions where true;
    get diagnostics v_votes_deleted = row_count;

    delete from daily_stats where true;
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