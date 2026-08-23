import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

export const alt = 'FANTACER — Il gioco del distretto ceramico: vota e vinci'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND = {
  ink: '#231f20',
  bright: '#fccb27',
  purple: '#8000ff',
  coral: '#ff803b',
  white: '#ffffff',
}

const FONT_800 = 'src/app/og/fonts/open-sauce-one-latin-800-normal.ttf'
const FONT_400 = 'src/app/og/fonts/open-sauce-one-latin-400-normal.ttf'

function asset(rel: string): Buffer {
  return readFileSync(path.join(process.cwd(), rel))
}

export default async function Image() {
  const blackData = asset(FONT_800)
  const regularData = asset(FONT_400)
  const logoUri = `data:image/png;base64,${asset('public/brand/foto-profilo.png').toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: BRAND.ink,
          fontFamily: 'OpenSauce',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 72px' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: BRAND.bright,
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            FANTACER
          </div>
          <div style={{ marginTop: 28, fontSize: 40, fontWeight: 800, color: BRAND.white }}>
            GIOCA · VOTA · VINCI
          </div>
          <div style={{ marginTop: 14, fontSize: 28, fontWeight: 400, color: BRAND.coral }}>
            Cersaie 2026 · Bologna Fiere
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 72 }}>
          <img
            src={logoUri}
            alt="FANTACER logo"
            width={420}
            height={420}
            style={{ borderRadius: 48, border: `8px solid ${BRAND.purple}`, objectFit: 'cover' }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'OpenSauce', data: blackData, weight: 800, style: 'normal' },
        { name: 'OpenSauce', data: regularData, weight: 400, style: 'normal' },
      ],
    },
  )
}