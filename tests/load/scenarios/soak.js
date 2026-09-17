import { thresholds } from '../config.js'
import { fetchCompanies } from '../lib/data.js'
import { runSession } from '../lib/workload.js'

const VUS = Number(__ENV.VUS || 250)
const DURATION = __ENV.DURATION || '30m'

export const options = {
  scenarios: {
    soak: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  thresholds,
}

export function setup() {
  return { companies: fetchCompanies() }
}

export default function (data) {
  runSession(data.companies)
}
