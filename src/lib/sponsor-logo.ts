export const SPONSOR_LOGO_BUCKET = 'sponsor-logos'
export const SPONSOR_LOGO_MAX_BYTES = 5 * 1024 * 1024

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']

export function buildLogoPath(seed: string, ext: string): string {
  return `sponsors/${seed}.${ext}`
}

export function getExtFromFilename(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXT.includes(ext) ? ext : null
}

export function getPublicLogoUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${SPONSOR_LOGO_BUCKET}/${path}`
}

export function isBucketUrl(url: string): boolean {
  return url.includes(`/storage/v1/object/public/${SPONSOR_LOGO_BUCKET}/`)
}

export function extractPathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${SPONSOR_LOGO_BUCKET}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}
