/**
 * @jest-environment node
 *
 * Il modulo non deve richiedere `window` all'import (SSR-safe): in Next.js il
 * root layout è statico e non deve rompersi se il modulo viene valutato in un
 * contesto server. Qui l'ambiente è node (nessun `window`).
 */
import {
  ensureSession,
  csrfFetch,
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
} from '@/lib/session-client'

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response
}

beforeEach(() => clearCsrfToken())

it('si importa e opera senza window', async () => {
  expect(typeof window).toBe('undefined')

  setCsrfToken('csrf-ssr')
  expect(getCsrfToken()).toBe('csrf-ssr')

  const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}))
  global.fetch = fetchMock as unknown as typeof fetch
  await csrfFetch('/api/vota/status', { method: 'POST' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('ensureSession fallisce in modo controllato senza fetch disponibile', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('no network')) as unknown as typeof fetch
  const ok = await ensureSession(() => Promise.resolve({ token: 't', cData: 'c' }))
  expect(ok).toBe(false)
})
