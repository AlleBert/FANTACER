'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useLocale } from '@/lib/LocaleContext'
import { OPEN_COOKIE_PREFERENCES_EVENT } from '@/components/cookie-consent'

const FOOTER_LINKS = {
  cookiePolicy: 'https://www.fantacer.com/cookie-policy',
  privacy: 'https://www.fantacer.com/privacy-policy',
  terms: 'https://www.fantacer.com/terms-and-conditions',
  legalNotices: 'https://www.fantacer.com/legal-notices',
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
    <section
      id="contact-section"
      className="snap-start relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#FF2FB2_0%,#4B00AB_60%,#4B00AB_100%)] flex flex-col items-center justify-center overflow-hidden"
    >
      <div className="safe-shell w-full max-w-7xl mx-auto flex flex-col items-center justify-center">
        <div className="relative z-10 flex w-full flex-col items-center justify-center gap-8 lg:flex-row-reverse lg:gap-16 pb-16">

          {/* Top mobile / Right desktop: info */}
          <div className="flex w-full flex-col items-center gap-4 text-center lg:w-1/2 lg:items-start lg:text-left">
            <h2 className="text-[clamp(2rem,7vw,90px)] font-[900] text-white tracking-tighter uppercase leading-[0.9]">
              {t('contact.title1')}<br className="sm:hidden"/>
              <span className="hidden sm:inline"> </span>{t('contact.title2')}
            </h2>

            <div className="flex w-full flex-col items-center gap-3 lg:gap-6 lg:items-start">
              <div className="bg-white px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] -rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-black lowercase">fantacer@fantacer.com</p>
              </div>
              <div className="bg-[#fccb27] px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-black tracking-wider">00 000 000</p>
              </div>
              <a href="https://www.fantacer.com" target="_blank" rel="noopener noreferrer" className="bg-white px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] -rotate-1 hover:rotate-0 transition-transform hover:-translate-y-0.5 block">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-[#8000ff] lowercase">www.fantacer.com</p>
              </a>
            </div>
          </div>

          {/* Bottom mobile / Left desktop: form */}
          <div className="w-full lg:w-1/2 rounded-3xl border-[3px] border-[#231f20] bg-white p-4 md:p-6 lg:p-12 shadow-[6px_6px_0_#000]">
            <h3 className="text-[clamp(1rem,2.5vw,1.75rem)] font-black text-black uppercase tracking-tighter mb-2 md:mb-4 lg:mb-8 text-center leading-tight">
              {t('contact.sendMessage')}
            </h3>

            {status === 'success' && (
              <div role="alert" aria-live="polite" className="mb-4 md:mb-6 px-4 py-3 bg-green-100 text-green-900 font-bold text-sm rounded-2xl border-2 border-green-500 text-center">
                {t('contact.success')}
              </div>
            )}

            {status === 'error' && (
              <div role="alert" aria-live="polite" className="mb-4 md:mb-6 px-4 py-3 bg-red-100 text-red-900 font-bold text-sm rounded-2xl border-2 border-red-400 text-center">
                {t('contact.error')}
              </div>
            )}

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <input
                type="text"
                name="nome"
                placeholder={t('contact.namePlaceholder')}
                required
                aria-label={t('contact.nameLabel')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all"
              />
              <input
                type="email"
                name="email"
                placeholder={t('contact.emailPlaceholder')}
                required
                aria-label={t('contact.emailLabel')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all"
              />
              <textarea
                name="messaggio"
                placeholder={t('contact.messagePlaceholder')}
                 rows={4}
                required
                aria-label={t('contact.messageLabel')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-5 md:px-6 py-4 md:py-5 lg:py-6 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-[18px] border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all resize-none"
              />
              <Button
                type="submit"
                disabled={status === 'loading' || !name || !email || !message}
                className="bg-[#8000ff] hover:bg-[#6b00d6] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0_#000] disabled:hover:translate-y-0 text-[clamp(0.875rem,1.5vw,1.125rem)] font-black px-6 py-2 md:py-3 lg:py-6 mt-1 rounded-full border-[3px] border-[#231f20] shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all"
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
      <footer className="absolute bottom-0 inset-x-0 pb-[max(0.75rem,var(--safe-bottom))] pt-8">
        <div className="safe-px mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT))}
            className="text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.cookieConsent')}
          </button>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.cookiePolicy}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.cookiePolicy')}
          </a>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.privacyPolicy')}
          </a>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.terms')}
          </a>
          <span className="text-white/40" aria-hidden="true">•</span>
          <a
            href={FOOTER_LINKS.legalNotices}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
          >
            {t('footer.legalNotices')}
          </a>
        </div>
      </footer>
    </section>
  )
}