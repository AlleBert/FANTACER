-- Pre-check read-only per l'allineamento del confine giornaliero a Europe/Rome
-- (migration 20260921000000_rome_vote_day.sql).
--
-- Eseguire su production nel Supabase SQL Editor PRIMA dell'apply.
-- Sono tutte SELECT: nessuna scrittura.
--
-- Gate: `gruppi_duplicati` deve essere 0, altrimenti la migration abortisce
-- (fail-safe) e NON va applicata finché non si bonifica.

-- 1) Gruppi (fingerprint, giorno Europe/Rome) duplicati.
select count(*) as gruppi_duplicati
from (
  select fingerprint, (created_at at time zone 'Europe/Rome')::date as giorno
  from public.vote_sessions
  group by fingerprint, (created_at at time zone 'Europe/Rome')::date
  having count(*) > 1
) d;

-- 2) Dettaglio dei casi (vuoto se il gate è verde).
select
  fingerprint,
  (created_at at time zone 'Europe/Rome')::date as giorno,
  count(*) as n
from public.vote_sessions
group by 1, 2
having count(*) > 1
order by n desc
limit 50;

-- 3) Segnale precoce: voti nella finestra a rischio 00:00-02:00 locali
--    (causa delle possibili collisioni nella conversione UTC -> Roma).
select count(*) as voti_finestra_0000_0200
from public.vote_sessions
where (created_at at time zone 'Europe/Rome')::time >= time '00:00'
  and (created_at at time zone 'Europe/Rome')::time <  time '02:00';
