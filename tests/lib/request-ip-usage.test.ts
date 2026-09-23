/**
 * @jest-environment node
 */
import { execSync } from 'node:child_process'

it('nessuna lettura diretta di header IP fuori da request-ip.ts', () => {
  const out = execSync(
    "grep -rniE \"headers.get\\('(x-forwarded-for|cf-connecting-ip|x-real-ip)'\" src --include='*.ts' --include='*.tsx' || true",
  ).toString()

  const offenders = out
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.includes('src/lib/request-ip.ts'))

  if (offenders.length > 0) {
    throw new Error(`Letture IP dirette residue:\n${offenders.join('\n')}`)
  }
  expect(offenders).toEqual([])
})
