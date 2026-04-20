import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const batchName = formData.get('batchName') as string

    if (!file || !batchName) {
      return NextResponse.json({ error: 'File and batch name required' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV empty or invalid' }, { status: 400 })
    }

    const delimiter = detectDelimiter(lines)
    const headers = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim())
    const requiredFields = ['name']
    
    for (const field of requiredFields) {
      if (!headers.includes(field)) {
        return NextResponse.json({ error: `Missing required field: ${field}. Found headers: ${headers.join(', ')}` }, { status: 400 })
      }
    }

    const supabase = await createServiceClient()
    const companies: Array<{name: string; category: string | null; image_url: string | null; batch: string}> = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter)
      const row: Record<string, string> = {}
      
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
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
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}