import { thresholds } from '../config.js'
import { fetchCompanies } from '../lib/data.js'
import { runSession } from '../lib/workload.js'

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 3, duration: '1m' },
  },
  thresholds,
}

export function setup() {
  return { companies: fetchCompanies() }
}

export default function (data) {
  runSession(data.companies, 3000)
}
