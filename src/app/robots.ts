import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/coming-soon'],
      },
    ],
    sitemap: 'https://www.fantacer.com/sitemap.xml',
  }
}