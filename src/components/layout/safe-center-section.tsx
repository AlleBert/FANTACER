'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SafeCenterSectionProps {
  children: ReactNode;
  /** Se true, abilita scroll interno quando contenuto > viewport */
  scrollable?: boolean;
  /** Gap tra elementi centrati (default: var(--rythm-blk)) */
  gap?: string;
  /** Padding extra oltre safe-area (es. "var(--space-md)") */
  extraPad?: string;
  /** Classi aggiuntive */
  className?: string;
}

/**
 * Wrapper per sezioni snap-screen che:
 * - Centra verticalmente con `safe center` (no clipping)
 * - Se contenuto sta → perfettamente centrato
 * - Se contenuto eccede → allinea al top (safe) senza clipping
 * - Fallback CSS per browser senza supporto `safe center` (iOS < 17.4)
 *
 * Usa `.safe-center-shell` (non `.safe-shell`) per evitare conflitto min-height.
 * Il footer (es. SponsorCards) va posizionato FUORI da questo componente.
 *
 * Fallback "Spacer Flessibili":
 * - Due div vuoti (top/bottom) con flex-grow: 1; flex-shrink: 1; min-height: 0
 * - Quando c'è spazio → collassano a 0, contenuto centrato
 * - Quando manca spazio → crescono, contenuto allineato in alto
 */
export function SafeCenterSection({
  children,
  scrollable = false,
  gap = 'var(--rythm-blk)',
  extraPad,
  className,
}: SafeCenterSectionProps) {
  return (
    <div
      className={cn(
        'safe-center-shell',
        'flex flex-col',
        'items-safe-center',
        'justify-safe-center',
        scrollable ? 'overflow-y-auto' : 'overflow-hidden',
        className
      )}
      style={{
        gap,
        ...(extraPad ? { padding: extraPad } : {}),
      }}
    >
      {/* Fallback spacer top - collassa a 0 se c'è spazio, cresce se manca */}
      <div aria-hidden="true" className="safe-center-spacer" />

      {/* Contenuto centrato */}
      {children}

      {/* Fallback spacer bottom - collassa a 0 se c'è spazio, cresce se manca */}
      <div aria-hidden="true" className="safe-center-spacer" />
    </div>
  );
}
