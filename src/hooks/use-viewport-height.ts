'use client';

import { useEffect, useState } from 'react';

/**
 * Restituisce true se l'altezza del viewport è minore della soglia.
 * Usa matchMedia per reattività a resize/orientation change.
 *
 * @param threshold - Altezza in pixel (es. 450, 600)
 * @returns boolean - true se viewport height < threshold
 */
export function useViewportHeightLessThan(threshold: number): boolean {
  const [isLess, setIsLess] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight < threshold;
  });

  useEffect(() => {
    // jsdom non implementa matchMedia: in test env il hook resta al valore iniziale
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia(`(max-height: ${threshold - 1}px)`);
    const update = () => setIsLess(mq.matches);

    // Compatibilità con jsdom che non implementa addEventListener su MediaQueryList
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
    } else if (mq.addListener) {
      mq.addListener(update);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', update);
      } else if (mq.removeListener) {
        mq.removeListener(update);
      }
    };
  }, [threshold]);

  return isLess;
}
