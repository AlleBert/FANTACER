#!/usr/bin/env node
/**
 * P0-4c — Backfill `event_principals` dall'intero evento.
 *
 * - keyset su `fingerprint`, batch configurabile, resumibile e idempotente;
 * - `statement_timeout` FINITO (30s) + `lock_timeout` (5s);
 * - nessuna DELETE, nessun trigger toccato.
 *
 * Sicurezza: usa la connessione E2E (`loadE2eDbUrl`, guard host). Per produzione
 * serve `--allow-prod` esplicito (e snapshot prima).
 *
 * Uso:
 *   node scripts/p0-4-backfill.mjs [--event-id UUID] [--batch-size 50000]
 */

import pg from 'pg'
import { loadE2eDbUrl } from './loadtest/lib.mjs'

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : def
}
const batchSize = Number(getArg('--batch-size', '50000'))
const eventIdArg = getArg('--event-id', null)
const allowProd = args.includes('--allow-prod')

const url = loadE2eDbUrl()
if (url.includes('zdfverdwdsigizxktilz') && !allowProd) {
  console.error('Rifiutato: connessione a production senza --allow-prod.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
await client.query("set statement_timeout = '30s'")
await client.query("set lock_timeout = '5s'")

async function resolveEventId() {
  if (eventIdArg) return eventIdArg
  const bs = await client.query(
    "select active_event_id from public.batch_settings where id = 'default'",
  )
  if (bs.rows[0]?.active_event_id) return bs.rows[0].active_event_id
  const ev = await client.query(
    "select id from public.events where status = 'active' order by created_at desc limit 1",
  )
  return ev.rows[0]?.id ?? null
}

const eventId = await resolveEventId()
if (!eventId) {
  console.error('Nessun evento attivo (batch_settings.active_event_id o events.status=active).')
  process.exit(1)
}

let processed = 0
let last = ''
for (;;) {
  const page = await client.query(
    `select distinct fingerprint as fp
       from public.vote_sessions
      where fingerprint > $1
      order by fp asc
      limit $2`,
    [last, batchSize],
  )
  if (page.rows.length === 0) break

  const fps = page.rows.map((r) => r.fp)
  const inserted = await client.query(
    `insert into public.event_principals (event_id, legacy_fingerprint)
     select $1, unnest($2::text[])
     on conflict (event_id, legacy_fingerprint) do nothing`,
    [eventId, fps],
  )
  processed += fps.length
  last = fps[fps.length - 1]
  console.log(`backfill: +${fps.length} fingerprint (principals inseriti: ${inserted.rowCount})`)
}

const cover = await client.query(
  `select count(*) filter (where ep.id is null) as non_mappati, count(*) as totale
     from (select distinct fingerprint from public.vote_sessions) v
     left join public.event_principals ep
       on ep.event_id = $1 and ep.legacy_fingerprint = v.fingerprint`,
  [eventId],
)
console.log('backfill completato:', { processed, ...cover.rows[0] })
await client.end()
