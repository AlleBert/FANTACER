-- P0-4a1 — CSRF session-bound. ADDITIVO e INERTE.
-- L'app scrive/legge `csrf_hash` solo nelle fasi successive alla cutover;
-- nessun cambio di comportamento finché SESSION_IDENTITY_MODE è `off`.
-- I grant di tabella (service_role) si propagano alle nuove colonne.

begin;

alter table public.voter_sessions
  add column if not exists csrf_hash text;

comment on column public.voter_sessions.csrf_hash
  is 'P0-4a1: HMAC-SHA256 del token CSRF (mai il token in chiaro). Rotato al renew.';

commit;
