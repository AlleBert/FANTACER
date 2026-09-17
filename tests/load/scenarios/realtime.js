import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Counter, Rate } from 'k6/metrics'
import { REALTIME_URL, SUPABASE_ANON_KEY } from '../config.js'

const VUS = Number(__ENV.VUS || 500)
const HOLD_S = Number(__ENV.HOLD_SECONDS || 300)
const RAMP = __ENV.RAMP || '1m'
const HOLD = __ENV.HOLD || '5m'
const DOWN = __ENV.DOWN || '30s'
const FAIL_BACKOFF_S = Number(__ENV.FAIL_BACKOFF_S || 1)
const TOPIC = 'realtime:live-ranking-votes'

const joinOk = new Counter('realtime_join_ok')
const connectFailures = new Counter('realtime_connect_failures')
const joinFailures = new Counter('realtime_join_failures')
const closes = new Counter('realtime_closes')
const connectSuccess = new Rate('realtime_connect_success')
const joinSuccess = new Rate('realtime_join_success')

export const options = {
  scenarios: {
    realtime: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: HOLD, target: VUS },
        { duration: DOWN, target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'ws_connecting': ['p(95)<2000'],
    realtime_connect_success: ['rate>0.95'],
    realtime_join_success: ['rate>0.95'],
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
          joinFailures.add(1)
        }
      }
    })

    socket.on('error', () => joinFailures.add(1))
    socket.on('close', () => {
      closes.add(1)
      if (!joined) joinFailures.add(1)
    })

    socket.setTimeout(() => socket.close(), HOLD_S * 1000)
  })

  const handshakeOk = !!(res && res.status === 101)
  check(res, { 'ws handshake ok (101)': () => handshakeOk })
  connectSuccess.add(handshakeOk ? 1 : 0)
  joinSuccess.add(handshakeOk && joined ? 1 : 0)

  if (!handshakeOk) {
    connectFailures.add(1)
  } else if (!joined) {
    joinFailures.add(1)
  }

  // Backoff sui fallimenti: evita la tempesta di riconnessioni quando il
  // server rifiuta (es. cap connessioni del piano Free).
  if (!handshakeOk || !joined) {
    sleep(FAIL_BACKOFF_S)
  }
}
