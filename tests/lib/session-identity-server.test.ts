/**
 * @jest-environment node
 */
import { sessionIdentityMode } from '@/lib/session-identity-server'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

it('default off', () => {
  delete process.env.SESSION_IDENTITY_MODE
  expect(sessionIdentityMode()).toBe('off')
})

it('accetta shadow/dual/session', () => {
  for (const m of ['shadow', 'dual', 'session'] as const) {
    process.env.SESSION_IDENTITY_MODE = m
    expect(sessionIdentityMode()).toBe(m)
  }
})

it('valori ignoti → off (fail-safe)', () => {
  process.env.SESSION_IDENTITY_MODE = 'banana'
  expect(sessionIdentityMode()).toBe('off')
})
