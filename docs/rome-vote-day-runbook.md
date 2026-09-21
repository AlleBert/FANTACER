# Runbook — Allineamento reset voto a Europe/Rome

Migration: `supabase/migrations/20260921000000_rome_vote_day.sql`
Branch: `feat/rome-vote-day`

> **Stato: applicata il 21/09/2026.** `20260921000000` risulta registrata su
> **production** (`zdfverdwdsigizxktilz`) e su **e2e** (`ookipybsnjtvdrzqzpsl`).
> Verificato il 22/09/2026 con `supabase migration list --project-ref <ref>`.
> La procedura sotto resta valida come runbook riutilizzabile (re-apply di
> sicurezza, verifica post-apply) e per il rollback. Caveat empirico: sui dati
> attuali `vote_day` coincide con la data UTC (nessun voto nella fascia
> 22:00–24:00 UTC), quindi la correttezza Rome-day è verificata
> strutturalmente, non da un caso limite reale.

## Obiettivo

Il confine giornaliero del voto passa da **UTC** (reset alle 02:00 italiane) a
**Europe/Rome** (reset alle 00:00 locali), allineandolo a panoramica e report.

La migration **non è distruttiva**: non cancella righe. Ricrea la colonna
generata `vote_day` (derivata da `created_at`), l'indice unico
`(fingerprint, vote_day)` e la RPC `submit_vote`.

## Rischi

- Lock `ACCESS EXCLUSIVE` su `vote_sessions` durante `DROP/ADD COLUMN` e rebuild
  dell'indice: a scala fiera (centinaia/migliaia di righe) è sub-secondo, ma
  blocca temporaneamente gli INSERT del voto.
- Deploy del codice in produzione: mitigato dal rollback istantaneo di Vercel.
- Fail-safe: se esistono duplicati `(fingerprint, giorno Roma)` la migration
  **abortisce** senza modificare i dati.

**Finestra consigliata: 03:00–07:00 italiane** (basso traffico, fuori dalla
finestra critica 00:00–02:00).

## Procedura

### 1. Pre-check (read-only, gate)

Eseguire `scripts/loadtest/sql/rome_precheck.sql` nel Supabase SQL Editor di
**production**. Richiesto `gruppi_duplicati = 0`. Se > 0 → **STOP**.

### 2. Backup read-only di sicurezza

Export di `vote_sessions`, `daily_stats`, `company_totals` in
`backups/prod-<ts>.json` via PostgREST (service role). Verificare anche i backup
automatici/PITR Supabase del progetto.

### 3. Verifica migration pendenti

```
supabase migration list --project-ref zdfverdwdsigizxktilz
```

Deve risultare pendente **solo** `20260921000000`.

### 4. Apply (DB → deploy)

```
supabase db push --project-ref zdfverdwdsigizxktilz
```

Fallback: incollare il contenuto di `20260921000000_rome_vote_day.sql` nel SQL
Editor (transazione atomica).

### 5. Deploy del codice

Merge della PR `feat/rome-vote-day` su `master` → deploy Vercel production.

### 6. Verifica post-apply (read-only)

- `select generation_expression from information_schema.columns
  where table_name='vote_sessions' and column_name='vote_day'` → deve contenere
  `Europe/Rome`.
- `pg_get_functiondef('public.submit_vote(text,text,text,uuid,uuid,uuid,text,text)'::regprocedure)`
  → deve contenere `Europe/Rome`.
- Conteggi voti e classifica invariati rispetto al passo 1.

### 7. Canary

- Classifica e panoramica invariate; `/api/vota/status` coerente.
- Log Vercel senza errori. Nessun voto di test su production.

## Rollback

Applicare `scripts/loadtest/sql/rollback_rome_vote_day.sql` (riporta a UTC, con
fail-safe) e fare rollback istantaneo del deploy Vercel alla versione precedente.

## Verifica già eseguita su fantacer-e2e

- `vote_day` = `(created_at AT TIME ZONE 'Europe/Rome')::date`.
- Voto 23:30 UTC + 00:30 UTC stessa fingerprint → stesso giorno Roma e
  `unique_violation`; fingerprint diversa → inserita.
- RPC su fingerprint già votata oggi → `"Hai già votato oggi"`.
- Cleanup completo.
