'use client';

import { useEffect, useState } from 'react';

interface Sponsor {
  id: string;
  name: string;
  image_url: string | null;
  website_url: string | null;
}

let cachedSponsors: Sponsor[] | null = null;
let fetchPromise: Promise<Sponsor[]> | null = null;

export function SponsorCards({ className, compact }: { className?: string; compact?: boolean }) {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(cachedSponsors);
  const [isLoading, setIsLoading] = useState(!cachedSponsors);

  useEffect(() => {
    if (cachedSponsors) return;

    if (!fetchPromise) {
      fetchPromise = fetch('/api/public/sponsors')
        .then((res) => res.json())
        .then((data) => {
          cachedSponsors = data.sponsors;
          return data.sponsors;
        })
        .catch(() => {
          cachedSponsors = [];
          return [];
        });
    }

    fetchPromise.then((data) => {
      setSponsors(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 justify-items-center lg:flex lg:flex-nowrap lg:justify-center gap-4 sm:gap-6 md:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-[clamp(72px,12dvh,140px)] lg:w-[180px] xl:w-[200px] aspect-square bg-white/90 rounded-2xl md:rounded-[2rem] shadow-[4px_4px_0px_0px_#000] border-[3px] md:border-[4px] border-black animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!sponsors || sponsors.length === 0) return null;

  if (compact) {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full max-w-4xl mx-auto pt-2 pb-4">
          {sponsors.map((sponsor) => (
            <a
              key={sponsor.id}
              href={sponsor.website_url || undefined}
              target={sponsor.website_url ? '_blank' : undefined}
              rel={sponsor.website_url ? 'noopener noreferrer' : undefined}
              className="relative w-full h-24 md:h-28 bg-white rounded-2xl md:rounded-[2rem] shadow-[4px_4px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-[#8000ff] focus-visible:outline-none"
            >
              {sponsor.image_url ? (
                <img
                  src={sponsor.image_url}
                  alt={sponsor.name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-black/60 font-black text-sm text-center px-2">{sponsor.name}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 justify-items-center lg:flex lg:flex-nowrap lg:justify-center gap-4 sm:gap-6 md:gap-8">
        {sponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={sponsor.website_url || undefined}
            target={sponsor.website_url ? '_blank' : undefined}
            rel={sponsor.website_url ? 'noopener noreferrer' : undefined}
            className="relative w-[clamp(72px,12dvh,140px)] lg:w-[180px] xl:w-[200px] aspect-square bg-white rounded-2xl md:rounded-[2rem] shadow-[4px_4px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-[#8000ff] focus-visible:outline-none"
          >
            {sponsor.image_url ? (
              <img
                src={sponsor.image_url}
                alt={sponsor.name}
                className="w-full h-full object-contain p-3"
              />
            ) : (
              <span className="text-black/60 font-black text-sm text-center px-2">{sponsor.name}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
