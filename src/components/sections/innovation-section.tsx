'use client';

import { useState } from 'react';
import { useVote } from '@/lib/VoteContext';
import { submitVote } from '@/lib/supabase/vote-api';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

interface Option {
  left: string;
  right: string;
}

const options: Option[] = [
  { left: 'vere novità', right: 'cose già viste' },
  { left: 'molto vendibili', right: 'di nicchia' },
  { left: 'wow effect', right: 'normale' },
];

const sliderKeys = ['innovation', 'sales', 'wow'] as const;

export function InnovationSection() {
  const { selectedCompany, comment, adjective, sliders, setSlider, resetVote } = useVote();
  const [touched, setTouched] = useState({
    innovation: false,
    sales: false,
    wow: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSliderChange = (key: typeof sliderKeys[number], value: number) => {
    setSlider(key, value);
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const allTouched = Object.values(touched).every(Boolean);
  const canSubmit = allTouched && adjective && comment && selectedCompany;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCompany) return;
    setSubmitting(true);
    const result = await submitVote({
      companyId: selectedCompany.id,
      fingerprint: localStorage.getItem('fantacer_device_id') || '',
      ip: '',
      userAgent: navigator.userAgent,
      country: 'IT',
      comment: comment,
      adjective: adjective!,
      sliders: sliders,
    });
    setSubmitting(false);
    if (result.success) {
      // Navigate to success section (don't reset yet - let success section access state)
      const successSection = document.querySelector('[data-section="success"]');
      if (successSection) {
        successSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      alert(result.error || 'Errore durante il voto');
    }
  };

  return (
    <section className="snap-start relative w-full h-[100dvh] min-h-[600px] bg-white flex flex-col items-center overflow-hidden">
      <div className="safe-shell flex flex-col items-center justify-between max-w-[1200px] mx-auto">
        {/* Question */}
        <p className="text-[clamp(2rem,5vw,40px)] font-[900] text-black text-center lowercase tracking-tighter w-full max-w-4xl mx-auto flex-none pt-4">
          per te, le novità di <span className="text-[#ff803b] underline decoration-4 underline-offset-4">{selectedCompany?.name || 'Nessuna azienda'}</span> sono più...
        </p>

        <div className="flex-1 min-h-[2vh]" />

        {/* Sliders */}
        <div className="space-y-10 md:space-y-14 w-full max-w-[1200px] mx-auto flex-none">
          {options.map((option, index) => (
            <div key={index} className="flex flex-row items-center justify-center gap-4 md:gap-8 w-full py-2">
              <div className="flex-none w-[20%] flex items-center justify-end">
                <h3 className="text-[clamp(1.125rem,5vw,1.5rem)] xs:text-[clamp(1.25rem,4.5vw,1.75rem)] sm:text-[clamp(1.25rem,4vw,2rem)] md:text-[clamp(1.35rem,3.5vw,2.25rem)] lg:text-[clamp(1.35rem,3vw,2.375rem)] font-[900] text-[#8000ff] text-right uppercase tracking-tighter leading-[1.05] break-words mr-2 sm:mr-4 md:mr-6">
                  {option.left}
                </h3>
              </div>

              {/* Interactive Range Slider mapped to Star */}
              <div className="relative flex-none w-[45%] md:w-[56%] h-16 flex items-center group">
                {/* Padding wrapper per contenuto interno */}
                <div className="absolute inset-0 flex items-center px-8 sm:px-12 md:px-16 lg:px-24">
                  {/* Visual Track */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[6px] bg-black rounded-full" />

                  {/* Visual Thumb - limitato tra 5% e 95% per evitare sovrapposizioni */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-75"
                    style={{ left: `${sliders[sliderKeys[index]]}%` }}
                  >
                    <Star className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 lg:w-18 lg:h-18 fill-[#fccb27] stroke-[#231f20] stroke-[2px] drop-shadow-[2px_2px_0_#000]" />
                  </div>
                </div>

                {/* Hidden input controlling the slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliders[sliderKeys[index]]}
                  onChange={(e) => handleSliderChange(sliderKeys[index], Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize m-0 p-0"
                  style={{ touchAction: 'pan-x' }}
                />
              </div>

              <div className="flex-none w-[20%] flex items-center justify-start">
                <h3 className="text-[clamp(1.125rem,5vw,1.5rem)] xs:text-[clamp(1.25rem,4.5vw,1.75rem)] sm:text-[clamp(1.25rem,4vw,2rem)] md:text-[clamp(1.35rem,3.5vw,2.25rem)] lg:text-[clamp(1.35rem,3vw,2.375rem)] font-[900] text-[#8000ff] text-left uppercase tracking-tighter leading-[1.05] break-words ml-2 sm:ml-4 md:ml-6">
                  {option.right}
                </h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-[2vh]" />

        {/* Submit button */}
        <div className="flex justify-center w-full flex-none pb-8">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_#000] disabled:hover:translate-y-0"
          >
            {submitting ? 'INVIO...' : 'FATTO!'}
          </Button>
        </div>
      </div>
    </section>
  );
}
