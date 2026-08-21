'use client'

import type { RefObject } from 'react'
import { InstagramIcon, FacebookIcon } from '@/components/ui/social-icons'
import { ShareButton } from '@/components/sections/share-button'
import { SaveButton } from '@/components/sections/save-button'
import { INSTAGRAM_URL, FACEBOOK_URL } from '@/lib/social-links'

interface ActionBarProps {
  containerRef: RefObject<HTMLDivElement | null>
  text: string
  url: string
}

export function ActionBar({ containerRef, text, url }: ActionBarProps) {
  return (
    <div className="flex flex-col items-center gap-(--space-md) sm:flex-row sm:justify-between">
      <ShareButton text={text} url={url} />
      <div className="flex items-center gap-3">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-coral text-white shadow-[2px_2px_0_#000] transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <InstagramIcon className="h-5 w-5 stroke-[2.5]" />
        </a>
        {FACEBOOK_URL && (
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-purple text-white shadow-[2px_2px_0_#000] transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <FacebookIcon className="h-5 w-5 stroke-[2.5]" />
          </a>
        )}
        <SaveButton containerRef={containerRef} />
      </div>
    </div>
  )
}
