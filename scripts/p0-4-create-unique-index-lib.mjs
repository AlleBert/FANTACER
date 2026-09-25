/**
 * Helper puri di `p0-4-create-unique-index.mjs` (C10 / D4).
 *
 * Nessun side effect: importabile da script e test (che lo caricano via
 * subprocess perché ts-jest non importa `.mjs`).
 */

/** Nome dell'indice unico target. Mai creato via `supabase db push`. */
export const INDEX_NAME = 'uq_vote_sessions_event_principal_day'

/**
 * Campione dei gruppi duplicati `(event_id, principal_id, vote_day)`.
 * Ordina per gravità (conteggio desc) per riportare prima i casi peggiori.
 */
export function duplicatesQuery(limit = 100) {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 100))
  return `select event_id, principal_id, vote_day, count(*)::bigint as duplicate_count
    from public.vote_sessions
   where event_id is not null and principal_id is not null
   group by event_id, principal_id, vote_day
  having count(*) > 1
   order by count(*) desc, event_id, principal_id, vote_day
   limit ${safeLimit}`
}

/** Conteggi aggregati: gruppi duplicati e righe eccedenti coinvolte. */
export function duplicatesCountQuery() {
  return `select count(*)::bigint as duplicate_groups,
                 coalesce(sum(n), 0)::bigint as duplicate_rows
            from (
              select count(*)::bigint as n
                from public.vote_sessions
               where event_id is not null and principal_id is not null
               group by event_id, principal_id, vote_day
              having count(*) > 1
            ) d`
}

/** Stato dell'indice dal catalogo (`pg_index.indisvalid` / `indisready`). */
export function indexStateQuery() {
  return `select c.relname as index_name,
                 i.indisvalid as is_valid,
                 i.indisready as is_ready
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            join pg_index i on i.indexrelid = c.oid
           where n.nspname = 'public' and c.relname = $1`
}

/**
 * Riduce le righe del catalogo a uno stato normalizzato.
 * Un indice è "valido" solo se `indisvalid` **e** `indisready`.
 */
export function detectIndexState(rows = []) {
  const row = rows[0]
  if (!row) return { exists: false, valid: false, state: 'missing' }
  const valid = Boolean(row.is_valid && row.is_ready)
  return { exists: true, valid, state: valid ? 'valid' : 'invalid' }
}

/** Normalizza campione + conteggi dei duplicati in un unico summary. */
export function summarizeDuplicates(sampleRows = [], countRow = {}) {
  return {
    groups: Number(countRow.duplicate_groups ?? 0),
    rows: Number(countRow.duplicate_rows ?? 0),
    sample: sampleRows.map((r) => ({
      event_id: r.event_id,
      principal_id: r.principal_id,
      vote_day: r.vote_day,
      duplicate_count: Number(r.duplicate_count),
    })),
  }
}

/** Azione prevista data lo stato dell'indice e la modalità. */
export function planIndexAction(state, { dryRun = false } = {}) {
  if (state?.valid) return 'already-valid'
  if (dryRun) return 'dry-run'
  if (state?.exists && !state.valid) return 'recreate'
  return 'create'
}

/**
 * DDL di creazione. `concurrently` è obbligatorio: gira autocommit, **mai**
 * dentro `supabase db push` né in una transazione.
 */
export function createIndexSql({ concurrently = true } = {}) {
  return `create unique index ${concurrently ? 'concurrently ' : ''}${INDEX_NAME}
  on public.vote_sessions (event_id, principal_id, vote_day)
  where event_id is not null and principal_id is not null`
}
