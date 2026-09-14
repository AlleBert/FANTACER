'use client'

import { useState, useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Phone, Globe, type LucideIcon } from 'lucide-react'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { SiteFooter } from '@/components/layout/site-footer'
import { CONTACT_NAME_MAX, CONTACT_EMAIL_MAX, CONTACT_MESSAGE_MIN, CONTACT_MESSAGE_MAX } from '@/lib/contact'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ContactMethodKey = 'email' | 'phone' | 'site'

interface ContactMethod {
  key: ContactMethodKey
  href: string
  value: string
  icon: LucideIcon
  bg: string
  tilt: string
  external?: boolean
}

const CONTACT_METHODS: ContactMethod[] = [
  { key: 'email', href: 'mailto:team@fantacer.com', value: 'team@fantacer.com', icon: Mail, bg: 'bg-white text-black', tilt: '-rotate-2' },
  { key: 'phone', href: 'tel:+393331385574', value: '+39 333 138 5574', icon: Phone, bg: 'bg-bright text-black', tilt: 'rotate-2' },
  { key: 'site', href: 'https://www.fantacer.com', value: 'www.fantacer.com', icon: Globe, bg: 'bg-white text-purple', tilt: '-rotate-1', external: true },
]

function useIsWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(min-width: 32rem)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return wide
}

const chipShell =
  'min-h-11 rounded-full border-[3px] border-ink shadow-[3px_3px_0_#000] transition-transform motion-reduce:transition-none hover:rotate-0 hover:-translate-y-0.5'

function ContactMethodLink({ method }: { method: ContactMethod }) {
  const Icon = method.icon
  return (
    <a
      href={method.href}
      target={method.external ? '_blank' : undefined}
      rel={method.external ? 'noopener noreferrer' : undefined}
      className={`${chipShell} ${method.bg} ${method.tilt} contact-chip inline-flex items-center gap-2.5 px-5 text-base font-black tracking-wide`}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="whitespace-nowrap">{method.value}</span>
    </a>
  )
}

function ContactChip({ method, open, onToggle }: { method: ContactMethod; open: boolean; onToggle: () => void }) {
  const Icon = method.icon
  return (
    <span className={`${chipShell} ${method.bg} ${method.tilt} contact-chip inline-flex items-center ${open ? 'rotate-0' : ''}`} data-contact-chip>
      <button
        type="button"
        aria-label={method.value}
        aria-expanded={open}
        onClick={onToggle}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
      <a
        href={method.href}
        target={method.external ? '_blank' : undefined}
        rel={method.external ? 'noopener noreferrer' : undefined}
        data-open={open}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        className="contact-chip__link whitespace-nowrap text-sm font-black"
      >
        <span className="contact-chip__text">{method.value}</span>
      </a>
    </span>
  )
}

export function ContactSection() {
  const { t } = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({})
  const [openMethod, setOpenMethod] = useState<ContactMethodKey | null>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const isWide = useIsWide()

  const uid = useId()
  const nameId = `${uid}-name`
  const emailId = `${uid}-email`
  const messageId = `${uid}-message`

  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => setStatus('idle'), 5000)
    return () => clearTimeout(timer)
  }, [status])

  // Auto-grow della textarea: parte da 1 riga, cresce col contenuto fino al
  // max-height definito in CSS, poi scrolla internamente (unica scrollbar ammessa).
  useEffect(() => {
    const ta = messageRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [message])

  useEffect(() => {
    if (!openMethod) return
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-contact-chip]')) setOpenMethod(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMethod(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMethod])

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = t('contact.errorNameRequired')
    if (!email.trim() || !EMAIL_RE.test(email.trim())) next.email = t('contact.errorEmailInvalid')
    const trimmedMessage = message.trim()
    if (!trimmedMessage) next.message = t('contact.errorMessageRequired')
    else if (trimmedMessage.length < CONTACT_MESSAGE_MIN) next.message = t('contact.errorMessageTooShort')
    return next
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      })
      if (!res.ok) throw new Error('Errore invio')
      setStatus('success')
      setName('')
      setEmail('')
      setMessage('')
      setWebsite('')
    } catch {
      setStatus('error')
    }
  }

  const fieldCls =
    'w-full px-4 md:px-5 py-[clamp(0.375rem,1vw,0.5rem)] text-base bg-white text-black font-bold rounded-full border-[3px] border-ink focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all min-h-11 box-border motion-reduce:transition-none motion-reduce:focus:translate-y-0'
  const errorCls = 'text-[clamp(0.6875rem,1.6vw,0.8125rem)] font-bold text-red-600 text-left normal-case'

  return (
    <SectionFrame theme="contact" id="contact-section" className="flex flex-col">
      <div className="safe-shell content-max flex flex-1 flex-col min-h-0">
        <div className="contact-region">
          <div className="contact-layout">
            <h2 className="contact-info-title font-[900] text-white tracking-tighter uppercase leading-(--lh-headline)">
              {t('contact.title1')}
              <span className="hidden sm:inline"> </span>
              <br className="sm:hidden" />
              {t('contact.title2')}
            </h2>

            <div className="contact-form-card rounded-2xl md:rounded-3xl border-[3px] border-ink bg-white p-[clamp(0.75rem,min(2.5vw,4svh),1.25rem)] md:p-4 lg:p-6 shadow-[6px_6px_0_#000] box-border">
              <h3 className="text-[clamp(0.875rem,min(2vw,3svh),1.5rem)] font-black text-black uppercase tracking-tighter mb-[clamp(0.25rem,1vw,0.5rem)] lg:mb-3 text-center leading-tight shrink-0">
                {t('contact.sendMessage')}
              </h3>

              {status === 'success' && (
                <div role="status" aria-live="polite" className="mb-2 md:mb-3 px-3 py-2 bg-green-100 text-green-900 font-bold text-xs md:text-sm rounded-xl border-2 border-green-500 text-center shrink-0">
                  {t('contact.success')}
                </div>
              )}
              {status === 'error' && (
                <div role="alert" className="mb-2 md:mb-3 px-3 py-2 bg-red-100 text-red-900 font-bold text-xs md:text-sm rounded-xl border-2 border-red-400 text-center shrink-0">
                  {t('contact.error')}
                </div>
              )}

              <form
                noValidate
                className="flex flex-1 min-h-0 flex-col gap-(--rythm-blk) w-full box-border"
                onSubmit={handleSubmit}
              >
                <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="h-0 w-0 opacity-0"
                  />
                </div>

                <div className="contact-fields-row">
                  <div className="contact-field">
                    <input
                      id={nameId}
                      type="text"
                      name="nome"
                      required
                      autoComplete="name"
                      enterKeyHint="next"
                      maxLength={CONTACT_NAME_MAX}
                      placeholder={t('contact.namePlaceholder')}
                      aria-label={t('contact.nameLabel')}
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })) }}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? `${nameId}-error` : undefined}
                      className={fieldCls}
                    />
                    {errors.name && <p id={`${nameId}-error`} role="alert" className={errorCls}>{errors.name}</p>}
                  </div>
                  <div className="contact-field">
                    <input
                      id={emailId}
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="next"
                      maxLength={CONTACT_EMAIL_MAX}
                      placeholder={t('contact.emailPlaceholder')}
                      aria-label={t('contact.emailLabel')}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })) }}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? `${emailId}-error` : undefined}
                      className={fieldCls}
                    />
                    {errors.email && <p id={`${emailId}-error`} role="alert" className={errorCls}>{errors.email}</p>}
                  </div>
                </div>

                <div className="contact-field contact-field--grow">
                  <textarea
                    id={messageId}
                    ref={messageRef}
                    name="messaggio"
                    rows={1}
                    required
                    enterKeyHint="send"
                    maxLength={CONTACT_MESSAGE_MAX}
                    placeholder={t('contact.messagePlaceholder')}
                    aria-label={t('contact.messageLabel')}
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: undefined })) }}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? `${messageId}-error` : undefined}
                    className="contact-textarea w-full px-4 md:px-5 py-[clamp(0.375rem,1vw,0.5rem)] text-base bg-white text-black font-bold rounded-2xl border-[3px] border-ink focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all resize-none overflow-y-auto box-border"
                  />
                  {errors.message && <p id={`${messageId}-error`} role="alert" className={errorCls}>{errors.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-purple hover:bg-[#6b00d6] disabled:opacity-50 disabled:cursor-not-allowed text-[clamp(0.875rem,1.5vw,1.125rem)] font-black px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] min-h-11 rounded-full border-[3px] border-ink shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all shrink-0 box-border motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                      {t('contact.sending')}
                    </span>
                  ) : (
                    t('contact.submit')
                  )}
                </Button>
              </form>
            </div>

            <div className="contact-methods" data-wide={isWide}>
              {CONTACT_METHODS.map((method) =>
                isWide ? (
                  <ContactMethodLink key={method.key} method={method} />
                ) : (
                  <ContactChip
                    key={method.key}
                    method={method}
                    open={openMethod === method.key}
                    onToggle={() => setOpenMethod((p) => (p === method.key ? null : method.key))}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </SectionFrame>
  )
}
