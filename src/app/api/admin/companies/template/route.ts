import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const wb = XLSX.utils.book_new()

  const data = [
    ['Nome', 'Categoria', 'URL Logo'],
    ['Azienda Esempio', 'Categoria Opzionale', 'https://esempio.com/logo.png'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 30 },
    { wch: 25 },
    { wch: 40 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Aziende')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template_aziende.xlsx'
    }
  })
}
