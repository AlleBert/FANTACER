-- P0-4c — cleanup programmato dei nonce di bootstrap. ADDITIVO e INERTE.
-- La funzione elimina i nonce scaduti o consumati da più di 1h. Non cambia il
-- comportamento applicativo: è manutenzione.
--
-- Scheduling:
--  - se l'estensione `pg_cron` è disponibile sul piano, il blocco `do` registra
--    un job ogni 15 minuti;
--  - se `pg_cron` NON è disponibile, il blocco è un no-op (eccezione ignorata)
--    e la funzione resta invocabile manualmente o via cron esterno:
--      select public.cleanup_bootstrap_nonces();
--    In alternativa, l'app fa già cleanup best-effort su `consumeBootstrapNonce`.

begin;

-- security definer + search_path pinnato: la funzione gira con i privilegi del
-- owner (service/postgres) e non è invocabile da anon/authenticated.
create or replace function public.cleanup_bootstrap_nonces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.bootstrap_nonces
   where expires_at < now() - interval '1 hour'
      or (consumed_at is not null and consumed_at < now() - interval '1 hour');
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.cleanup_bootstrap_nonces() from public, anon, authenticated;
grant execute on function public.cleanup_bootstrap_nonces() to service_role;

comment on function public.cleanup_bootstrap_nonces()
  is 'P0-4c: elimina i bootstrap_nonces scaduti o consumati da >1h. Ritorna il numero di righe.';

-- Registrazione pg_cron guardata: no-op se l'estensione/lo schema cron manca.
do $guard$
begin
  perform cron.schedule(
    'cleanup-bootstrap-nonces',
    '*/15 * * * *',
    'select public.cleanup_bootstrap_nonces()'
  );
exception
  when others then
    null;
end
$guard$;

commit;
