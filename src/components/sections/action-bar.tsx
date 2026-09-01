'use client'

import { InstagramIcon, FacebookIcon } from '@/components/ui/social-icons'
import { ShareButton } from '@/components/sections/share-button'
import { SaveButton } from '@/components/sections/save-button'
import { INSTAGRAM_URL, FACEBOOK_URL } from '@/lib/social-links'
import type { SelectedCompany } from '@/lib/VoteContext'

interface ActionBarProps {
  companies: SelectedCompany[]
  text: string
  url: string
}

const ICON_ONLY =
  'inline-flex cursor-pointer items-center justify-center rounded-(--rounded-full) border-[3px] border-ink bg-bright px-(--space-lg) py-(--space-sm) shadow-[4px_4px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] active:translate-y-0.5 active:shadow-[2px_2px_0_#000] focus-visible:ring-3 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none'

export function ActionBar({ companies, text, url }: ActionBarProps) {
  return (
    <div className="flex items-center justify-center gap-(--space-sm) sm:gap-3">
      <ShareButton text={text} url={url} />
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className={`${ICON_ONLY} bg-coral text-white`}
      >
        <InstagramIcon className="h-5 w-5 stroke-[2.5]" />
      </a>
      {FACEBOOK_URL && (
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className={`${ICON_ONLY} bg-purple text-white`}
        >
          <FacebookIcon className="h-5 w-5 stroke-[2.5]" />
        </a>
      )}
      <SaveButton companies={companies} />
    </div>
  )
}
