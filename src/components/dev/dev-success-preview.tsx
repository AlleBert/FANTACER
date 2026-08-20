'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useVote } from '@/lib/VoteContext';

export function parseDevPreview(search: string): { success: boolean; companies: boolean } {
  const params = new URLSearchParams(search);
  return {
    success: params.has('dev_success'),
    companies: params.has('dev_companies'),
  };
}

export function DevSuccessPreview() {
  const { unlockGameStep, setCompany } = useVote();
  const ranRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (ranRef.current) return;
    ranRef.current = true;

    const { success, companies } = parseDevPreview(window.location.search);
    if (!success && !companies) return;

    if (success) {
      unlockGameStep('success');
    }

    if (companies) {
      void (async () => {
        try {
          const res = await fetch('/api/public/batch');
          const { activeBatch } = await res.json();
          if (!activeBatch) return;
          const { data } = await createClient()
            .from('companies')
            .select('id, name')
            .eq('batch', activeBatch)
            .order('name', { ascending: true })
            .limit(3);
          for (const c of data ?? []) setCompany(c, 4);
        } catch {
          return;
        }
      })();
    }

    if (success) {
      const timeout = window.setTimeout(() => {
        const main = document.querySelector('main');
        const target = main?.querySelector('[data-section="success"]') as HTMLElement | undefined;
        if (main && target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }, 100);
      return () => window.clearTimeout(timeout);
    }
  }, [unlockGameStep, setCompany]);

  return null;
}