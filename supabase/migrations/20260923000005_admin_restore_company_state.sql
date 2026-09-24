-- Ripristina lo stato (blocco + override punteggio) da un backup in
-- admin_state_backups. Tocca SOLO le aziende presenti nel payload; non tocca i voti.
create or replace function public.admin_restore_company_state(p_backup_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_count int := 0;
  v_item jsonb;
  v_id uuid;
  v_blocked boolean;
  v_override jsonb;
begin
  select payload into v_payload from public.admin_state_backups where id = p_backup_id;
  if v_payload is null then
    return jsonb_build_object('success', false, 'error', 'backup non trovato');
  end if;

  for v_item in select * from jsonb_array_elements(v_payload)
  loop
    v_id := (v_item->>'id')::uuid;
    if v_id is null then continue; end if;
    v_blocked := coalesce((v_item->>'blocked')::boolean, false);

    update public.companies set blocked = v_blocked, updated_at = now() where id = v_id;

    v_override := v_item->'override';
    if v_override is null or v_override = 'null'::jsonb then
      delete from public.company_score_overrides where company_id = v_id;
    else
      insert into public.company_score_overrides
        (company_id, base_pallets, base_votes, snapshot_pallets, snapshot_votes, updated_at)
      values (
        v_id,
        coalesce((v_override->>'base_pallets')::bigint, 0),
        coalesce((v_override->>'base_votes')::bigint, 0),
        coalesce((v_override->>'snapshot_pallets')::bigint, 0),
        coalesce((v_override->>'snapshot_votes')::bigint, 0),
        now()
      )
      on conflict (company_id) do update set
        base_pallets = excluded.base_pallets,
        base_votes = excluded.base_votes,
        snapshot_pallets = excluded.snapshot_pallets,
        snapshot_votes = excluded.snapshot_votes,
        updated_at = now();
    end if;

    v_count := v_count + 1;
  end loop;

  update public.ranking_tick set version = version + 1, updated_at = now() where id = 1;

  return jsonb_build_object('success', true, 'restored', v_count, 'backup_id', p_backup_id);
end;
$$;
revoke execute on function public.admin_restore_company_state(bigint) from public, anon, authenticated;
grant execute on function public.admin_restore_company_state(bigint) to service_role;
