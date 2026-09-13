'use client'

import { useState, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Phone, Globe } from 'lucide-react'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { SiteFooter } from '@/components/layout/site-footer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ContactSection() {
  const { t } = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({})

  const uid = useId()
  const nameId = `${uid}-name`
  const emailId = `${uid}-email`
  const messageId = `${uid}-message`

  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => setStatus('idle'), 5000)
    return () => clearTimeout(timer)
  }, [status])

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = t('contact.errorNameRequired')
    if (!email.trim() || !EMAIL_RE.test(email.trim())) next.email = t('contact.errorEmailInvalid')
    if (!message.trim()) next.message = t('contact.errorMessageRequired')
    return next
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
  const labelCls = 'text-(length:--fs-label) font-black uppercase tracking-wide text-black text-left'
  const errorCls = 'text-[clamp(0.6875rem,1.6vw,0.8125rem)] font-bold text-red-600 text-left normal-case'

  return (
    <SectionFrame theme="contact" id="contact-section" className="flex flex-col">
      <div className="safe-shell content-max flex flex-1 flex-col min-h-0">
        <div className="contact-region">
          <div className="contact-layout">
            <h2 className="contact-info-title text-(length:--fs-headline) font-[900] text-white tracking-tighter uppercase leading-(--lh-headline)">
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
                <div role="alert" aria-live="polite" className="mb-2 md:mb-3 px-3 py-2 bg-green-100 text-green-900 font-bold text-xs md:text-sm rounded-xl border-2 border-green-500 text-center shrink-0">
                  {t('contact.success')}
                </div>
              )}
              {status === 'error' && (
                <div role="alert" aria-live="polite" className="mb-2 md:mb-3 px-3 py-2 bg-red-100 text-red-900 font-bold text-xs md:text-sm rounded-xl border-2 border-red-400 text-center shrink-0">
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
                    <label htmlFor={nameId} className={labelCls}>{t('contact.nameLabel')}</label>
                    <input
                      id={nameId}
                      type="text"
                      name="nome"
                      required
                      autoComplete="name"
                      placeholder={t('contact.namePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? `${nameId}-error` : undefined}
                      className={fieldCls}
                    />
                    {errors.name && <p id={`${nameId}-error`} className={errorCls}>{errors.name}</p>}
                  </div>
                  <div className="contact-field">
                    <label htmlFor={emailId} className={labelCls}>{t('contact.emailLabel')}</label>
                    <input
                      id={emailId}
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      placeholder={t('contact.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? `${emailId}-error` : undefined}
                      className={fieldCls}
                    />
                    {errors.email && <p id={`${emailId}-error`} className={errorCls}>{errors.email}</p>}
                  </div>
                </div>

                <div className="contact-field contact-field--grow">
                  <label htmlFor={messageId} className={labelCls}>{t('contact.messageLabel')}</label>
                  <textarea
                    id={messageId}
                    name="messaggio"
                    required
                    placeholder={t('contact.messagePlaceholder')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? `${messageId}-error` : undefined}
                    className="w-full flex-1 min-h-[3rem] px-4 md:px-5 py-[clamp(0.375rem,1vw,0.5rem)] text-base bg-white text-black font-bold rounded-2xl border-[3px] border-ink focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all resize-none overflow-y-auto box-border"
                  />
                  {errors.message && <p id={`${messageId}-error`} className={errorCls}>{errors.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full bg-purple hover:bg-[#6b00d6] disabled:opacity-50 disabled:cursor-not-allowed text-[clamp(0.875rem,1.5vw,1.125rem)] font-black px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] min-h-11 rounded-full border-[3px] border-ink shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all shrink-0 box-border motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('contact.sending')}
                    </span>
                  ) : (
                    t('contact.submit')
                  )}
                </Button>
              </form>
            </div>

            <div className="contact-methods">
              <a
                href="mailto:team@fantacer.com"
                aria-label="team@fantacer.com"
                className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-full border-[3px] border-ink bg-white text-black font-black shadow-[3px_3px_0_#000] -rotate-2 hover:rotate-0 hover:-translate-y-0.5 transition-transform motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Mail className="size-5" aria-hidden="true" />
                <span className="contact-method-label">team@fantacer.com</span>
              </a>
              <a
                href="tel:+393331385574"
                aria-label="+39 333 138 5574"
                className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-full border-[3px] border-ink bg-bright text-black font-black shadow-[3px_3px_0_#000] rotate-2 hover:rotate-0 hover:-translate-y-0.5 transition-transform motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Phone className="size-5" aria-hidden="true" />
                <span className="contact-method-label">+39 333 138 5574</span>
              </a>
              <a
                href="https://www.fantacer.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="www.fantacer.com"
                className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-3 rounded-full border-[3px] border-ink bg-white text-purple font-black shadow-[3px_3px_0_#000] -rotate-1 hover:rotate-0 hover:-translate-y-0.5 transition-transform motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Globe className="size-5" aria-hidden="true" />
                <span className="contact-method-label">www.fantacer.com</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </SectionFrame>
  )
}
