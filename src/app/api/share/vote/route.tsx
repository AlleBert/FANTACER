import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { translate } from '@/i18n'
import type { Locale } from '@/lib/locale'

export const runtime = 'nodejs'

const SIZE = { width: 1080, height: 1350 }

const BRAND = {
  ink: '#231f20',
  bright: '#fccb27',
  purple: '#8000ff',
  coral: '#ff803b',
  white: '#ffffff',
}

const SUCCESS_BG = 'linear-gradient(to bottom, #FFFFFF 0%, #FF2FB2 45%, #ff8a26 75%)'

const FONT_800 = 'src/app/og/fonts/open-sauce-one-latin-800-normal.ttf'
const FONT_400 = 'src/app/og/fonts/open-sauce-one-latin-400-normal.ttf'

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

interface Sponsor {
  id: string
  name: string
  image_url: string | null
  has_stand: boolean
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
  let standSponsors: Sponsor[]
  try {
    const supabase = createAdminClient()

    const { data: cData } = await supabase.from('companies').select('id, name').in('id', ids as string[])
    if (!cData || cData.length !== 3) {
      return NextResponse.json({ error: 'Aziende non trovate' }, { status: 400 })
    }
    companies = cData

    // Sponsor con stand (stessa logica di SponsorCards standOnly nella sezione success).
    const { data: sponsors } = await supabase
      .from('sponsors')
      .select('id, name, image_url, has_stand')
      .eq('is_active', true)
      .eq('has_stand', true)

    standSponsors = (sponsors || []).filter((s) => s.has_stand)
  } catch (err) {
    console.error('[share/vote] fetch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const byId = new Map(companies.map((c) => [c.id, c]))
  const rows = ids.map((id, i) => ({ company: byId.get(id as string), pallet: pallets[i] }))

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
          flexDirection: 'column',
          background: SUCCESS_BG,
          fontFamily: 'OpenSauce',
          padding: '72px 84px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header: brand + "Hai votato!" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <img
            src={logoUri}
            alt="FANTACER"
            width={96}
            height={96}
            style={{ borderRadius: 20, border: `5px solid ${BRAND.purple}` }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: BRAND.ink, letterSpacing: '-2px', lineHeight: 1 }}>
              FANTACER
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: BRAND.purple, marginTop: 6 }}>
              {translate(lang, 'success.voted')}
            </div>
          </div>
        </div>

        {/* Receipt: il tuo voto */}
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            flexDirection: 'column',
            background: BRAND.white,
            borderRadius: 28,
            border: `6px solid ${BRAND.ink}`,
            boxShadow: '14px 14px 0 #000',
            padding: '40px 44px',
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: `4px dashed ${BRAND.ink}33`,
              paddingBottom: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, color: BRAND.purple }}>
              {translate(lang, 'success.receiptTitle')}
            </div>
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                padding: '14px 0',
              }}
            >
              <div style={{ fontSize: 38, fontWeight: 800, color: BRAND.ink }}>{row.company?.name}</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: PALLET_BG[row.pallet] ?? BRAND.purple,
                  color: BRAND.white,
                  fontSize: 34,
                  fontWeight: 800,
                }}
              >
                {row.pallet}
              </div>
            </div>
          ))}
        </div>

        {/* Sponsor: ritira il premio */}
        {standSponsors.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 48 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: BRAND.ink, textAlign: 'center', marginBottom: 24 }}>
              {translate(lang, 'success.redeemPrize')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
              {standSponsors.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 160,
                    height: 160,
                    borderRadius: 24,
                    background: BRAND.white,
                    border: `4px solid ${BRAND.ink}`,
                    boxShadow: '6px 6px 0 #000',
                    overflow: 'hidden',
                  }}
                >
                  {s.image_url ? (
                    // Satori fetcha le immagini remote server-side: nessun problema CORS.
                    <img src={s.image_url} alt={s.name} width={160} height={160} style={{ objectFit: 'contain' }} />
                  ) : (
                    <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.ink, textAlign: 'center', padding: 12 }}>
                      {s.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer tagline */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'auto', paddingTop: 48 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 400,
              color: BRAND.ink,
              textAlign: 'center',
            }}
          >
            {translate(lang, 'success.shareTaglinePre')}{' '}
            <span style={{ fontWeight: 800, color: BRAND.purple }}>@fanta.cer</span>{' '}
            {translate(lang, 'success.shareTaglinePost')}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: 'OpenSauce', data: blackData, weight: 800, style: 'normal' },
        { name: 'OpenSauce', data: regularData, weight: 400, style: 'normal' },
      ],
    }
  )
}