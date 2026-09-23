import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import {
  CONTACT_PAYLOAD_MAX_BYTES,
  CONTACT_RATE_EMAIL_WINDOW_MS,
  CONTACT_RATE_IP_WINDOW_MS,
  buildContactEmail,
  contactRateEmailMax,
  contactRateIpMax,
  isContactEmailConfigured,
  isHoneypotFilled,
  validateContactInput,
} from '@/lib/contact'

export const runtime = 'nodejs'

/**
 * Rejecta richieste cross-origin esplicite (header `Origin` presente e non
 * uguale all'origine dell'app). Fail-open su Origin assente o `null`.
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') return true
  try {
    return new URL(origin).origin === request.nextUrl.origin
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? 'noip'

  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > CONTACT_PAYLOAD_MAX_BYTES) {
    return NextResponse.json({ success: false, error: 'payload_too_large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  // Honeypot valorizzato → risposta coerente, nessuna email, nessun reveal.
  if (isHoneypotFilled(body)) {
    return NextResponse.json({ success: true })
  }

  const allowedByIp = await checkRateLimit(
    `contact:ip:${ip}`,
    CONTACT_RATE_IP_WINDOW_MS,
    contactRateIpMax(),
  )
  if (!allowedByIp) {
    return NextResponse.json({ success: false, error: 'too_many_requests' }, { status: 429 })
  }

  const result = validateContactInput(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }

  const allowedByEmail = await checkRateLimit(
    `contact:email:${result.data.email}`,
    CONTACT_RATE_EMAIL_WINDOW_MS,
    contactRateEmailMax(),
  )
  if (!allowedByEmail) {
    return NextResponse.json({ success: false, error: 'too_many_requests' }, { status: 429 })
  }

  if (!isContactEmailConfigured()) {
    console.error(
      'Contact form not configured: missing RESEND_API_KEY / CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL',
    )
    return NextResponse.json({ success: false, error: 'not_configured' }, { status: 500 })
  }

  const locale = resolveLocale(
    request.headers.get('accept-language'),
    request.cookies.get(LOCALE_COOKIE)?.value ?? null,
  )
  const email = buildContactEmail(locale, result.data)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const { data, error } = await resend.emails.send({
      from: email.from,
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })

    if (error || !data) {
      console.error('Contact email send error:', error?.message || 'unknown')
      return NextResponse.json({ success: false, error: 'send_failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact email send exception:', err)
    return NextResponse.json({ success: false, error: 'send_failed' }, { status: 500 })
  }
}