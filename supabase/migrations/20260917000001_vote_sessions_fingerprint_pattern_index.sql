-- Indice per il pattern matching sul prefisso (`LIKE 'prefisso%'`), usato dal
-- cleanup del load test e da eventuali ricerche per prefisso.
--
-- L'indice esistente `idx_vote_sessions_fingerprint (fingerprint, created_at)`
-- non copre `LIKE 'prefisso%'` con la collation di default (EXPLAIN -> Seq Scan).
-- L'opclass `text_pattern_ops` abilita l'uso dell'indice per i prefissi.

create index if not exists idx_vote_sessions_fingerprint_pattern
  on public.vote_sessions (fingerprint text_pattern_ops);
