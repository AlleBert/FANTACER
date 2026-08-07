-- Migration: Persist botd detection result into audit_logs.metadata
-- Date: 2026-08-07
-- Note: no new column. botd is stored as the 'botd' key in the existing
-- audit_logs.metadata jsonb. botd_param is default null for backward
-- compatibility, and botd is audit-only (never gates the vote).

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
      'company3', company3_id_param,
      'botd', coalesce(botd_param, '')
    )
  );

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;