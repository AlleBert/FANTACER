'use client';

import { useEffect, useState } from 'react';

interface Sponsor {
  id: string;
  name: string;
  image_url: string | null;
  website_url: string | null;
}

export function SponsorCards({ className }: { className?: string }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    fetch('/api/public/sponsors')
      .then((res) => res.json())
      .then((data) => setSponsors(data.sponsors))
      .catch(() => {});
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-8 justify-items-center">
        {sponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={sponsor.website_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="relative w-[20dvh] aspect-square bg-white rounded-2xl md:rounded-[2rem] shadow-[4px_4px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2"
          >
            {sponsor.image_url ? (
              <img
                src={sponsor.image_url}
                alt={sponsor.name}
                className="w-full h-full object-contain p-3"
              />
            ) : (
              <span className="text-black/30 font-black text-sm text-center px-2">{sponsor.name}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
