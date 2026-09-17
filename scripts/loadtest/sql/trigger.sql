-- Opzionale — velocizza seed/cleanup di grandi volumi su fantacer-e2e.
-- Eseguire manualmente nel SQL Editor del progetto fantacer-e2e.
--
-- I trigger su vote_sessions fanno un'operazione per OGNI riga:
--   - trg_bump_ranking_tick          -> UPDATE su ranking_tick (realtime)
--   - trg_maintain_company_totals    -> UPDATE su company_totals (classifica)
-- Con 100k righe sono 100k x 2 operazioni: lento e WAL inutile durante i bulk.
--
-- 1) PRIMA del seed/cleanup:
ALTER TABLE public.vote_sessions DISABLE TRIGGER trg_bump_ranking_tick;
ALTER TABLE public.vote_sessions DISABLE TRIGGER trg_maintain_company_totals;

-- 2) DOPO il seed/cleanup (OBBLIGATORIO riabilitare):
ALTER TABLE public.vote_sessions ENABLE TRIGGER trg_bump_ranking_tick;
ALTER TABLE public.vote_sessions ENABLE TRIGGER trg_maintain_company_totals;

-- 3) RICALCOLA i contatori della classifica (obbligatorio se hai disabilitato
--    trg_maintain_company_totals, altrimenti i totali restano disallineati):
SELECT public.recompute_company_totals();

-- Verifica: tgenabled deve tornare 'O' (origin/enabled) per entrambi.
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.vote_sessions'::regclass
  AND tgname IN ('trg_bump_ranking_tick', 'trg_maintain_company_totals');
