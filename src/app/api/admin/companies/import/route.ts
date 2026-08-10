import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'
import * as XLSX from 'xlsx'

const HEADER_MAP: Record<string, string> = {
  'nome': 'name',
  'categoria': 'category',
  'url logo': 'image_url',
  'url_logo': 'image_url',
  'logo': 'image_url',
}

function normalizeHeaders(headers: string[], rows: Record<string, string>[]): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = headers.map(h => HEADER_MAP[h] || h)
  for (const row of rows) {
    for (const [it, en] of Object.entries(HEADER_MAP)) {
      if (it in row && !(en in row)) {
        row[en] = row[it]
        delete row[it]
      }
    }
  }
  return { headers: normalized, rows }
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function detectDelimiter(lines: string[]): string {
  if (lines.length === 0) return ','
  const firstLine = lines[0]
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  return semicolonCount > commaCount ? ';' : ','
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const delimiter = detectDelimiter(lines)
  const rawHeaders = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter)
    const row: Record<string, string> = {}
    rawHeaders.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }

  return normalizeHeaders(rawHeaders, rows)
}

function parseXLSX(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  if (data.length < 2) return { headers: [], rows: [] }

  const rawHeaders = data[0].map(h => String(h || '').toLowerCase().trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < data.length; i++) {
    const row: Record<string, string> = {}
    rawHeaders.forEach((header, index) => {
      row[header] = String(data[i][index] || '').trim()
    })
    rows.push(row)
  }

  return normalizeHeaders(rawHeaders, rows)
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const formData = await request.formData()
    const file = formData.get('file') as File
    const batchName = formData.get('batchName') as string

    if (!file || !batchName) {
      return NextResponse.json({ error: 'File and batch name required' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

    let headers: string[]
    let rows: Record<string, string>[]

    if (isExcel) {
      const buffer = await file.arrayBuffer()
      const parsed = parseXLSX(buffer)
      headers = parsed.headers
      rows = parsed.rows
    } else {
      const text = await file.text()
      const parsed = parseCSV(text)
      headers = parsed.headers
      rows = parsed.rows
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File empty or invalid' }, { status: 400 })
    }

    const requiredFields = ['name']
    for (const field of requiredFields) {
      if (!headers.includes(field)) {
        return NextResponse.json({ error: `Missing required field: ${field}. Found headers: ${headers.join(', ')}` }, { status: 400 })
      }
    }

    const supabase = createAdminClient()
    const companies: Array<{name: string; category: string | null; image_url: string | null; batch: string}> = []

    for (const row of rows) {
      if (row.name && row.name.trim()) {
        companies.push({
          name: row.name.trim(),
          category: row.category?.trim() || null,
          image_url: row.image_url?.trim() || null,
          batch: batchName
        })
      }
    }

    const { error } = await supabase
      .from('companies')
      .insert(companies)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Import completed',
      count: companies.length,
      batch: batchName
    })
  } catch (err) {
    const status = toAdminError(err)
    if (status !== 500) {
      return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
    }
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
