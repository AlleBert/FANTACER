import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { translate } from '@/i18n'
import type { Locale } from '@/lib/locale'

export const runtime = 'nodejs'

// 9:16 — formato IG Story
const SIZE = { width: 1080, height: 1920 }

const BRAND = {
  ink: '#231f20',
  bright: '#fccb27',
  purple: '#8000ff',
  coral: '#ff803b',
  white: '#ffffff',
}

const SUCCESS_BG = 'linear-gradient(to bottom, #FFFFFF 0%, #FF2FB2 45%, #ff8a26 75%)'

const FONT_800 = 'src/app/og/fonts/open-sauce-one-latin-800-normal.ttf'

function asset(rel: string): Buffer {
  return readFileSync(path.join(process.cwd(), rel))
}

const PALLET_BG: Record<number, string> = {
  4: '#8000ff',
  2: '#ff803b',
  1: '#4B00AB',
}

interface Company {
  id: string
  name: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lang: Locale = searchParams.get('lang') === 'en' ? 'en' : 'it'
  const ids = [searchParams.get('c1'), searchParams.get('c2'), searchParams.get('c3')]
  const pallets = [
    Number(searchParams.get('p1')),
    Number(searchParams.get('p2')),
    Number(searchParams.get('p3')),
  ]

  if (ids.some((id) => !id) || pallets.some((p) => ![1, 2, 4].includes(p))) {
    return NextResponse.json({ error: 'Parametri mancanti o non validi' }, { status: 400 })
  }

  let companies: Company[]
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('companies').select('id, name').in('id', ids as string[])
    if (!data || data.length !== 3) {
      return NextResponse.json({ error: 'Aziende non trovate' }, { status: 400 })
    }
    companies = data
  } catch (err) {
    console.error('[share/vote] fetch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const byId = new Map(companies.map((c) => [c.id, c]))
  const rows = ids.map((id, i) => ({ company: byId.get(id as string), pallet: pallets[i] }))

  const blackData = asset(FONT_800)
  const logoUri = `data:image/png;base64,${asset('public/brand/foto-profilo.png').toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: SUCCESS_BG,
          fontFamily: 'OpenSauce',
          // Il padding tiene i contenuti dentro la safe zone della story IG.
          padding: '180px 88px 300px',
          boxSizing: 'border-box',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <img
            src={logoUri}
            alt="FANTACER"
            width={132}
            height={132}
            style={{ borderRadius: 30, border: `7px solid ${BRAND.purple}`, background: BRAND.white }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 84,
              fontWeight: 800,
              color: BRAND.ink,
              letterSpacing: '-4px',
              lineHeight: 1,
            }}
          >
            FANTACER
          </div>
        </div>

        {/* Hero */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 76 }}>
          <div
            style={{
              display: 'flex',
              transform: 'rotate(-2deg)',
              background: BRAND.bright,
              border: `7px solid ${BRAND.ink}`,
              boxShadow: '12px 12px 0 #000',
              borderRadius: 32,
              padding: '20px 52px',
              fontSize: 76,
              fontWeight: 800,
              color: BRAND.ink,
              letterSpacing: '-2px',
              textTransform: 'uppercase',
            }}
          >
            {translate(lang, 'success.voted')}
          </div>
        </div>

        {/* Ricevuta del voto */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 72,
            background: BRAND.white,
            borderRadius: 44,
            border: `8px solid ${BRAND.ink}`,
            boxShadow: '20px 20px 0 #000',
            padding: '52px 56px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `6px dashed ${BRAND.ink}33`,
              paddingBottom: 30,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, color: BRAND.purple, textTransform: 'uppercase' }}>
              {translate(lang, 'success.receiptTitle')}
            </div>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: BRAND.coral }}>3/3</div>
          </div>

          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                padding: '26px 0',
                borderBottom: i < rows.length - 1 ? `4px dashed ${BRAND.ink}1f` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: BRAND.purple, width: 56 }}>
                  {`#${i + 1}`}
                </div>
                <div style={{ display: 'flex', fontSize: 54, fontWeight: 800, color: BRAND.ink, lineHeight: 1.05 }}>
                  {row.company?.name}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  border: `5px solid ${BRAND.ink}`,
                  background: PALLET_BG[row.pallet] ?? BRAND.purple,
                  color: BRAND.white,
                  fontSize: 48,
                  fontWeight: 800,
                }}
              >
                {row.pallet}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: handle + sito */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              transform: 'rotate(1.5deg)',
              background: BRAND.purple,
              color: BRAND.white,
              borderRadius: 999,
              padding: '18px 52px',
              fontSize: 58,
              fontWeight: 800,
              letterSpacing: '-1px',
            }}
          >
            @fanta.cer
          </div>
          <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, color: BRAND.ink }}>
            www.fantacer.com
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [{ name: 'OpenSauce', data: blackData, weight: 800, style: 'normal' }],
    }
  )
}
