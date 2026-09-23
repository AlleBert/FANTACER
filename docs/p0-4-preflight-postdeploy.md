# P0-4 — Query di preflight e post-deploy

Read-only. Da eseguire su **E2E** prima, poi su **produzione** con snapshot.

## Preflight (prima di P0-4a1)

```sql
-- 1. Nessuna collisione di nome
select to_regclass('public.events')            is null as events_free,
       to_regclass('public.event_principals')  is null as principals_free,
       to_regclass('public.voter_sessions')    is null as sessions_free;

-- 2. Colonne già presenti?
select column_name from information_schema.columns
 where table_schema='public' and table_name='vote_sessions'
   and column_name in ('event_id','principal_id');

-- 3. Colonne già presenti su batch_settings?
select column_name from information_schema.columns
 where table_schema='public' and table_name='batch_settings'
   and column_name='active_event_id';

-- 4. Baseline conteggi e flag
select (select count(*) from public.vote_sessions) as vote_sessions_total,
       (select value from public.site_settings where key='voting_enabled') as voting_enabled,
       (select value from public.site_settings where key='antibot_enabled') as antibot_enabled,
       (select value from public.batch_settings where id='default') as active_batch;

-- 5. Trigger presenti (non devono cambiare)
select tgname from pg_trigger
 where tgrelid='public.vote_sessions'::regclass and not tgisinternal;

-- 6. Grant anomali sui nomi nuovi
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name in ('events','event_principals','voter_sessions');
```

## Post-deploy (dopo P0-4a1)

```sql
-- 1. Oggetti creati e RLS attiva
select relname, relrowsecurity from pg_class
 where relname in ('events','event_principals','voter_sessions')
 order by relname;

-- 2. Nessun privilegio anon/authenticated
select has_table_privilege('anon','public.events','select')                    as anon_events,
       has_table_privilege('authenticated','public.event_principals','select') as auth_principals,
       has_table_privilege('anon','public.voter_sessions','select')            as anon_sessions;

-- 3. Tabelle nuove vuote (inerzia)
select (select count(*) from public.events)           as events_n,
       (select count(*) from public.event_principals) as principals_n,
       (select count(*) from public.voter_sessions)   as sessions_n;

-- 4. Invarianti: conteggio voti e flag invariati rispetto al preflight
select count(*) from public.vote_sessions;
select value from public.site_settings where key in ('voting_enabled','antibot_enabled');

-- 5. FK composite presenti
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid in ('public.voter_sessions'::regclass,'public.vote_sessions'::regclass)
   and contype='f';

-- 6. Trigger invariati su vote_sessions
select tgname from pg_trigger
 where tgrelid='public.vote_sessions'::regclass and not tgisinternal;
```

## Backfill — pre/post per batch

```sql
-- pre: quanti fingerprint distinti mancano al principal
select count(*) from (
  select distinct fingerprint from public.vote_sessions vs
  where vs.company1_id in (select id from public.companies where batch = 'TEST')
    and not exists (
      select 1 from public.event_principals ep
      where ep.event_id = (select active_event_id from public.batch_settings where id='default')
        and ep.legacy_fingerprint = vs.fingerprint
    )
) x;

-- post: copertura (deve essere 100%)
select count(*) filter (where ep.id is null) as non_mappati,
       count(*) as totale
from (select distinct fingerprint from public.vote_sessions) v
left join public.event_principals ep
  on ep.event_id = (select active_event_id from public.batch_settings where id='default')
 and ep.legacy_fingerprint = v.fingerprint;
```
