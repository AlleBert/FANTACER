/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/contact/route'
import { CONTACT_PAYLOAD_MAX_BYTES } from '../src/lib/contact'

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(),
}))
jest.mock('resend', () => ({ Resend: jest.fn() }))

import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { Resend } from 'resend'

const mockCheckRateLimit = checkRateLimit as unknown as jest.Mock
const mockGetClientIp = getClientIp as unknown as jest.Mock
const mockResend = Resend as unknown as jest.Mock

const send = jest.fn()

const ORIGINAL_ENV = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
  CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
}

const VALID_BODY = {
  name: 'Mario Rossi',
  email: 'mario@example.com',
  message: 'Ciao, vorrei maggiori informazioni sulla manifestazione.',
}

function contactRequest(
  body: unknown,
  opts: {
    contentLength?: number
    origin?: string
    acceptLanguage?: string
    malformed?: boolean
  } = {},
): NextRequest {
  const headers = new Headers()
  headers.set('content-type', 'application/json')
  if (opts.contentLength !== undefined) headers.set('content-length', String(opts.contentLength))
  if (opts.origin !== undefined) headers.set('origin', opts.origin)
  if (opts.acceptLanguage !== undefined) headers.set('accept-language', opts.acceptLanguage)
  return {
    headers,
    cookies: { get: () => null },
    nextUrl: { origin: 'https://fantacer.com' },
    json: async () => {
      if (opts.malformed) throw new Error('Unexpected end of JSON input')
      return body
    },
  } as unknown as NextRequest
}

beforeAll(() => {
  process.env.RESEND_API_KEY = 're_testkey'
  process.env.CONTACT_TO_EMAIL = 'owner@fantacer.com'
  process.env.CONTACT_FROM_EMAIL = 'website@fantacer.com'
  mockResend.mockImplementation(() => ({ emails: { send } }))
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetClientIp.mockReturnValue('1.2.3.4')
  mockCheckRateLimit.mockResolvedValue(true)
  send.mockResolvedValue({ data: { id: 'email_1' }, error: null })
})

afterAll(() => {
  if (ORIGINAL_ENV.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = ORIGINAL_ENV.RESEND_API_KEY
  if (ORIGINAL_ENV.CONTACT_TO_EMAIL === undefined) delete process.env.CONTACT_TO_EMAIL
  else process.env.CONTACT_TO_EMAIL = ORIGINAL_ENV.CONTACT_TO_EMAIL
  if (ORIGINAL_ENV.CONTACT_FROM_EMAIL === undefined) delete process.env.CONTACT_FROM_EMAIL
  else process.env.CONTACT_FROM_EMAIL = ORIGINAL_ENV.CONTACT_FROM_EMAIL
})

describe('POST /api/contact', () => {
  it('Caso 1: form valido → email inviata con to/from server e replyTo utente', async () => {
    const res = await POST(contactRequest(VALID_BODY))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0][0]
    expect(call.to).toBe('owner@fantacer.com')
    expect(call.from).toBe('website@fantacer.com')
    expect(call.replyTo).toBe('mario@example.com')
    expect(call.subject).toContain('Mario Rossi')
    expect(typeof call.text).toBe('string')
    expect(typeof call.html).toBe('string')
  })

  it('Caso 2: email non valida → 400, nessuna email', async () => {
    const res = await POST(contactRequest({ ...VALID_BODY, email: 'not-an-email' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'invalid_email' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Caso 3: nome mancante → 400, nessuna email', async () => {
    const res = await POST(contactRequest({ ...VALID_BODY, name: '   ' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'invalid_name' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Caso 4: messaggio vuoto → 400, nessuna email', async () => {
    const res = await POST(contactRequest({ ...VALID_BODY, message: '' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'invalid_message' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Caso 5: messaggio troppo lungo → 400, nessuna email', async () => {
    const res = await POST(contactRequest({ ...VALID_BODY, message: 'a'.repeat(4001) }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'invalid_message' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Caso 6: honeypot valorizzato → 200 success, nessuna email', async () => {
    const res = await POST(contactRequest({ ...VALID_BODY, website: 'http://spam.example.com' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(send).not.toHaveBeenCalled()
  })

  it('Caso 7: rate limit IP superato → 429', async () => {
    mockCheckRateLimit.mockResolvedValueOnce(false)

    const res = await POST(contactRequest(VALID_BODY))

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ success: false, error: 'too_many_requests' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Rate limit per email superato → 429 (IP ok, email ko)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const res = await POST(contactRequest(VALID_BODY))

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ success: false, error: 'too_many_requests' })
    expect(send).not.toHaveBeenCalled()
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'contact:email:mario@example.com',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('Caso 8: errore Resend → 500 senza dettagli sensibili', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'API key is invalid' } })

    const res = await POST(contactRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ success: false, error: 'send_failed' })
    expect(JSON.stringify(body)).not.toMatch(/API key|Resend|invalid/i)
  })

  it('Caso 9: RESEND_API_KEY mancante → 500 senza esporre il secret', async () => {
    const prev = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      const res = await POST(contactRequest(VALID_BODY))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body).toEqual({ success: false, error: 'not_configured' })
      expect(JSON.stringify(body)).not.toContain('re_')
      expect(send).not.toHaveBeenCalled()
    } finally {
      if (prev !== undefined) process.env.RESEND_API_KEY = prev
    }
  })

  it('Caso 10: to/from/subject dal client vengono ignorati', async () => {
    const res = await POST(
      contactRequest({
        ...VALID_BODY,
        to: 'evil@example.com',
        from: 'evil@example.com',
        subject: 'HACKED',
      }),
    )

    expect(res.status).toBe(200)
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0][0]
    expect(call.to).toBe('owner@fantacer.com')
    expect(call.from).toBe('website@fantacer.com')
    expect(call.subject).not.toBe('HACKED')
    expect(call.subject).toContain('Mario Rossi')
  })

  it('Caso 11: JSON malformato → 400', async () => {
    const res = await POST(contactRequest(null, { malformed: true }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'invalid_payload' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Caso 12: payload oltre il limite → 413', async () => {
    const res = await POST(
      contactRequest(VALID_BODY, { contentLength: CONTACT_PAYLOAD_MAX_BYTES + 1 }),
    )

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ success: false, error: 'payload_too_large' })
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('Origin cross-site → 403', async () => {
    const res = await POST(contactRequest(VALID_BODY, { origin: 'https://evil.example.com' }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ success: false, error: 'forbidden' })
    expect(send).not.toHaveBeenCalled()
  })

  it('Campi extra arbitrari vengono ignorati, non rifiutano', async () => {
    const res = await POST(contactRequest({ ...VALID_BODY, headers: { x: '1' }, template: 'x' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('I dati utente sono escaped nel template HTML', async () => {
    const res = await POST(
      contactRequest({ ...VALID_BODY, message: 'Test <script>alert(1)</script> & "quotes"' }),
    )

    expect(res.status).toBe(200)
    const call = send.mock.calls[0][0]
    expect(call.html).toContain('&lt;script&gt;')
    expect(call.html).toContain('&amp;')
    expect(call.html).not.toContain('<script>')
  })
})