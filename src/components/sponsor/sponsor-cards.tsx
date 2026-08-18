'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Sponsor {
  id: string;
  name: string;
  image_url: string | null;
  website_url: string | null;
}

export function SponsorCards({ className, compact }: { className?: string; compact?: boolean }) {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/sponsors')
      .then((res) => res.json())
      .then((data) => {
        setSponsors(data.sponsors);
        setIsLoading(false);
      })
      .catch(() => {
        setSponsors([]);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 w-full max-w-4xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-[clamp(4rem,11vw,8rem)] aspect-square bg-white/90 rounded-2xl md:rounded-[2rem] shadow-[4px_4px_0px_0px_#000] border-[3px] md:border-[4px] border-black animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!sponsors || sponsors.length === 0) return null;

  const compactCardWidth = 'w-[clamp(3rem,9vw,5rem)]';
  const cardWidth = compact ? compactCardWidth : 'w-[clamp(4rem,11vw,8rem)]';
  const cardPadding = compact ? 'p-2' : 'p-3';
  const cardGap = compact ? 'gap-3 sm:gap-4 md:gap-5' : 'gap-4 sm:gap-6 md:gap-8';
  const cardWrapper = `flex flex-wrap items-center justify-center ${cardGap} w-full max-w-4xl mx-auto`;

  return (
    <div className={className}>
      <div className={`${cardWrapper} ${compact ? 'pt-2 pb-4' : ''}`}>
        {sponsors.map((sponsor) => {
          const classes = `relative ${cardWidth} aspect-square bg-white rounded-2xl md:rounded-[2rem] shadow-[4px_4px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-purple focus-visible:outline-none`;
          const content = sponsor.image_url ? (
            <Image
              src={sponsor.image_url}
              alt={sponsor.name}
              fill
              sizes="(max-width: 480px) 58px, (max-width: 768px) 88px, 120px"
              className={`object-contain ${cardPadding}`}
            />
          ) : (
            <span className="text-black/60 font-black text-sm text-center px-2">{sponsor.name}</span>
          );

          return sponsor.website_url ? (
            <a
              key={sponsor.id}
              href={sponsor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className={classes}
            >
              {content}
            </a>
          ) : (
            <div key={sponsor.id} className={classes}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
