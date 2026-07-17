'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function ContactSection() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

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
      className="snap-start relative w-full overflow-hidden bg-[linear-gradient(to_bottom,#4B00AB_0%,#a088db_40%,#efdeff_100%)]"
    >
      {/* safe-shell gestisce min-height, safe area e padding laterale */}
      <div className="safe-shell flex flex-col items-center justify-center gap-2 md:gap-4 lg:gap-8">
        <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-6 md:gap-8 lg:flex-row-reverse lg:gap-16">

          {/* Top mobile / Right desktop: info */}
          <div className="flex w-full flex-col items-center gap-4 md:gap-6 text-center lg:w-1/2 lg:items-start lg:text-left">
            <h2 className="text-[clamp(2rem,7vw,90px)] font-[900] text-white tracking-tighter uppercase leading-[0.9] drop-shadow-[2px_2px_0_#231f20]">
              PARLA<br className="sm:hidden"/>
              <span className="hidden sm:inline"> </span>CON NOI
            </h2>

            <div className="flex w-full flex-col items-center gap-2 md:gap-4 lg:gap-12 lg:items-start">
              <div className="bg-white px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] -rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-black lowercase">fantacer@fantacer.com</p>
              </div>
              <div className="bg-[#fccb27] px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-black tracking-wider">00 000 000</p>
              </div>
              <div className="bg-white px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] -rotate-1 hover:rotate-0 transition-transform cursor-pointer hover:-translate-y-0.5">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-[#8000ff] lowercase">www.fantacer.com</p>
              </div>
            </div>
          </div>

          {/* Bottom mobile / Left desktop: form */}
          <div className="w-full lg:w-1/2 rounded-3xl border-[3px] border-[#231f20] bg-white p-4 md:p-6 lg:p-12 shadow-[6px_6px_0_#000]">
            <h3 className="text-[clamp(1rem,2.5vw,1.75rem)] font-black text-black uppercase tracking-tighter mb-2 md:mb-4 lg:mb-8 text-center leading-tight">
              Inviaci un messaggio
            </h3>

            {status === 'success' && (
              <div className="mb-4 md:mb-6 px-4 py-3 bg-green-100 text-green-900 font-bold text-sm rounded-2xl border-2 border-green-500 text-center">
                Messaggio inviato con successo!
              </div>
            )}

            {status === 'error' && (
              <div className="mb-4 md:mb-6 px-4 py-3 bg-red-100 text-red-900 font-bold text-sm rounded-2xl border-2 border-red-400 text-center">
                Errore nell&apos;invio. Riprova pi&ugrave; tardi.
              </div>
            )}

            <form className="flex flex-col gap-3 md:gap-4 lg:gap-6" onSubmit={handleSubmit}>
              <input
                type="text"
                name="nome"
                placeholder="NOME"
                required
                aria-label="Il tuo nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all"
              />
              <input
                type="email"
                name="email"
                placeholder="EMAIL"
                required
                aria-label="La tua email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-bold uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all"
              />
              <textarea
                name="messaggio"
                placeholder="MESSAGGIO..."
                rows={4}
                required
                aria-label="Il tuo messaggio"
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
                    INVIO...
                  </span>
                ) : (
                  'INVIA'
                )}
              </Button>
            </form>
          </div>

        </div>
      </div>
    </section>
  )
}