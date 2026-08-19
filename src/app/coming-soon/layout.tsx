import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'FANTACER — Coming soon',
  description: 'FANTACER, il gioco del distretto ceramico, arriva presto.',
  robots: { index: false, follow: false },
}

export default function ComingSoonLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}