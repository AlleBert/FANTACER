'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { animate, useAnimationFrame, useMotionValue } from 'framer-motion';

const YELLOW = '#fccb27';
const MENISCUS = '#b78c00';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface LiquidFillButtonProps {
  steps?: number;
  step?: number;
  label: string;
  onClick: () => void;
  loading?: boolean;
}

/**
 * Bottone "liquid fill": disabilitato finché step < steps.
 * Si riempie da sinistra verso destra con fronte d'onda verticale.
 * L'SVG viene ridisegnato per frame via ref (zero re-render).
 */
export function LiquidFillButton({
  steps = 3,
  step = 0,
  label,
  onClick,
  loading = false,
}: LiquidFillButtonProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const btnRef = useRef<HTMLButtonElement>(null);
  const liquidRef = useRef<SVGPathElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const progress = useMotionValue(0);
  const energy = useRef(0);
  const speed = useRef(1);
  const clock = useRef(0);
  const prev = useRef(step);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const ro = new ResizeObserver(([entry]) =>
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
    );
    if (btnRef.current) ro.observe(btnRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (step === prev.current) return;
    const up = step > prev.current;
    prev.current = step;
    energy.current = up ? 1 : Math.max(energy.current, 0.35);

    animate(progress, clamp01(step / steps), {
      duration: up ? 1.1 : 0.55,
      ease: [0.16, 1, 0.3, 1],
    });

    if (step >= steps && !reduced.current) {
      const el = btnRef.current;
      if (el) {
        animate(el, { scale: [1, 1.035, 1] }, {
          duration: 0.55,
          ease: 'easeOut',
          delay: 1.05,
          onComplete: () => {
            el.style.transform = '';
          },
        });
      }
    }
  }, [step, steps, progress]);

  useAnimationFrame((_, delta) => {
    const { w, h } = box;
    const liquid = liquidRef.current;
    if (!liquid || !w || !h) return;

    const p = clamp01(progress.get());
    const px = p > 0.998 ? w : p * w;

    energy.current *= Math.exp(-delta / 420);
    speed.current += (1 + energy.current * 2.2 - speed.current) * 0.08;
    clock.current += (delta / 1000) * speed.current * (reduced.current ? 0.4 : 1);

    const settle = clamp01((1 - p) / 0.16);
    const idle = p > 0 && p < 1 ? 2.4 : 0;
    const amp =
      (idle + energy.current * 12) * settle * (reduced.current ? 0.4 : 1);

    const k1 = (Math.PI * 2) / (h * 0.85);
    const k2 = (Math.PI * 2) / (h * 0.38);
    const t = clock.current;
    const N = Math.max(14, Math.round(h / 3));

    let d = 'M 0 0';
    let e = '';
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * h;
      const wob =
        Math.sin(y * k1 - t * 2.2) * 0.62 +
        Math.sin(y * k2 + t * 3.1 + 1.4) * 0.38;
      const x = px + wob * amp;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      e += `${i === 0 ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L 0 ${h} Z`;

    liquid.setAttribute('d', d);
    const edge = edgeRef.current;
    if (edge) {
      edge.setAttribute('d', e);
      edge.style.opacity = p > 0 && p < 1 ? (0.5 * settle).toFixed(3) : '0';
    }
  });

  const ready = step >= steps;

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={!ready || loading}
      onClick={ready ? onClick : undefined}
      className="relative w-full max-w-sm h-20 md:h-24 rounded-full border-[3px] md:border-[4px] border-[#231f20] bg-[#fccb27]/50 shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 text-2xl md:text-3xl font-[900] disabled:cursor-not-allowed disabled:pointer-events-none select-none"
    >
      <svg
        width={box.w}
        height={box.h}
        viewBox={`0 0 ${box.w} ${box.h}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`lfb-${uid}`}>
            <rect width={box.w} height={box.h} rx={box.h / 2} />
          </clipPath>
        </defs>
        <g clipPath={`url(#lfb-${uid})`}>
          <path ref={liquidRef} d="M0 0" fill={YELLOW} />
          <path
            ref={edgeRef}
            d=""
            fill="none"
            stroke={MENISCUS}
            strokeWidth="2"
            style={{ opacity: 0 }}
          />
        </g>
      </svg>

      <span
        className="absolute inset-0 flex items-center justify-center text-center px-12 md:px-16 transition-colors duration-300"
        style={{ color: ready ? '#221a00' : 'rgba(0, 0, 0, 0.5)' }}
      >
        {label}
      </span>
    </button>
  );
}
