import {
  SPONSOR_LOGO_BUCKET,
  SPONSOR_LOGO_MAX_BYTES,
  buildLogoPath,
  getExtFromFilename,
  getPublicLogoUrl,
  isBucketUrl,
  extractPathFromUrl,
} from '../src/lib/sponsor-logo'

describe('sponsor-logo helpers', () => {
  const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

  afterAll(() => {
    if (ORIGINAL_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL
    }
  })

  it('SPONSOR_LOGO_BUCKET is sponsor-logos', () => {
    expect(SPONSOR_LOGO_BUCKET).toBe('sponsor-logos')
  })

  it('SPONSOR_LOGO_MAX_BYTES is 5MB', () => {
    expect(SPONSOR_LOGO_MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  describe('buildLogoPath', () => {
    it('builds sponsors/{seed}.{ext}', () => {
      expect(buildLogoPath('abc-123', 'png')).toBe('sponsors/abc-123.png')
    })
  })

  describe('getExtFromFilename', () => {
    it('returns lowercased ext for allowed types', () => {
      expect(getExtFromFilename('logo.PNG')).toBe('png')
      expect(getExtFromFilename('logo.jpg')).toBe('jpg')
      expect(getExtFromFilename('logo.jpeg')).toBe('jpeg')
      expect(getExtFromFilename('logo.webp')).toBe('webp')
      expect(getExtFromFilename('logo.svg')).toBe('svg')
    })

    it('returns null for disallowed types and missing ext', () => {
      expect(getExtFromFilename('logo.gif')).toBeNull()
      expect(getExtFromFilename('logo.txt')).toBeNull()
      expect(getExtFromFilename('logo')).toBeNull()
    })
  })

  describe('getPublicLogoUrl', () => {
    it('builds the full public URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co'
      expect(getPublicLogoUrl('sponsors/a.png')).toBe(
        'https://xyz.supabase.co/storage/v1/object/public/sponsor-logos/sponsors/a.png'
      )
    })
  })

  describe('isBucketUrl', () => {
    it('detects bucket URLs', () => {
      expect(isBucketUrl('https://xyz.supabase.co/storage/v1/object/public/sponsor-logos/sponsors/a.png')).toBe(true)
    })

    it('rejects external URLs', () => {
      expect(isBucketUrl('https://example.com/logo.png')).toBe(false)
      expect(isBucketUrl('')).toBe(false)
    })
  })

  describe('extractPathFromUrl', () => {
    it('extracts the object path', () => {
      expect(extractPathFromUrl('https://xyz.supabase.co/storage/v1/object/public/sponsor-logos/sponsors/a.png')).toBe('sponsors/a.png')
    })

    it('returns null for external URLs', () => {
      expect(extractPathFromUrl('https://example.com/logo.png')).toBeNull()
    })
  })
})
