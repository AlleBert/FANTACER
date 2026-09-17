-- Opzionale — velocizza seed/cleanup di grandi volumi su fantacer-e2e.
-- Eseguire manualmente nel SQL Editor del progetto fantacer-e2e.
--
-- Il trigger trg_bump_ranking_tick fa un UPDATE su ranking_tick per OGNI
-- insert/delete di vote_sessions: con 100k righe sono 100k update. Va bene,
-- ma e' lento e genera WAL inutile durante il seed.
--
-- 1) PRIMA del seed/cleanup:
ALTER TABLE public.vote_sessions DISABLE TRIGGER trg_bump_ranking_tick;

-- 2) DOPO il seed/cleanup (OBBLIGATORIO riabilitare):
ALTER TABLE public.vote_sessions ENABLE TRIGGER trg_bump_ranking_tick;

-- Verifica: tgenabled deve tornare 'O' (origin/enabled).
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.vote_sessions'::regclass
  AND tgname = 'trg_bump_ranking_tick';
