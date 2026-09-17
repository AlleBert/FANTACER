import ws from 'k6/ws'
import { check } from 'k6'
import { Counter, Rate } from 'k6/metrics'
import { REALTIME_URL, SUPABASE_ANON_KEY } from '../config.js'

const VUS = Number(__ENV.VUS || 500)
const HOLD_S = Number(__ENV.HOLD_SECONDS || 300)
const TOPIC = 'realtime:live-ranking-votes'

const joinOk = new Counter('realtime_join_ok')
const joinFail = new Rate('realtime_join_failures')
const closes = new Counter('realtime_closes')

export const options = {
  scenarios: {
    realtime: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS },
        { duration: '5m', target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    realtime_join_failures: ['rate<0.05'],
    'ws_connecting': ['p(95)<2000'],
  },
}

function joinMessage() {
  return JSON.stringify({
    topic: TOPIC,
    event: 'phx_join',
    payload: {
      config: {
        postgres_changes: [{ event: 'UPDATE', schema: 'public', table: 'ranking_tick' }],
      },
    },
    ref: '1',
  })
}

export default function () {
  if (!REALTIME_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'realtime.js richiede -e REALTIME_URL=wss://<ref>.supabase.co/realtime/v1/websocket -e SUPABASE_ANON_KEY=<anon>',
    )
  }
  const url = `${REALTIME_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`
  let joined = false

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => socket.send(joinMessage()))

    socket.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw)
      } catch {
        return
      }
      if (msg.event === 'phx_reply' && msg.ref === '1') {
        if (msg.payload && msg.payload.status === 'ok') {
          joined = true
          joinOk.add(1)
        } else {
          joinFail.add(1)
        }
      }
    })

    socket.on('error', () => joinFail.add(1))
    socket.on('close', () => {
      closes.add(1)
      if (!joined) joinFail.add(1)
    })

    socket.setTimeout(() => socket.close(), HOLD_S * 1000)
  })

  check(res, { 'ws handshake ok (101)': (r) => r && r.status === 101 })
  if (!res || res.status !== 101) joinFail.add(1)
}
