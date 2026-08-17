import type { Locale } from '@/lib/locale'
import { translate } from '@/i18n'

/**
 * Campo honeypot: invisibile agli utenti ma presente nel DOM. Se valorizzato
 * la richiesta viene considerata spam e non parte alcuna email.
 */
export const CONTACT_HONEYPOT_FIELD = 'website'

export const CONTACT_NAME_MIN = 1
export const CONTACT_NAME_MAX = 80
export const CONTACT_EMAIL_MAX = 254
export const CONTACT_MESSAGE_MIN = 10
export const CONTACT_MESSAGE_MAX = 4000
export const CONTACT_PAYLOAD_MAX_BYTES = 16 * 1024

/**
 * Sliding window DB-backed (RPC `check_rate_limit`): lo stesso sistema già
 * usato per login/MFA admin. Override opzionali via env.
 */
export const CONTACT_RATE_IP_WINDOW_MS = 10 * 60 * 1000
export const CONTACT_RATE_IP_MAX = 5
export const CONTACT_RATE_EMAIL_WINDOW_MS = 60 * 60 * 1000
export const CONTACT_RATE_EMAIL_MAX = 3

export function contactRateIpMax(): number {
  const raw = Number(process.env.CONTACT_RATE_IP_MAX)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : CONTACT_RATE_IP_MAX
}

export function contactRateEmailMax(): number {
  const raw = Number(process.env.CONTACT_RATE_EMAIL_MAX)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : CONTACT_RATE_EMAIL_MAX
}

export interface ContactPayload {
  name: string
  email: string
  message: string
}

export type ContactValidationResult =
  | { success: true; data: ContactPayload }
  | { success: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validazione server-side (mai fidarsi del client). Accetta solo i campi
 * previsti: ogni chiave extra viene ignorata. Applica trim e normalizza
 * l'email in minuscolo.
 */
export function validateContactInput(input: unknown): ContactValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, error: 'invalid_payload' }
  }

  const record = input as Record<string, unknown>

  if (typeof record.name !== 'string') return { success: false, error: 'invalid_name' }
  const name = record.name.trim()
  if (name.length < CONTACT_NAME_MIN || name.length > CONTACT_NAME_MAX) {
    return { success: false, error: 'invalid_name' }
  }

  if (typeof record.email !== 'string') return { success: false, error: 'invalid_email' }
  const email = record.email.trim().toLowerCase()
  if (email.length === 0 || email.length > CONTACT_EMAIL_MAX || !EMAIL_RE.test(email)) {
    return { success: false, error: 'invalid_email' }
  }

  if (typeof record.message !== 'string') return { success: false, error: 'invalid_message' }
  const message = record.message.trim()
  if (message.length < CONTACT_MESSAGE_MIN || message.length > CONTACT_MESSAGE_MAX) {
    return { success: false, error: 'invalid_message' }
  }

  return { success: true, data: { name, email, message } }
}

export function isHoneypotFilled(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const value = (body as Record<string, unknown>)[CONTACT_HONEYPOT_FIELD]
  return typeof value === 'string' && value.trim().length > 0
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface ContactEmail {
  from: string
  to: string
  replyTo: string
  subject: string
  text: string
  html: string
}

export function isContactEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.CONTACT_TO_EMAIL?.trim() &&
      process.env.CONTACT_FROM_EMAIL?.trim(),
  )
}

/**
 * Costruisce l'email interamente lato server: destinatario e mittente
 * provengono dalle env, `Reply-To` è l'email del visitatore. I dati utente
 * sono sempre escaped nel template HTML. Da chiamare solo quando
 * `isContactEmailConfigured()` è true.
 */
export function buildContactEmail(locale: Locale, payload: ContactPayload): ContactEmail {
  const from = process.env.CONTACT_FROM_EMAIL!.trim()
  const to = process.env.CONTACT_TO_EMAIL!.trim()
  const subject = translate(locale, 'contact.emailSubject', { name: payload.name })
  const sentAt = new Date().toISOString()

  const text = [
    translate(locale, 'contact.emailIntro'),
    '',
    `${translate(locale, 'contact.emailName')}: ${payload.name}`,
    `${translate(locale, 'contact.emailAddress')}: ${payload.email}`,
    `${translate(locale, 'contact.emailSentAt')}: ${sentAt}`,
    '',
    `${translate(locale, 'contact.emailMessage')}:`,
    payload.message,
  ].join('\n')

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #111111;">
      <p><strong>${translate(locale, 'contact.emailName')}:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>${translate(locale, 'contact.emailAddress')}:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>${translate(locale, 'contact.emailSentAt')}:</strong> ${escapeHtml(sentAt)}</p>
      <hr style="border: none; border-top: 1px solid #eeeeee; margin: 16px 0;" />
      <p><strong>${translate(locale, 'contact.emailMessage')}:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(payload.message)}</p>
    </div>
  `.trim()

  return { from, to, replyTo: payload.email, subject, text, html }
}