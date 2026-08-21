import { FacebookIcon, InstagramIcon } from '@/components/ui/social-icons'

interface SocialLinksRowProps {
  instagramUrl: string
  facebookUrl: string
}

export function SocialLinksRow({ instagramUrl, facebookUrl }: SocialLinksRowProps) {
  return (
    <div className="flex items-center gap-3">
      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-coral text-white shadow-[2px_2px_0_#000] transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <InstagramIcon className="h-5 w-5 stroke-[2.5]" />
      </a>
      {facebookUrl && (
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-purple text-white shadow-[2px_2px_0_#000] transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <FacebookIcon className="h-5 w-5 stroke-[2.5]" />
        </a>
      )}
    </div>
  )
}
