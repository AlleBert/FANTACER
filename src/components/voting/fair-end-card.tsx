'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/LocaleContext'
import type { FairEndCeremony, FairEndPhase } from '@/lib/fair-end'

interface RankingCompany { id: string; name: string; total_pallets: number }
interface FairEndCardProps { phase: FairEndPhase; revealAt: string | null; ceremony: FairEndCeremony }

function romeTime(iso: string | null): string {
  if (!iso) return '12:30'
  try {
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso))
  } catch {
    return '12:30'
  }
}

function useCountdown(revealAt: string | null): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!revealAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [revealAt])
  if (!revealAt) return ''
  const total = Math.max(0, Math.floor((Date.parse(revealAt) - now) / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}g ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function FairEndCard({ phase, revealAt, ceremony }: FairEndCardProps) {
  const { t } = useLocale()
  const [top, setTop] = useState<RankingCompany[]>([])

  useEffect(() => {
    if (phase !== 'final') return
    let cancelled = false
    fetch('/api/public/ranking')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setTop((d.companies ?? []).slice(0, 3)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [phase])

  const countdown = useCountdown(phase === 'waiting' ? revealAt : null)

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-safe-center w-full max-w-2xl mx-auto gap-(--rythm-sec) py-8">
        <div className="bg-white rounded-3xl border-[3px] md:border-[4px] border-ink shadow-[6px_6px_0_#000] p-6 md:p-10 text-center max-w-lg w-full">
          <div className="text-[clamp(2.5rem,8vw,4rem)] leading-none mb-3" aria-hidden="true">🏆</div>
          <h3 className="text-[clamp(1.4rem,4.5vw,2.5rem)] font-[900] text-purple mb-3 leading-tight [text-wrap:balance]">
            {t('fairEnd.title')}
          </h3>
          <p className="text-[clamp(0.95rem,2.5vw,1.15rem)] font-bold text-ink leading-relaxed [text-wrap:balance]">
            {t('fairEnd.reveal', { time: romeTime(revealAt) })}
          </p>
          {countdown && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-bright px-5 py-3 shadow-[3px_3px_0_#000]">
              <span aria-hidden="true">⏳</span>
              <span className="font-mono text-[clamp(1.25rem,5vw,2rem)] font-black text-ink tabular-nums" aria-live="polite">{countdown}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']
  const slots = ['1', '2', '3'] as const
  return (
    <div className="flex-1 flex flex-col items-center justify-safe-center w-full max-w-2xl mx-auto gap-(--rythm-sec) py-8">
      <div className="bg-white rounded-3xl border-[3px] md:border-[4px] border-ink shadow-[6px_6px_0_#000] p-6 md:p-10 text-center max-w-lg w-full">
        <h3 className="text-[clamp(1.25rem,4vw,2.25rem)] font-[900] text-purple mb-1 leading-tight [text-wrap:balance]">
          {t('fairEnd.finalTitle')}
        </h3>
        <div className="mt-5 space-y-3 text-left">
          {top.map((c, i) => (
            <div key={c.id} className="flex items-start gap-3 rounded-2xl border-2 border-ink px-3 py-3">
              <span className="text-[clamp(1.5rem,5vw,2rem)] leading-none" aria-hidden="true">{medals[i]}</span>
              <div className="min-w-0">
                <p className="font-black text-ink text-[clamp(0.95rem,2.5vw,1.15rem)] truncate">{i + 1}° {c.name}</p>
                <p className="font-bold text-purple text-sm">{t('fairEnd.points', { count: c.total_pallets })}</p>
                <p className="text-ink/80 text-sm">{t('fairEnd.ceremony', { time: ceremony[slots[i]] })}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[clamp(0.85rem,2.2vw,1rem)] font-bold text-ink leading-relaxed [text-wrap:balance]">
          {t('fairEnd.thanks')}
        </p>
      </div>
    </div>
  )
}
