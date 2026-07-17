'use client';

import { useState } from 'react';
import { useVote } from '@/lib/VoteContext';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function CommentSection() {
  const { selectedCompany, comment, setComment, setCurrentSection, unlockGameStep } = useVote();
  const [localComment, setLocalComment] = useState(comment);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalComment(value);
    setComment(value);
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, textarea.clientHeight * 3);
    textarea.style.height = `${Math.max(textarea.clientHeight, newHeight)}px`;
  };

  const canProceed = selectedCompany && localComment.length >= 1;

  const handleNext = () => {
    if (canProceed) {
      unlockGameStep('ranking');
      const main = document.querySelector('main');
      const sections = main?.children;
      if (sections && sections[8]) {
        main.scrollTo({ top: (sections[8] as HTMLElement).offsetTop, behavior: 'smooth' });
      }
      setCurrentSection(3);
    }
  };

  return (
    <section className="snap-start relative w-full h-[100dvh] bg-white flex flex-col items-center overflow-hidden">
      <div className="safe-shell flex">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center px-4 md:px-8">
          <div className="flex-1 min-h-[4vh]" />

          {/* Company name */}
          <div className="space-y-12 w-full max-w-2xl">
            {/* Headline */}
            <div className="space-y-4 text-center">
              <h2 className="text-[clamp(2rem,6vw,4.5rem)] font-black text-[#8000ff] tracking-tighter uppercase whitespace-pre-line leading-none">
                cosa ne pensi
                di
              </h2>

              {/* Brand/Stand name flanked by stars */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-8">
                <div className="flex-shrink-0">
                  <Image src="/star-decoration-alt.svg" alt="" width={60} height={60} className="w-10 h-10 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain drop-shadow-[4px_4px_0_#000] -rotate-12 scale-90" />
                </div>
                <h3 className="text-[clamp(1.5rem,5vw,6rem)] font-black text-[#8000ff] border-b-[4px] md:border-b-8 border-[#fccb27] pb-2 tracking-tighter uppercase whitespace-nowrap">
                  {selectedCompany?.name || 'Nessuna azienda selezionata'}
                </h3>
                <div className="flex-shrink-0">
                  <Image src="/star-decoration.svg" alt="" width={60} height={60} className="w-10 h-10 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain drop-shadow-[4px_4px_0_#000] rotate-12" />
                </div>
              </div>
            </div>
            
            {/* Comment textarea */}
            <div className="pt-4 sm:pt-8 flex justify-center w-full">
              <textarea
                value={localComment}
                onChange={handleCommentChange}
                placeholder="PERCHÉ...?"
                rows={1}
                style={{
                  minHeight: '3rem',
                  maxHeight: '8rem',
                  overflowY: 'auto',
                  boxSizing: 'border-box',
                }}
                className="bg-[#fccb27] focus:bg-white text-black placeholder:text-black/50 text-xl sm:text-2xl md:text-4xl font-black px-6 py-4 sm:px-10 sm:py-5 md:px-20 md:py-8 rounded-full border-[3px] border-black shadow-[6px_6px_0_#000] focus:shadow-[8px_8px_0_#000] focus:-translate-y-1 uppercase tracking-tighter w-full max-w-sm sm:max-w-md md:max-w-xl outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-center resize-none"
              />
            </div>
          </div>
          
          <p className="text-center text-[clamp(1rem,2.5vw,24px)] text-[#231f20] font-[900] mt-6 sm:mt-8 md:mt-12 uppercase opacity-80 tracking-tight w-full max-w-2xl">
            completa il gioco per poter ritirare il premio!
          </p>

          <div className="flex-1 min-h-[2vh]" />

          {/* Next Button */}
          <div className="flex justify-center w-full flex-none pb-8">
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_#000] disabled:hover:translate-y-0"
            >
              &gt;&gt;
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative images - left side */}
      <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2">
        <Image
          src="/star-decoration-alt.svg"
          alt=""
          width={134}
          height={132}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain rotate-12 scale-105"
        />
        <Image
          src="/star-decoration.svg"
          alt=""
          width={130}
          height={127}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain -rotate-6 scale-90"
        />
      </div>
    </section>
  );
}
