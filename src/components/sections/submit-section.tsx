'use client';

import { useState } from 'react';
import { useVote } from '@/lib/VoteContext';
import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { Button } from '@/components/ui/button';
import { TurnstileOverlay } from '@/components/voting/turnstile-overlay';
import { MessageOverlay } from '@/components/voting/message-overlay';
import confetti from 'canvas-confetti';

const overlayTitles: Record<string, string> = {
  success: 'Voto Inviato!',
  error: 'Errore',
  warning: 'Attenzione',
};

export function SubmitSection() {
  const { selectedCompanies, unlockGameStep } = useVote();
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (token: string) => {
    setShowTurnstile(false);
    setLoading(true);

    try {
      const fingerprint = localStorage.getItem('device_fingerprint') || 'unknown';

      const res = await fetch('/api/vota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company1Id: selectedCompanies[0].company.id,
          company2Id: selectedCompanies[1].company.id,
          company3Id: selectedCompanies[2].company.id,
          fingerprint,
          turnstile_token: token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Errore durante l\'invio del voto' });
        return;
      }

      const duration = 4000;
      const animationEnd = Date.now() + duration;
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) { clearInterval(interval); return; }
        confetti({
          particleCount: 50,
          startVelocity: 30,
          spread: 360,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: ['#fccb27', '#8000ff', '#ff803b', '#4B00AB', '#ffffff'],
        });
      }, 250);

      unlockGameStep('success');
      setMessage({ type: 'success', text: 'Voto inviato con successo! Scopri la classifica aggiornata qui sotto.' });

      setTimeout(() => {
        const main = document.querySelector('main');
        const sections = main?.children;
        if (sections) {
          const targetIndex = 8;
          main.scrollTo({ top: (sections[targetIndex] as HTMLElement).offsetTop, behavior: 'smooth' });
        }
      }, 3000);
    } catch {
      setMessage({ type: 'error', text: 'Errore di rete. Riprova più tardi.' });
    } finally {
      setLoading(false);
    }
  };

  if (selectedCompanies.length < 3) return null;

  return (
    <section className="snap-start relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(194,225,255,0.2)_0%,rgba(255,255,255,1)_100%)]">
      <div className="safe-shell flex flex-col items-center justify-center">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center px-4 md:px-8">
          <div className="flex-1 min-h-[4vh]" />

          <h2 className="text-[clamp(2rem,7vw,70px)] font-[900] text-center mb-6 tracking-tighter lowercase leading-[1.1] text-[#8000ff]">
            invia il tuo voto
          </h2>

          <div className="w-full max-w-xl bg-white rounded-2xl border-[3px] border-[#231f20] shadow-[4px_4px_0_#000] p-6 mb-6">
            {selectedCompanies.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b-2 border-[#231f20]/20 last:border-b-0">
                <span className="text-lg font-bold">{item.company.name}</span>
                <span className="bg-[#fccb27] px-4 py-1 rounded-full border-2 border-[#231f20] font-black">{item.pallet} pallet</span>
              </div>
            ))}
          </div>

          <p className="text-center text-lg font-bold text-[#8000ff] mb-6">
            e controlla la classifica aggiornata
          </p>

          <SponsorCards className="mb-8" />

          <div className="flex justify-center w-full flex-none pb-8">
            <Button
              onClick={() => setShowTurnstile(true)}
              disabled={loading}
              className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[20rem] disabled:opacity-50"
            >
              {loading ? 'INVIO...' : 'INVIA IL TUO VOTO'}
            </Button>
          </div>
        </div>
      </div>

      {showTurnstile && (
        <TurnstileOverlay
          isVisible={showTurnstile}
          onSuccess={handleSubmit}
          onError={(error) => setMessage({ type: 'error', text: error })}
          onClose={() => setShowTurnstile(false)}
        />
      )}

      {message && (
        <MessageOverlay
          isVisible={true}
          type={message.type}
          title={overlayTitles[message.type]}
          message={message.text}
          onClose={() => setMessage(null)}
        />
      )}
    </section>
  );
}
