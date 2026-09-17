import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, RANKING_POLL_MS, RUN_ID, SLEEP_MS } from '../config.js'
import { mulberry32, pickTriple, seedFromString, visitorId } from './data.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function sessionRng() {
  return mulberry32(seedFromString(`${RUN_ID}:vu:${__VU}`))
}

export function pageLoad() {
  const res = http.get(`${BASE_URL}/`, { tags: { endpoint: 'page' } })
  check(res, { 'page 200': (r) => r.status === 200 })
  return res
}

export function heartbeat(fingerprint) {
  const res = http.post(
    `${BASE_URL}/api/presence/heartbeat`,
    JSON.stringify({ fingerprint }),
    { headers: JSON_HEADERS, tags: { endpoint: 'heartbeat' } },
  )
  check(res, { 'heartbeat 200': (r) => r.status === 200 })
  return res
}

export function ranking() {
  const res = http.get(`${BASE_URL}/api/public/ranking`, { tags: { endpoint: 'ranking' } })
  check(res, { 'ranking 200': (r) => r.status === 200 })
  return res
}

export function voteStatus(visitorIdValue) {
  const res = http.post(
    `${BASE_URL}/api/vota/status`,
    JSON.stringify({ visitorId: visitorIdValue }),
    { headers: JSON_HEADERS, tags: { endpoint: 'status' } },
  )
  check(res, { 'status 200': (r) => r.status === 200 })
  return res
}

export function vote(companies, visitorIdValue) {
  const [company1Id, company2Id, company3Id] = companies
  const res = http.post(
    `${BASE_URL}/api/vota`,
    JSON.stringify({
      company1Id,
      company2Id,
      company3Id,
      visitorId: visitorIdValue,
      turnstile_token: 'loadtest-token',
      botd: '',
    }),
    { headers: JSON_HEADERS, tags: { endpoint: 'vote' } },
  )
  check(res, { 'vote ok (200/409)': (r) => r.status === 200 || r.status === 409 })
  return res
}

/**
 * Sessione utente realistica, ripetuta per ogni iterazione del VU:
 * page load + voto al primo giro, poi heartbeat ogni `sleepMs` e polling
 * classifica ogni `RANKING_POLL_MS` (l'app reale smette di pollare quando il
 * realtime e' attivo: qui e' un fallback conservativo).
 */
export function runSession(companies, sleepMs = SLEEP_MS) {
  const id = visitorId(RUN_ID, `s${__VU}`)
  const rng = sessionRng()
  const rankEvery = Math.max(1, Math.round(RANKING_POLL_MS / sleepMs))

  if (__ITER === 0) {
    pageLoad()
    vote(pickTriple(companies, rng), id)
  }

  heartbeat(id)
  if (__ITER % rankEvery === 0) ranking()
  sleep(sleepMs / 1000)
}

/** Raffica di voto: ogni iterazione e' un votante distinto. */
export function runVoteBurst(companies) {
  const id = visitorId(RUN_ID, `sp${__VU}-${__ITER}`)
  const rng = mulberry32(seedFromString(`${RUN_ID}:spike:${__VU}:${__ITER}`))
  vote(pickTriple(companies, rng), id)
}
