import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FANTACER',
    short_name: 'FANTACER',
    description: 'Il gioco del distretto ceramico: vota e vinci',
    start_url: '/',
    display: 'standalone',
    background_color: '#231f20',
    theme_color: '#231f20',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}