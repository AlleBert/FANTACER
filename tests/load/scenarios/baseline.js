import { thresholds } from '../config.js'
import { fetchCompanies } from '../lib/data.js'
import { runSession } from '../lib/workload.js'

const VUS = Number(__ENV.VUS || 500)
const RAMP = __ENV.RAMP || '3m'
const HOLD = __ENV.HOLD || '10m'

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds,
}

export function setup() {
  return { companies: fetchCompanies() }
}

export default function (data) {
  runSession(data.companies)
}
