import { NextResponse } from 'next/server'

export async function GET() {
  const csv = 'name,category,image_url\nAzienda Esempio,Categoria Opzionale,https://esempio.com/logo.png'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=template_aziende.csv'
    }
  })
}