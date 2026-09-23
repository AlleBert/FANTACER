#!/usr/bin/env node
/**
 * Aggregatore read-only dei marker P0-2/P0-3 (`vote_request_end`) dai log Vercel.
 *
 * Privacy: aggrega SOLO conteggi. Non stampa mai IP, UUID, token, cookie o
 * contenuto del voto. Gli input grezzi non vengono mai riemessi.
 *
 * Uso:
 *   node scripts/vote-monitor.mjs --environment production --limit 1000
 *   npx vercel logs --json -n 1000 --environment production | node scripts/vote-monitor.mjs --stdin
 *   node scripts/vote-monitor.mjs --selftest
 */

import { execFileSync } from 'node:child_process'

const MARKER = 'vote_request_end'
const VOTE_PATH = '/api/vota'

function candidateStrings(entry) {
  const out = []
  if (typeof entry?.message === 'string') out.push(entry.message)
  if (Array.isArray(entry?.logs)) {
    for (const l of entry.logs) {
      if (typeof l === 'string') out.push(l)
      else if (typeof l?.message === 'string') out.push(l.message)
      else if (typeof l?.text === 'string') out.push(l.text)
    }
  }
  return out
}

export function parseLogLines(text) {
  const entries = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      entries.push(JSON.parse(t))
    } catch {
      // righe non-JSON ignorate
    }
  }
  return entries
}

function extractMarker(line) {
  const idx = line.indexOf('{')
  if (idx === -1) return null
  const slice = line.slice(idx)
  try {
    const obj = JSON.parse(slice)
    return obj && obj.marker === MARKER ? obj : null
  } catch {
    return null
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[i]
}

export function aggregate(entries) {
  const markers = []
  let postVota = 0
  let minTs = null
  let maxTs = null

  for (const e of entries) {
    if (e?.requestMethod === 'POST' && e?.requestPath === VOTE_PATH) {
      postVota += 1
      const ts = Number(e.timestamp)
      if (Number.isFinite(ts)) {
        minTs = minTs === null ? ts : Math.min(minTs, ts)
        maxTs = maxTs === null ? ts : Math.max(maxTs, ts)
      }
    }
    for (const s of candidateStrings(e)) {
      const m = extractMarker(s)
      if (m) {
        markers.push(m)
        const ts = Number(e.timestamp)
        if (Number.isFinite(ts)) {
          minTs = minTs === null ? ts : Math.min(minTs, ts)
          maxTs = maxTs === null ? ts : Math.max(maxTs, ts)
        }
      }
    }
  }

  const byOutcome = {}
  const byStatus = {}
  const byTurnstile = {}
  const byIpConfidence = {}
  let wouldBlockIp = 0
  let wouldBlockId = 0
  let rateLimited429 = 0
  let noTrustedIp = 0
  const durations = []

  for (const m of markers) {
    byOutcome[m.outcome] = (byOutcome[m.outcome] ?? 0) + 1
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1
    if (Number.isFinite(m.ms)) durations.push(m.ms)
    if (m.rateWouldBlock) {
      if (m.rateScopes?.ip === false) wouldBlockIp += 1
      if (m.rateScopes?.id === false) wouldBlockId += 1
    }
    if (m.outcome === 'rate_limited' || m.status === 429) rateLimited429 += 1
    const conf = m.ipConfidence ?? 'none'
    byIpConfidence[conf] = (byIpConfidence[conf] ?? 0) + 1
    if (conf !== 'medium' && conf !== 'high') noTrustedIp += 1
    if (m.turnstileReason) {
      byTurnstile[m.turnstileReason] = (byTurnstile[m.turnstileReason] ?? 0) + 1
    }
  }

  durations.sort((a, b) => a - b)
  const total = markers.length

  return {
    window: minTs !== null ? { from: new Date(minTs).toISOString(), to: new Date(maxTs).toISOString() } : null,
    explicitPostVota: postVota,
    markers: total,
    byOutcome,
    byStatus,
    rateWouldBlock: { ip: wouldBlockIp, id: wouldBlockId },
    rateLimited429,
    byIpConfidence,
    noTrustedIp,
    noTrustedIpPct: total > 0 ? Math.round((noTrustedIp / total) * 1000) / 10 : null,
    turnstileErrors: byTurnstile,
    latencyMs: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      max: durations.length ? durations[durations.length - 1] : null,
    },
  }
}

function fetchLogs(environment, limit) {
  return execFileSync(
    'npx',
    ['--no-install', 'vercel', 'logs', '--json', '-n', String(limit), '--environment', environment],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
}

function printReport(report) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

function selftest() {
  const sample = [
    JSON.stringify({ requestMethod: 'POST', requestPath: '/api/vota', timestamp: 1000, responseStatusCode: 200 }),
    JSON.stringify({ message: `{"marker":"${MARKER}","outcome":"success","status":200,"ms":30,"rateMode":"observe","rateWouldBlock":false,"rateScopes":{"ip":true,"id":true},"ipSource":"cf-connecting-ip","ipConfidence":"medium","ipHasDetected":true,"turnstileReason":null}`, timestamp: 1000 }),
    JSON.stringify({ message: `{"marker":"${MARKER}","outcome":"already_voted","status":409,"ms":12,"rateMode":"observe","rateWouldBlock":false,"rateScopes":{"ip":true,"id":true},"ipSource":"none","ipConfidence":"none","ipHasDetected":false,"turnstileReason":null}`, timestamp: 2000 }),
    JSON.stringify({ message: `{"marker":"${MARKER}","outcome":"rate_limited","status":429,"ms":5,"rateMode":"enforce","rateWouldBlock":true,"rateScopes":{"ip":false,"id":true},"ipSource":"cf-connecting-ip","ipConfidence":"medium","ipHasDetected":true,"turnstileReason":null}`, timestamp: 3000 }),
    'non-json riga da ignorare',
  ].join('\n')

  const r = aggregate(parseLogLines(sample))
  const checks = [
    ['explicitPostVota', r.explicitPostVota, 1],
    ['markers', r.markers, 3],
    ['success', r.byOutcome.success, 1],
    ['already_voted', r.byOutcome.already_voted, 1],
    ['rateLimited429', r.rateLimited429, 1],
    ['wouldBlockIp', r.rateWouldBlock.ip, 1],
    ['noTrustedIp', r.noTrustedIp, 1],
    ['noTrustedIpPct', r.noTrustedIpPct, 33.3],
  ]
  let ok = true
  for (const [name, got, want] of checks) {
    if (got !== want) {
      process.stderr.write(`FAIL ${name}: got ${got}, want ${want}\n`)
      ok = false
    }
  }
  process.stdout.write(ok ? 'SELFTEST OK\n' : 'SELFTEST FAILED\n')
  process.exit(ok ? 0 : 1)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--selftest')) return selftest()

  const getArg = (name, def) => {
    const i = args.indexOf(name)
    return i !== -1 && args[i + 1] ? args[i + 1] : def
  }

  if (args.includes('--stdin')) {
    let input = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => (input += d))
    process.stdin.on('end', () => printReport(aggregate(parseLogLines(input))))
    return
  }

  const environment = getArg('--environment', 'production')
  const limit = getArg('--limit', '1000')
  printReport(aggregate(parseLogLines(fetchLogs(environment, limit))))
}

main()
