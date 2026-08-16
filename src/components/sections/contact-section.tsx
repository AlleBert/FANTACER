'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { OPEN_COOKIE_PREFERENCES_EVENT } from '@/components/cookie-consent'

const FOOTER_LINKS = {
  cookiePolicy: 'https://www.fantacer.com/cookie-policy',
  privacy: 'https://www.fantacer.com/privacy-policy',
  terms: 'https://www.fantacer.com/terms-and-conditions',
} as const

export function ContactSection() {
  const { t } = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => setStatus('idle'), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !message) return

    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      if (!res.ok) throw new Error('Errore invio')
      setStatus('success')
      setName('')
      setEmail('')
      setMessage('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <SectionFrame
      theme="contact"
      id="contact-section"
      className="flex flex-col"
    >
      <div className="safe-shell w-full max-w-7xl mx-auto flex flex-1 flex-col min-h-0">
        <div className="flex-1 flex w-full flex-col items-center justify-center gap-[clamp(0.5rem,min(2vw,3svh),1.5rem)] lg:flex-row-reverse lg:gap-10 min-h-0">

          {/* Info section */}
          <div className="flex w-full flex-col items-center gap-[clamp(0.5rem,min(1.5vw,2.5svh),1.5rem)] text-center lg:w-1/2 lg:items-start lg:text-left shrink-0">
            <h2 className="text-[clamp(1.1rem,min(4vw,6svh),3.5rem)] font-[900] text-white tracking-tighter uppercase leading-[1.08]">
              {t('contact.title1')}<br className="sm:hidden"/>
              <span className="hidden sm:inline"> </span>{t('contact.title2')}
            </h2>

            <div className="flex w-full flex-col items-center gap-[clamp(0.375rem,1vw,1rem)] sm:flex-row sm:flex-wrap sm:justify-center lg:gap-4 lg:items-start">
              <div className="bg-white px-[clamp(1rem,min(3vw,5svh),1.5rem)] py-[clamp(0.375rem,1vw,0.75rem)] lg:py-4 rounded-full border-2 border-ink shadow-[3px_3px_0_#000] -rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(0.75rem,min(2vw,3svh),1.25rem)] font-black text-black lowercase">team@fantacer.com</p>
              </div>
              <div className="bg-bright px-[clamp(1rem,min(3vw,5svh),1.5rem)] py-[clamp(0.375rem,1vw,0.75rem)] lg:py-4 rounded-full border-2 border-ink shadow-[3px_3px_0_#000] rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(0.75rem,min(2vw,3svh),1.25rem)] font-black text-black tracking-wider">+393331385574</p>
              </div>
              <a href="https://www.fantacer.com" target="_blank" rel="noopener noreferrer" className="bg-white px-[clamp(1rem,min(3vw,5svh),1.5rem)] py-[clamp(0.375rem,1vw,0.75rem)] lg:py-4 rounded-full border-2 border-ink shadow-[3px_3px_0_#000] -rotate-1 hover:rotate-0 transition-transform hover:-translate-y-0.5 block">
                <p className="text-[clamp(0.75rem,min(2vw,3svh),1.25rem)] font-black text-purple lowercase">www.fantacer.com</p>
              </a>
            </div>
          </div>

          {/* Form section */}
          <div className="w-full lg:w-1/2 rounded-2xl md:rounded-3xl border-[3px] border-ink bg-white p-[clamp(0.75rem,min(2.5vw,4svh),1.25rem)] md:p-4 lg:p-6 shadow-[6px_6px_0_#000] flex flex-col min-h-0 box-border">
            <h3 className="text-[clamp(0.875rem,min(2vw,3svh),1.5rem)] font-black text-black uppercase tracking-tighter mb-[clamp(0.25rem,1vw,0.5rem)] lg:mb-3 text-center leading-tight shrink-0">
              {t('contact.sendMessage')}
            </h3>

            {status === 'success' && (
              <div role="alert" aria-live="polite" className="mb-2 md:mb-4 px-3 py-2 bg-green-100 text-green-900 font-bold text-xs md:text-sm rounded-xl border-2 border-green-500 text-center shrink-0">
                {t('contact.success')}
              </div>
            )}

            {status === 'error' && (
              <div role="alert" aria-live="polite" className="mb-2 md:mb-4 px-3 py-2 bg-red-100 text-red-900 font-bold text-xs md:text-sm rounded-xl border-2 border-red-400 text-center shrink-0">
                {t('contact.error')}
              </div>
            )}

            <form className="grid grid-cols-1 sm:grid-cols-2 gap-[clamp(0.375rem,min(1vw,2svh),0.75rem)] flex-1 min-h-0 w-full box-border content-start items-stretch" onSubmit={handleSubmit}>
              <input
                type="text"
                name="nome"
                placeholder={t('contact.namePlaceholder')}
                required
                aria-label={t('contact.nameLabel')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 md:px-5 py-[clamp(0.375rem,1vw,0.5rem)] xl:py-4 text-[clamp(0.75rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-full border-[3px] border-ink focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all min-h-11 box-border"
              />
              <input
                type="email"
                name="email"
                placeholder={t('contact.emailPlaceholder')}
                required
                aria-label={t('contact.emailLabel')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 md:px-5 py-[clamp(0.375rem,1vw,0.5rem)] xl:py-4 text-[clamp(0.75rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-full border-[3px] border-ink focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all min-h-11 box-border"
              />
              <textarea
                name="messaggio"
                placeholder={t('contact.messagePlaceholder')}
                rows={2}
                required
                aria-label={t('contact.messageLabel')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 md:px-5 py-[clamp(0.375rem,1vw,0.5rem)] xl:py-4 text-[clamp(0.75rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-2xl border-[3px] border-ink focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all resize-none flex-1 min-h-[3rem] box-border sm:col-span-2"
              />
              <Button
                type="submit"
                disabled={status === 'loading' || !name || !email || !message}
                className="w-full bg-purple hover:bg-[#6b00d6] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0_#000] disabled:hover:translate-y-0 text-[clamp(0.875rem,1.5vw,1.125rem)] font-black px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.5rem,1.5vw,0.75rem)] xl:py-4 min-h-11 rounded-full border-[3px] border-ink shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all shrink-0 box-border sm:col-span-2"
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

        </div>
      </div>

      {/* Footer legale */}
      <footer className="flex-shrink-0 pb-[max(0.5rem,var(--safe-bottom))] pt-[clamp(0.5rem,1.5vw,1rem)]">
        <div className="safe-px mx-auto flex w-full max-w-[min(95vw,900px)] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT))}
            className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.cookieConsent')}
          </button>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.cookiePolicy}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.cookiePolicy')}
          </a>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.privacyPolicy')}
          </a>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.terms')}
          </a>
        </div>
      </footer>
    </SectionFrame>
  )
}