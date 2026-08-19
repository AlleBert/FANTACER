'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Sponsor {
  id: string;
  name: string;
  image_url: string | null;
  website_url: string | null;
  has_stand: boolean;
}

export type SponsorCardsVariant = 'default' | 'compact' | 'large';

interface SponsorCardsProps {
  variant?: SponsorCardsVariant;
  standOnly?: boolean;
  refreshKey?: number | string;
  className?: string;
}

const SCALE: Record<SponsorCardsVariant, string> = {
  default: '1',
  compact: 'var(--sponsor-scale-compact)',
  large: 'var(--sponsor-scale-large)',
};

// I valori px di SIZES derivano dai token --sponsor-card-*: sono solo un hint
// `sizes` per next/image, non dimensioni di layout — non tokenizzabili perché
// var() non funziona negli attributi HTML.
const SIZES: Record<SponsorCardsVariant, string> = {
  default: '(max-width: 480px) 112px, (max-width: 768px) 169px, 208px',
  compact: '(max-width: 480px) 88px, (max-width: 768px) 120px, 144px',
  large: '(max-width: 480px) 128px, (max-width: 768px) 220px, 256px',
};

const CARD_CLASSES =
  'relative aspect-square rounded-2xl bg-white shadow-[0_4px_16px_rgba(0,0,0,.15)] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-1 active:scale-95 focus-visible:ring-2 focus-visible:ring-purple focus-visible:outline-none';

function sizeKey(count: number): string {
  if (count === 1) return '1';
  if (count === 2) return '2';
  if (count === 3) return '3';
  return '4';
}

export function SponsorCards({ variant = 'default', standOnly = false, refreshKey, className }: SponsorCardsProps) {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/public/sponsors')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setSponsors(data.sponsors || []);
      })
      .catch(() => {
        if (active) setSponsors([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const visible = sponsors ? (standOnly ? sponsors.filter((s) => s.has_stand) : sponsors) : [];
  const count = visible.length;

  if (isLoading) {
    return (
      <div className={cn('flex flex-wrap items-center justify-center gap-(--sponsor-gap)', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="aspect-square animate-pulse rounded-2xl bg-white/90 shadow-[0_4px_16px_rgba(0,0,0,.12)]"
            style={{
              '--sponsor-size': 'var(--sponsor-card-4)',
              '--sponsor-scale': SCALE[variant],
              flexBasis: 'calc(var(--sponsor-size) * var(--sponsor-scale))',
              maxWidth: 'min(calc(var(--sponsor-size) * var(--sponsor-scale)), var(--sponsor-card-maxh))',
            } as React.CSSProperties}
          />
        ))}
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-(--sponsor-gap)', className)}>
      {visible.map((sponsor) => {
        const cardStyle = {
          '--sponsor-size': `var(--sponsor-card-${sizeKey(count)})`,
          '--sponsor-scale': SCALE[variant],
          flexBasis: 'calc(var(--sponsor-size) * var(--sponsor-scale))',
          maxWidth: 'min(calc(var(--sponsor-size) * var(--sponsor-scale)), var(--sponsor-card-maxh))',
        } as React.CSSProperties;

        const content = sponsor.image_url ? (
          <Image
            src={sponsor.image_url}
            alt={sponsor.name}
            fill
            sizes={SIZES[variant]}
            className="object-contain p-(--space-sm)"
          />
        ) : (
          <span className="px-2 text-center text-sm font-black text-ink/70 [text-wrap:balance]">{sponsor.name}</span>
        );

        return sponsor.website_url ? (
          <a key={sponsor.id} href={sponsor.website_url} target="_blank" rel="noopener noreferrer" style={cardStyle} className={CARD_CLASSES}>
            {content}
          </a>
        ) : (
          <div key={sponsor.id} style={cardStyle} className={CARD_CLASSES}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
