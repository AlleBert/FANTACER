import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

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
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}
