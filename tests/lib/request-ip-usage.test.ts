/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process'

/**
 * Guard: l'unico punto dove si leggono gli header IP è `src/lib/request-ip.ts`.
 * Copre i nomi header usati per rappresentare l'IP client (inclusi quelli
 * usati da proxy/CDN), non gli header geo (es. `cf-ipcountry`).
 */
const IP_HEADERS = [
  'x-forwarded-for',
  'cf-connecting-ip',
  'x-real-ip',
  'x-client-ip',
  'true-client-ip',
  'x-forwarded-host',
  'forwarded',
].join('|')

it('nessuna lettura diretta di header IP fuori da request-ip.ts', () => {
  const pattern = `headers\\.(get|has)\\(\\s*['"](${IP_HEADERS})['"]`

  let out = ''
  try {
    out = execFileSync(
      'grep',
      ['-rniE', pattern, 'src', '--include=*.ts', '--include=*.tsx'],
      { encoding: 'utf8' },
    )
  } catch (error) {
    // grep esce con 1 quando non trova match: nessun offender.
    const err = error as { status?: number; stdout?: string }
    if (err.status === 1) out = ''
    else throw error
  }

  const offenders = out
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.includes('src/lib/request-ip.ts'))

  if (offenders.length > 0) {
    throw new Error(`Letture IP dirette residue:\n${offenders.join('\n')}`)
  }
  expect(offenders).toEqual([])
})
