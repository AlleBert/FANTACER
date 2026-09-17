import { thresholds } from '../config.js'
import { fetchCompanies } from '../lib/data.js'
import { runVoteBurst } from '../lib/workload.js'

const PEAK = Number(__ENV.PEAK || 50)
const BASE = Number(__ENV.BASE_RATE || 5)

export const options = {
  scenarios: {
    vote_spike: {
      executor: 'ramping-arrival-rate',
      startRate: BASE,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: BASE },
        { duration: '30s', target: PEAK },
        { duration: '2m', target: PEAK },
        { duration: '30s', target: BASE },
        { duration: '1m', target: BASE },
      ],
    },
  },
  thresholds,
}

export function setup() {
  return { companies: fetchCompanies() }
}

export default function (data) {
  runVoteBurst(data.companies)
}
