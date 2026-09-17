/**
 * Config condivisa della suite k6 (load test fiera).
 *
 * Env:
 *   BASE_URL              base URL dell'app sotto test (default http://localhost:3000)
 *   RUN_ID                id del run: compone i fingerprint dei voti (default 'manual')
 *   SLEEP_MS              pausa tra heartbeat/ranking di una sessione (default 30000)
 *   SUPABASE_ANON_KEY     richiesta solo dallo scenario realtime
 *   REALTIME_URL          override URL Realtime (default derivato da BASE_URL? no: va passato)
 */
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
export const RUN_ID = __ENV.RUN_ID || 'manual'
export const SLEEP_MS = Number(__ENV.SLEEP_MS || 30000)
export const REALTIME_URL = __ENV.REALTIME_URL || ''
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''

export const thresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<1200', 'p(99)<2500'],
  'http_req_duration{endpoint:vote}': ['p(95)<800'],
  'http_req_duration{endpoint:heartbeat}': ['p(95)<300'],
  'http_req_duration{endpoint:ranking}': ['p(95)<800'],
}
