'use client';

import { useEffect, useState } from 'react';

/**
 * Restituisce maxItems per SponsorCards in base all'altezza viewport.
 * - h < 500px → 3 card (1 riga)
 * - h < 650px → 4 card
 * - altrimenti → undefined (tutti)
 *
 * Usa matchMedia per reattività a resize/orientation change.
 */
export function useSponsorMaxItems(): number | undefined {
  const [maxItems, setMaxItems] = useState<number | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const h = window.innerHeight;
    if (h < 500) return 3;
    if (h < 650) return 4;
    return undefined;
  });

  useEffect(() => {
    // jsdom non implementa matchMedia: in test env il hook resta al valore iniziale
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq500 = window.matchMedia('(max-height: 499px)');
    const mq650 = window.matchMedia('(max-height: 649px)');

    const update = () => {
      if (mq500.matches) {
        setMaxItems(3);
      } else if (mq650.matches) {
        setMaxItems(4);
      } else {
        setMaxItems(undefined);
      }
    };

    // Compatibilità con jsdom che non implementa addEventListener su MediaQueryList
    const addListener = (mq: MediaQueryList, fn: () => void) => {
      if (mq.addEventListener) {
        mq.addEventListener('change', fn);
      } else if (mq.addListener) {
        mq.addListener(fn);
      }
    };

    const removeListener = (mq: MediaQueryList, fn: () => void) => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', fn);
      } else if (mq.removeListener) {
        mq.removeListener(fn);
      }
    };

    addListener(mq500, update);
    addListener(mq650, update);

    return () => {
      removeListener(mq500, update);
      removeListener(mq650, update);
    };
  }, []);

  return maxItems;
}
