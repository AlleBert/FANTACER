-- C09 — submit_vote_v2: RPC di voto a identità server-side.
--
-- Scope (plan docs/superpowers/plans/2026-09-24-fine-sicurezza-voto-p0-4-p1.md §FASE D):
--   D1  RPC `submit_vote_v2(p_event_id, p_principal_id, p_ballot, p_idempotency_key, p_signals)`
--       SECURITY DEFINER, search_path fisso, errori strutturati (`code`),
--       nessun IP in chiaro né `md5(ip)`, audit senza `ip_address` in chiaro.
--   D2  segnali di rischio tipizzati, fixed-schema, server-derived.
--   D5  ACL: revoke da public/anon/authenticated, grant a service_role.
--   D6  idempotency ledger: stessa key + stessa scheda = stesso esito;
--       stessa key + scheda diversa = `idempotency_conflict`.
--
-- NON in scope: D4 (indice unico `uq_vote_sessions_event_principal_day`
-- creato da script concorrente separato, mai in `supabase db push`). La dedup
-- atomica per (evento, principal, giorno) è qui garantita dal `fingerprint`
-- deterministico (`coalesce(legacy_fingerprint, 'v2:'||principal_id)`) +
-- `uq_vote_sessions_fingerprint_day`; la funzione gestisce comunque
-- `unique_violation` di qualunque indice futuro.
--
-- Additiva e sicura: aggiunge 3 colonne nullable + 1 indice lookup + 1 funzione.
-- Nessuna modifica distruttiva, nessun BEGIN/COMMIT esplicito (runner transazionale).
-- **Re-runnable/idempotente**: `if not exists` + `create or replace`, applicabile
-- piu' volte senza effetti collaterali.
--
-- Codici di errore strutturati: `already_voted`, `idempotency_conflict`,
-- `invalid_ballot`, `invalid_signals`, `invalid_idempotency_key`,
-- `event_mismatch`, `company_not_in_event`, `company_blocked`,
-- `principal_not_found`, `error`.
--
-- Decisioni esplicite (dettagli nel report C09):
--   * `ip_hash` resta NULL per le righe v2: l'HMAC dell'IP vive in `signals`.
--   * `ballot_hash` canonico versionato `v1:sha256`, order-independent (le 3
--     coppie (company_id, pallet) sono ordinate per `company_id`).
--   * totali: `daily_stats` aggiornato manualmente come nel percorso legacy;
--     `company_totals` è mantenuto da `trg_maintain_company_totals` (nessun
--     doppio conteggio).
--   * validazione aziende: devono appartenere al batch dell'evento
--     (`company_not_in_event`) **e** non essere bloccate dall'admin
--     (`company_blocked`, regressione vs percorso legacy).

-- ---------------------------------------------------------------------------
-- 1) Colonne additive (idempotency ledger + segnali tipizzati)
-- ---------------------------------------------------------------------------
alter table public.vote_sessions
  add column if not exists idempotency_key text,
  add column if not exists ballot_hash text,
  add column if not exists signals jsonb;

comment on column public.vote_sessions.idempotency_key is
  'C09: chiave di idempotenza dell''attempt di voto v2 (NULL per righe legacy).';
comment on column public.vote_sessions.ballot_hash is
  'C09: hash canonico versionato della scheda (v1:sha256), order-independent.';
comment on column public.vote_sessions.signals is
  'C09: segnali di rischio tipizzati e pseudonimizzati (schema fisso, nessun PII grezzo).';

create index if not exists idx_vote_sessions_event_principal_idem
  on public.vote_sessions (event_id, principal_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- 2) RPC submit_vote_v2
-- ---------------------------------------------------------------------------
create or replace function public.submit_vote_v2(
  p_event_id uuid,
  p_principal_id uuid,
  p_ballot jsonb,
  p_idempotency_key text,
  p_signals jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_vote_day        date := (now() at time zone 'Europe/Rome')::date;
  v_ballot_hash     text;
  v_canonical       text;
  v_c1              uuid;
  v_c2              uuid;
  v_c3              uuid;
  v_ncomp           int;
  v_npal            int;
  v_bad             int;
  v_event_batch     text;
  v_principal_event uuid;
  v_legacy_fp       text;
  v_ok              int;
  v_fingerprint     text;
  v_existing_id     bigint;
  v_existing_hash   text;
  v_new_id          bigint;
begin
  -- 0) chiave di idempotenza obbligatoria e ragionevolmente corta.
  if p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or length(p_idempotency_key) > 200 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_idempotency_key',
      'message', 'idempotency_key mancante o non valida');
  end if;

  -- 1) Validazione segnali tipizzati (schema fisso: esattamente le 7 chiavi note).
  --    Il tipo e' controllato PRIMA di usare funzioni che richiedono un oggetto
  --    (`jsonb_object_keys`), indipendentemente dall'ordine di valutazione.
  if p_signals is null then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;
  if jsonb_typeof(p_signals) <> 'object' then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  select count(*) into v_bad
    from jsonb_object_keys(p_signals) k
   where k not in ('ip_hmac', 'asn_hash', 'ua_hash', 'country',
                   'botd_bucket', 'legacy_fp_present', 'version');
  if v_bad > 0 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  select count(*) into v_bad
    from (values ('ip_hmac'), ('asn_hash'), ('ua_hash'), ('country'),
                 ('botd_bucket'), ('legacy_fp_present'), ('version')) as k(key)
   where not (p_signals ? k.key);
  if v_bad > 0 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  if jsonb_typeof(p_signals -> 'version') <> 'number'
     or (p_signals ->> 'version') !~ '^[1-9][0-9]*$' then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  if jsonb_typeof(p_signals -> 'ip_hmac') not in ('string', 'null')
     or jsonb_typeof(p_signals -> 'asn_hash') not in ('string', 'null')
     or jsonb_typeof(p_signals -> 'ua_hash') not in ('string', 'null') then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  if jsonb_typeof(p_signals -> 'country') not in ('string', 'null')
     or (jsonb_typeof(p_signals -> 'country') = 'string'
         and (p_signals ->> 'country') !~ '^[A-Z]{2}$') then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  if jsonb_typeof(p_signals -> 'botd_bucket') <> 'number'
     or (p_signals ->> 'botd_bucket') !~ '^[0-3]$' then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  if jsonb_typeof(p_signals -> 'legacy_fp_present') <> 'boolean' then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_signals',
      'message', 'Segnali non validi');
  end if;

  -- 2) Validazione scheda: array di esattamente 3 coppie {company_id, pallet}.
  --    Ordine esplicito: tipo array PRIMA di `jsonb_array_length`; ogni elemento
  --    e' un oggetto PRIMA di `jsonb_object_keys` (nessuna dipendenza da OR).
  if p_ballot is null then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;
  if jsonb_typeof(p_ballot) <> 'array' then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;
  if jsonb_array_length(p_ballot) <> 3 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;

  select count(*) into v_bad
    from jsonb_array_elements(p_ballot) e
   where jsonb_typeof(e) <> 'object';
  if v_bad > 0 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;

  select count(*) into v_bad
    from jsonb_array_elements(p_ballot) e
   where (select count(*) from jsonb_object_keys(e)) <> 2
      or not (e ? 'company_id')
      or not (e ? 'pallet');
  if v_bad > 0 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;

  select count(*) into v_bad
    from jsonb_array_elements(p_ballot) e
   where jsonb_typeof(e -> 'company_id') <> 'string'
      or (e ->> 'company_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or jsonb_typeof(e -> 'pallet') <> 'number'
      or (e ->> 'pallet') !~ '^[124]$';
  if v_bad > 0 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;

  select count(distinct (e ->> 'company_id')),
         count(distinct (e ->> 'pallet'))
    into v_ncomp, v_npal
    from jsonb_array_elements(p_ballot) e;
  if v_ncomp <> 3 or v_npal <> 3 then
    return jsonb_build_object(
      'success', false, 'code', 'invalid_ballot',
      'message', 'Scheda non valida');
  end if;

  -- I pallet per posizione sono fissi (company1=4, company2=2, company3=1):
  -- mappo esplicitamente la coppia -> posizione per preservare il peso.
  select (e ->> 'company_id')::uuid into v_c1
    from jsonb_array_elements(p_ballot) e where (e ->> 'pallet')::int = 4;
  select (e ->> 'company_id')::uuid into v_c2
    from jsonb_array_elements(p_ballot) e where (e ->> 'pallet')::int = 2;
  select (e ->> 'company_id')::uuid into v_c3
    from jsonb_array_elements(p_ballot) e where (e ->> 'pallet')::int = 1;

  -- Hash canonico versionato e order-independent: coppie ordinate per company_id.
  select 'v1|' || string_agg(
           (e ->> 'company_id')::uuid::text || ':' || (e ->> 'pallet')::int::text,
           '|' order by (e ->> 'company_id')::uuid)
    into v_canonical
    from jsonb_array_elements(p_ballot) e;
  v_ballot_hash := 'v1:' || encode(sha256(convert_to(v_canonical, 'UTF8')), 'hex');

  -- 3) Validazione evento / principal / aziende (batch coerente).
  select e.batch into v_event_batch
    from public.events e
   where e.id = p_event_id;
  if v_event_batch is null then
    return jsonb_build_object(
      'success', false, 'code', 'event_mismatch',
      'message', 'Evento non valido');
  end if;

  select ep.event_id, ep.legacy_fingerprint
    into v_principal_event, v_legacy_fp
    from public.event_principals ep
   where ep.id = p_principal_id;
  if not found then
    return jsonb_build_object(
      'success', false, 'code', 'principal_not_found',
      'message', 'Principal non valido');
  end if;
  if v_principal_event <> p_event_id then
    return jsonb_build_object(
      'success', false, 'code', 'event_mismatch',
      'message', 'Principal non appartenente all''evento');
  end if;

  select count(*) into v_ok
    from public.companies c
   where c.id in (v_c1, v_c2, v_c3)
     and c.batch = v_event_batch;
  if v_ok <> 3 then
    return jsonb_build_object(
      'success', false, 'code', 'company_not_in_event',
      'message', 'Aziende non appartenenti all''evento');
  end if;

  -- Regressione (come il percorso legacy): una company bloccata dall'admin non
  -- e' votabile. Distinta da `company_not_in_event` per non confondere i due casi.
  select count(*) into v_bad
    from public.companies c
   where c.id in (v_c1, v_c2, v_c3)
     and c.blocked;
  if v_bad > 0 then
    return jsonb_build_object(
      'success', false, 'code', 'company_blocked',
      'message', 'Azienda non disponibile');
  end if;

  -- Fingerprint deterministico per principal: mantiene la dedup atomica legacy
  -- (fingerprint, vote_day) e il bridge con i voti legacy già mappati.
  v_fingerprint := coalesce(v_legacy_fp, 'v2:' || p_principal_id::text);

  -- 4) Idempotenza: stessa key (stesso evento/principal) + stessa scheda = stesso esito.
  select vs.id, vs.ballot_hash
    into v_existing_id, v_existing_hash
    from public.vote_sessions vs
   where vs.event_id = p_event_id
     and vs.principal_id = p_principal_id
     and vs.idempotency_key = p_idempotency_key
   order by vs.id desc
   limit 1;
  if found then
    if v_existing_hash is not distinct from v_ballot_hash then
      return jsonb_build_object(
        'success', true, 'idempotent', true, 'vote_id', v_existing_id);
    end if;
    return jsonb_build_object(
      'success', false, 'code', 'idempotency_conflict',
      'message', 'Richiesta già elaborata con una scheda diversa');
  end if;

  -- 5) Dedup giornaliera per (evento, principal, giorno Roma).
  select vs.id into v_existing_id
    from public.vote_sessions vs
   where vs.event_id = p_event_id
     and vs.principal_id = p_principal_id
     and vs.vote_day = v_vote_day
   limit 1;
  if found then
    return jsonb_build_object(
      'success', false, 'code', 'already_voted',
      'message', 'Hai già votato oggi');
  end if;

  -- 6) Inserimento. `ip_hash` resta NULL: nessun md5(ip), l'HMAC vive in `signals`.
  insert into public.vote_sessions (
    fingerprint, ip_hash, user_agent, country,
    company1_id, company2_id, company3_id,
    event_id, principal_id, idempotency_key, ballot_hash, signals
  ) values (
    v_fingerprint, null, null, coalesce(p_signals ->> 'country', 'IT'),
    v_c1, v_c2, v_c3,
    p_event_id, p_principal_id, p_idempotency_key, v_ballot_hash, p_signals
  )
  returning id into v_new_id;

  -- 7) daily_stats: come nel percorso legacy. company_totals è mantenuto dal
  --    trigger trg_maintain_company_totals sull'INSERT → nessun doppio conteggio.
  insert into public.daily_stats (company_id, date, vote_count, unique_voters)
  values
    (v_c1, v_vote_day, 1, 1),
    (v_c2, v_vote_day, 1, 1),
    (v_c3, v_vote_day, 1, 1)
  on conflict (company_id, date)
  do update set
    vote_count    = public.daily_stats.vote_count + 1,
    unique_voters = public.daily_stats.unique_voters + 1;

  -- 8) Audit: MAI ip_address in chiaro né user_agent grezzo. Solo HMAC/bucket.
  insert into public.audit_logs (event_type, fingerprint, ip_address, user_agent, metadata)
  values (
    'vote_submitted_v2',
    v_fingerprint,
    null,
    null,
    jsonb_build_object(
      'event_id', p_event_id,
      'principal_id', p_principal_id,
      'vote_id', v_new_id,
      'ballot_hash', v_ballot_hash,
      'idempotency_key', p_idempotency_key,
      'ip_hmac', p_signals -> 'ip_hmac',
      'botd_bucket', p_signals -> 'botd_bucket',
      'legacy_fp_present', p_signals -> 'legacy_fp_present'
    ));

  return jsonb_build_object(
    'success', true, 'vote_id', v_new_id, 'ballot_hash', v_ballot_hash);
exception
  when unique_violation then
    -- Race persa su un indice unico (fingerprint/day legacy o event/principal/day).
    return jsonb_build_object(
      'success', false, 'code', 'already_voted',
      'message', 'Hai già votato oggi');
  when others then
    -- Messaggio sicuro: nessun dettaglio interno/PII verso il chiamante.
    return jsonb_build_object(
      'success', false, 'code', 'error',
      'message', 'Errore interno');
end;
$fn$;

comment on function public.submit_vote_v2(uuid, uuid, jsonb, text, jsonb) is
  'C09: voto a identità server-side con segnali tipizzati, idempotenza e errori strutturati. Nessun IP in chiaro né md5(ip).';

-- ---------------------------------------------------------------------------
-- 3) ACL: solo service_role può eseguire la RPC.
-- ---------------------------------------------------------------------------
revoke execute on function public.submit_vote_v2(uuid, uuid, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_vote_v2(uuid, uuid, jsonb, text, jsonb)
  to service_role;
