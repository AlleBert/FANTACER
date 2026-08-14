'use client'

import { useLocale } from '@/lib/LocaleContext'

export default function ComingSoonPage() {
  const { t } = useLocale()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0D0C0B] px-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-orange md:text-7xl">
        FANTACER
      </h1>
      <p className="mt-6 max-w-md text-lg text-zinc-400">
        {t('comingSoon.title')}
      </p>
    </main>
  );
}
