#!/usr/bin/env node
/**
 * C13 / FASE G — Retention e minimizzazione dei dati del voto (dry-run di default).
 *
 * Cosa fa (nessuna scrittura senza `--apply`):
 *   - `voter_sessions` scadute/revocate oltre l'orizzonte di retention;
 *   - `event_principals` dell'evento rimasti senza sessioni e senza voti;
 *   - `bootstrap_nonces` scaduti o consumati da piu' di 1h;
 *   - PII legacy in `vote_sessions` (`ip_hash`, `user_agent`) e `audit_logs`
 *     (`ip_address`, `user_agent`, `fingerprint`) oltre l'orizzonte, da
 *     **anonimizzare** (NULL / `'redacted'`);
 *   - `key_id` (keyring) che diventerebbero orfani: report **informativo**, la
 *     distruzione delle chiavi e' **manuale**.
 *
 * Orizzonte: `event.ends_at + --days` (default 7). Se l'evento non ha `ends_at`
 * serve `--before <iso>`. La retention si applica **solo dopo** che l'orizzonte e'
 * stato raggiunto (`now >= cutoff`): con `cutoff` nel futuro nessuna riga e' in
 * scope (evita di anonimizzare dati ancora coperti).
 *
 * Vincoli:
 *   - **mai** DELETE di `vote_sessions` (i voti `accepted` restano per il
 *     dedup/classifica): solo anonimizzazione delle PII legacy;
 *   - le DELETE sono limitate a sessioni/principal/nonce oltre l'orizzonte;
 *   - operazioni a batch (keyset via `limit`), timeout finiti, connessione
 *     diretta `pg`, idempotenti e resumibili;
 *   - **nessuna cancellazione senza `--apply`**;
 *   - guard host: rifiuta production senza `--allow-prod`.
 *
 * Uso:
 *   node scripts/retention.mjs [--event-id UUID] [--days 7] [--before ISO]
 *                              [--batch-size 5000] [--apply] [--verify]
 *                              [--json] [--allow-prod]
 *
 * `--json` stampa solo il report JSON su stdout (log su stderr), per i test.
 * `--verify` esegue solo il dry-run ed esce non-zero se resta qualcosa in scope.
 *
 * Sicurezza: di default usa la connessione E2E (`loadE2eDbUrl`, guard host).
 * Per altri target (es. produzione, solo con autorizzazione) usare
 * `RETENTION_DB_URL=<url>` **e** `--allow-prod` esplicito.
 */

import pg from 'pg'
import { E2E_HOST, PROD_HOST, loadE2eDbUrl } from './loadtest/lib.mjs'

// Timeout finiti, applicati una volta per run a livello di sessione (mai `0`).
const STATEMENT_TIMEOUT = '30s'
const LOCK_TIMEOUT = '5s'
const DEFAULT_BATCH_SIZE = 5000
const NONCE_RETENTION = "interval '1 hour'"

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const eq = args.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def
}
const hasFlag = (name) => args.includes(name)

const apply = hasFlag('--apply')
const verify = hasFlag('--verify')
const asJson = hasFlag('--json')
const allowProd = hasFlag('--allow-prod')
const eventIdArg = getArg('--event-id', null)
const beforeArg = getArg('--before', null)
const days = Number(getArg('--days', '7'))
const batchSize = Number(getArg('--batch-size', String(DEFAULT_BATCH_SIZE)))

if (!Number.isInteger(days) || days < 0) {
  console.error('--days deve essere un intero >= 0.')
  process.exit(1)
}
if (!Number.isInteger(batchSize) || batchSize <= 0) {
  console.error('--batch-size deve essere un intero positivo.')
  process.exit(1)
}
if (beforeArg && Number.isNaN(Date.parse(beforeArg))) {
  console.error(`--before non e' una data valida: ${beforeArg}`)
  process.exit(1)
}

const log = (...parts) => {
  const line = parts.join(' ')
  if (asJson) console.error(line)
  else console.log(line)
}

/* ------------------------------------------------------------------ guard --- */

/** Ref del progetto Supabase, da username `postgres.<ref>` o host `<ref>.supabase.co`. */
function dbRef(url) {
  const parsed = new URL(url)
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/)
  if (m) return m[1]
  if (parsed.hostname.endsWith('.supabase.co')) return parsed.hostname.split('.')[0]
  return null
}

const PROD_REF = PROD_HOST.split('.')[0]
const E2E_REF = E2E_HOST.split('.')[0]

let url
try {
  url = process.env.RETENTION_DB_URL || loadE2eDbUrl()
} catch (error) {
  console.error(`URL DB non ottenibile: ${error.message}`)
  process.exit(1)
}

let ref
try {
  ref = dbRef(url)
} catch {
  console.error('URL DB non valida.')
  process.exit(1)
}
if (ref === PROD_REF && !allowProd) {
  console.error('Rifiutato: connessione a production senza --allow-prod.')
  process.exit(1)
}
if (ref !== PROD_REF && ref !== E2E_REF && !allowProd) {
  console.error(`Rifiutato: host/ref inatteso (${ref ?? 'sconosciuto'}); atteso ${E2E_REF}.`)
  process.exit(1)
}
const target = ref === PROD_REF ? 'prod' : 'e2e'

/* --------------------------------------------------------------- database --- */

const client = new pg.Client({ connectionString: url })
await client.connect()
await client.query(`set statement_timeout = '${STATEMENT_TIMEOUT}'`)
await client.query(`set lock_timeout = '${LOCK_TIMEOUT}'`)

/** Evento: `--event-id`, altrimenti `active_event_id`, altrimenti batch attivo. */
async function resolveEvent() {
  if (eventIdArg) {
    const r = await client.query(
      'select id, batch, ends_at from public.events where id = $1',
      [eventIdArg],
    )
    if (!r.rows[0]) throw new Error(`Evento ${eventIdArg} non trovato.`)
    return r.rows[0]
  }

  const bs = await client.query(
    "select active_batch, active_event_id from public.batch_settings where id = 'default'",
  )
  const row = bs.rows[0]
  if (row?.active_event_id) {
    const r = await client.query(
      'select id, batch, ends_at from public.events where id = $1',
      [row.active_event_id],
    )
    if (r.rows[0]) return r.rows[0]
  }
  if (row?.active_batch) {
    const r = await client.query(
      `select id, batch, ends_at from public.events
        where batch = $1 and status = 'active' order by created_at desc limit 1`,
      [row.active_batch],
    )
    if (r.rows[0]) return r.rows[0]
  }
  throw new Error('Nessun evento attivo (batch_settings.active_event_id o events.status=active).')
}

const event = await resolveEvent()
const { id: eventId, batch } = event

const cutoff = beforeArg
  ? new Date(beforeArg)
  : event.ends_at
    ? new Date(new Date(event.ends_at).getTime() + days * 86_400_000)
    : null
if (!cutoff) {
  console.error(
    'Evento senza `ends_at`: impossibile derivare l\'orizzonte, serve `--before <iso>`.',
  )
  process.exit(1)
}
const horizonReached = Date.now() >= cutoff.getTime()
const cutoffIso = cutoff.toISOString()
const endsAtIso = event.ends_at ? new Date(event.ends_at).toISOString() : null

if (!horizonReached) {
  log(
    `orizzonte retention non raggiunto (cutoff ${cutoffIso} > now): nessuna riga in scope.`,
  )
}

/* --------------------------------------------------------------- scope ----- */

/**
 * Predicato "sessione oltre l'orizzonte", sugli alias `vs`. Usato sia per la
 * DELETE sia per predire i principal orfani (escludendo le sessioni in scope).
 */
const SESSION_OUT_OF_SCOPE = `(
  vs.event_id = $1
  and (vs.expires_at < $2 or (vs.revoked_at is not null and vs.revoked_at < $2))
)`

/** Conteggi in scope (solo letture). */
async function collectScope() {
  if (!horizonReached) {
    return { voterSessions: 0, eventPrincipals: 0, bootstrapNonces: 0, voteSessionsPii: 0, auditLogsPii: 0 }
  }

  const voterSessions = await client.query(
    `select count(*)::bigint as n from public.voter_sessions vs
      where vs.event_id = $1
        and (vs.expires_at < $2 or (vs.revoked_at is not null and vs.revoked_at < $2))`,
    [eventId, cutoffIso],
  )

  // Principal che resterebbero senza sessioni (escludendo quelle in scope) e
  // senza voti. La FK `vote_sessions → event_principals` e' la rete di sicurezza.
  const eventPrincipals = await client.query(
    `select count(*)::bigint as n from public.event_principals ep
      where ep.event_id = $1
        and not exists (
          select 1 from public.voter_sessions vs
           where vs.principal_id = ep.id and not ${SESSION_OUT_OF_SCOPE}
        )
        and not exists (
          select 1 from public.vote_sessions v where v.principal_id = ep.id
        )`,
    [eventId, cutoffIso],
  )

  const bootstrapNonces = await client.query(
    `select count(*)::bigint as n from public.bootstrap_nonces
      where expires_at < now() - ${NONCE_RETENTION}
         or (consumed_at is not null and consumed_at < now() - ${NONCE_RETENTION})`,
  )

  const voteSessionsPii = await client.query(
    `select count(*)::bigint as n from public.vote_sessions
      where created_at < $1
        and (event_id = $2 or event_id is null)
        and (ip_hash is not null or user_agent is not null)`,
    [cutoffIso, eventId],
  )

  const auditLogsPii = await client.query(
    `select count(*)::bigint as n from public.audit_logs
      where created_at < $1
        and (
          ip_address is not null
          or user_agent is not null
          or (fingerprint is not null and fingerprint <> 'redacted')
        )`,
    [cutoffIso],
  )

  return {
    voterSessions: Number(voterSessions.rows[0].n),
    eventPrincipals: Number(eventPrincipals.rows[0].n),
    bootstrapNonces: Number(bootstrapNonces.rows[0].n),
    voteSessionsPii: Number(voteSessionsPii.rows[0].n),
    auditLogsPii: Number(auditLogsPii.rows[0].n),
  }
}

/** `key_id` del keyring di sessione ancora referenziati, con stato di retention. */
async function collectSignalKeys() {
  const { rows } = await client.query(
    `select key_id,
            count(*)::bigint as total,
            count(*) filter (
              where expires_at < $2 or (revoked_at is not null and revoked_at < $2)
            )::bigint as in_scope
       from public.voter_sessions
      where event_id = $1
      group by key_id
      order by key_id`,
    [eventId, cutoffIso],
  )
  return rows.map((r) => {
    const total = Number(r.total)
    const inScope = horizonReached ? Number(r.in_scope) : 0
    const remaining = total - inScope
    return {
      keyId: r.key_id,
      source: 'voter_sessions.key_id',
      sessions: total,
      inScope,
      remaining,
      destroyEligible: horizonReached && total > 0 && remaining === 0,
    }
  })
}

/* --------------------------------------------------------------- apply ----- */

const MAX_PAGES = 1_000_000

async function deleteVoterSessions() {
  let deleted = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { rowCount } = await client.query(
      `with doomed as (
         select id from public.voter_sessions
          where event_id = $1
            and (expires_at < $2 or (revoked_at is not null and revoked_at < $2))
          limit $3
       )
       delete from public.voter_sessions t using doomed d where t.id = d.id`,
      [eventId, cutoffIso, batchSize],
    )
    deleted += rowCount ?? 0
    if (!rowCount || rowCount < batchSize) break
  }
  return deleted
}

async function deleteOrphanPrincipals() {
  let deleted = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { rowCount } = await client.query(
      `with doomed as (
         select ep.id from public.event_principals ep
          where ep.event_id = $1
            and not exists (
              select 1 from public.voter_sessions vs where vs.principal_id = ep.id
            )
            and not exists (
              select 1 from public.vote_sessions v where v.principal_id = ep.id
            )
          limit $2
       )
       delete from public.event_principals t using doomed d where t.id = d.id`,
      [eventId, batchSize],
    )
    deleted += rowCount ?? 0
    if (!rowCount || rowCount < batchSize) break
  }
  return deleted
}

async function deleteBootstrapNonces() {
  let deleted = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { rowCount } = await client.query(
      `with doomed as (
         select nonce from public.bootstrap_nonces
          where expires_at < now() - ${NONCE_RETENTION}
             or (consumed_at is not null and consumed_at < now() - ${NONCE_RETENTION})
          limit $1
       )
       delete from public.bootstrap_nonces t using doomed d where t.nonce = d.nonce`,
      [batchSize],
    )
    deleted += rowCount ?? 0
    if (!rowCount || rowCount < batchSize) break
  }
  return deleted
}

async function anonymizeVoteSessionsPii() {
  let updated = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { rowCount } = await client.query(
      `with doomed as (
         select id from public.vote_sessions
          where created_at < $1
            and (event_id = $2 or event_id is null)
            and (ip_hash is not null or user_agent is not null)
          limit $3
       )
       update public.vote_sessions v
          set ip_hash = null, user_agent = null
         from doomed d where v.id = d.id`,
      [cutoffIso, eventId, batchSize],
    )
    updated += rowCount ?? 0
    if (!rowCount || rowCount < batchSize) break
  }
  return updated
}

async function anonymizeAuditLogsPii() {
  let updated = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { rowCount } = await client.query(
      `with doomed as (
         select id from public.audit_logs
          where created_at < $1
            and (
              ip_address is not null
              or user_agent is not null
              or (fingerprint is not null and fingerprint <> 'redacted')
            )
          limit $2
       )
       update public.audit_logs a
          set ip_address = null,
              user_agent = null,
              fingerprint = case
                when a.fingerprint is null then null
                when a.fingerprint = 'redacted' then a.fingerprint
                else 'redacted'
              end
         from doomed d where a.id = d.id`,
      [cutoffIso, batchSize],
    )
    updated += rowCount ?? 0
    if (!rowCount || rowCount < batchSize) break
  }
  return updated
}

/** Numero complessivo di voti dell'evento: invariante (mai DELETE su vote_sessions). */
async function countEventVotes() {
  const { rows } = await client.query(
    'select count(*)::bigint as n from public.vote_sessions where event_id = $1',
    [eventId],
  )
  return Number(rows[0].n)
}

/* ------------------------------------------------------------------ main --- */

const startedAt = Date.now()
const before = await collectScope()
const signalKeys = await collectSignalKeys()
const votesBefore = await countEventVotes()

const report = {
  mode: apply ? 'apply' : verify ? 'verify' : 'dry-run',
  target,
  eventId,
  batch,
  retainsVoteSessions: true,
  horizon: { days, endsAt: endsAtIso, cutoff: cutoffIso, reached: horizonReached, source: beforeArg ? 'before' : 'ends_at' },
  before,
  after: { ...before },
  deleted: { voterSessions: 0, eventPrincipals: 0, bootstrapNonces: 0 },
  anonymized: { voteSessionsPii: 0, auditLogsPii: 0 },
  signalKeys,
  voteSessions: { before: votesBefore, after: votesBefore },
  remaining: { ...before },
  durationMs: 0,
}

if (apply && horizonReached) {
  log(`retention APPLY evento=${eventId} cutoff=${cutoffIso} batch=${batchSize}`)
  report.deleted.voterSessions = await deleteVoterSessions()
  report.deleted.eventPrincipals = await deleteOrphanPrincipals()
  report.deleted.bootstrapNonces = await deleteBootstrapNonces()
  report.anonymized.voteSessionsPii = await anonymizeVoteSessionsPii()
  report.anonymized.auditLogsPii = await anonymizeAuditLogsPii()

  const votesAfter = await countEventVotes()
  report.voteSessions.after = votesAfter
  if (votesAfter !== votesBefore) {
    // Mai atteso: la retention non cancella voti. Fallisce forte se accade.
    throw new Error(
      `Invariante violata: vote_sessions evento ${eventId} ${votesBefore} -> ${votesAfter}.`,
    )
  }

  report.after = await collectScope()
  report.remaining = { ...report.after }
  report.signalKeys = await collectSignalKeys()
} else {
  log(
    `retention DRY-RUN evento=${eventId} cutoff=${cutoffIso} batch=${batchSize} (nessuna scrittura)`,
  )
}

report.durationMs = Date.now() - startedAt

if (asJson) {
  console.log(JSON.stringify(report))
} else {
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' ')
  console.log(`mode: ${report.mode} (target ${report.target})`)
  console.log(`evento: ${report.eventId} batch=${report.batch}`)
  console.log(`orizzonte: cutoff=${report.horizon.cutoff} reached=${report.horizon.reached}`)
  console.log(`prima:  ${fmt(report.before)}`)
  console.log(`dopo:   ${fmt(report.after)}`)
  if (apply) {
    console.log(`eliminati:   ${fmt(report.deleted)}`)
    console.log(`anonimizzati: ${fmt(report.anonymized)}`)
  }
  console.log(`vote_sessions: ${report.voteSessions.before} -> ${report.voteSessions.after} (mai cancellati)`)
  for (const k of report.signalKeys) {
    console.log(
      `key_id ${k.keyId}: sessions=${k.sessions} in_scope=${k.inScope} remaining=${k.remaining} destroy_eligible=${k.destroyEligible}`,
    )
  }
  if (report.signalKeys.length) {
    console.log('Nota: la distruzione delle chiavi (keyring) e\' manuale.')
  }
}

await client.end()

const anyInScope = Object.values(report.remaining).some((n) => n > 0)
if (verify && anyInScope) {
  console.error('Verifica retention FALLITA: righe ancora in scope.')
  process.exit(1)
}
if (apply && anyInScope) {
  console.error('ATTENZIONE: righe ancora in scope dopo --apply (verificare i batch/timeout).')
  process.exitCode = 1
}
