import { readFileSync } from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import {
  formatBands,
  formatHour,
  itNum,
  timeLabel,
  type DailyReport,
  type RangeReport,
} from '@/lib/admin-analytics'

type Doc = InstanceType<typeof PDFDocument>

const MARGIN = 40
const FOOTER = 28
const ORANGE = '#ff8a26'
const INK = '#231f20'
const MUTED = '#6b7280'
const LIGHT = '#f3f4f6'
const LINE = '#e5e7eb'

const FONT_REGULAR_PATH = 'src/app/og/fonts/open-sauce-one-latin-400-normal.ttf'
const FONT_BOLD_PATH = 'src/app/og/fonts/open-sauce-one-latin-800-normal.ttf'
const LOGO_PATH = 'public/brand/foto-profilo.png'

const shortDate = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const shortDateTime = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

let fontRegular: Buffer | null = null
let fontBold: Buffer | null = null
let logoData: Buffer | null = null

function readOnce(kind: 'regular' | 'bold' | 'logo'): Buffer | null {
  try {
    if (kind === 'regular') {
      fontRegular ??= readFileSync(path.join(process.cwd(), FONT_REGULAR_PATH))
      return fontRegular
    }
    if (kind === 'bold') {
      fontBold ??= readFileSync(path.join(process.cwd(), FONT_BOLD_PATH))
      return fontBold
    }
    logoData ??= readFileSync(path.join(process.cwd(), LOGO_PATH))
    return logoData
  } catch {
    return null
  }
}

function contentWidth(doc: Doc): number {
  return doc.page.width - MARGIN * 2
}

function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y + needed > doc.page.height - MARGIN - FOOTER) {
    doc.addPage()
    doc.y = MARGIN
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function dayKeyToShort(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? dayKey : shortDate.format(date)
}

function sectionTitle(doc: Doc, text: string): void {
  ensureSpace(doc, 34)
  const y = doc.y
  doc.rect(MARGIN, y + 2, 4, 14).fill(ORANGE)
  doc.font('Bold').fontSize(12).fillColor(INK).text(text, MARGIN + 12, y, {
    width: contentWidth(doc) - 12,
    lineBreak: false,
    ellipsis: true,
    height: 16,
  })
  doc.y = y + 22
}

function keyValues(doc: Doc, items: [string, string][]): void {
  const colW = contentWidth(doc) / 2
  for (let i = 0; i < items.length; i += 2) {
    ensureSpace(doc, 32)
    const y = doc.y
    for (let c = 0; c < 2; c += 1) {
      const item = items[i + c]
      if (!item) continue
      const x = MARGIN + c * colW
      doc.font('Regular').fontSize(8).fillColor(MUTED).text(item[0], x, y, { width: colW - 10 })
      doc.font('Bold').fontSize(11).fillColor(INK).text(item[1], x, y + 10, { width: colW - 10 })
    }
    doc.y = y + 30
  }
}

function table(
  doc: Doc,
  headers: string[],
  rows: string[][],
  widths: number[],
  align: ('left' | 'right')[] = [],
): void {
  const total = widths.reduce((acc, w) => acc + w, 0)
  const colW = widths.map((w) => (w / total) * contentWidth(doc))
  const rowH = 16

  const drawHeader = () => {
    ensureSpace(doc, rowH + 2)
    const y = doc.y
    doc.rect(MARGIN, y, contentWidth(doc), rowH).fill(LIGHT)
    let x = MARGIN
    headers.forEach((header, i) => {
      doc.font('Bold').fontSize(8).fillColor(INK).text(header, x + 4, y + 4, {
        width: colW[i] - 8,
        align: align[i] ?? 'left',
        lineBreak: false,
        ellipsis: true,
        height: rowH - 6,
      })
      x += colW[i]
    })
    doc.y = y + rowH
  }

  drawHeader()
  rows.forEach((row) => {
    if (doc.y + rowH > doc.page.height - MARGIN - FOOTER) {
      doc.addPage()
      doc.y = MARGIN
      drawHeader()
    }
    const y = doc.y
    let x = MARGIN
    row.forEach((cell, i) => {
      doc.font('Regular').fontSize(8.5).fillColor(INK).text(cell, x + 4, y + 4, {
        width: colW[i] - 8,
        align: align[i] ?? 'left',
        lineBreak: false,
        ellipsis: true,
        height: rowH - 6,
      })
      x += colW[i]
    })
    doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + contentWidth(doc), y + rowH).strokeColor(LINE).lineWidth(0.5).stroke()
    doc.y = y + rowH
  })
  doc.y += 6
}

function label(doc: Doc, text: string): void {
  ensureSpace(doc, 20)
  doc.font('Bold').fontSize(9).fillColor(INK).text(text, MARGIN, doc.y, { width: contentWidth(doc) })
  doc.y += 13
}

function drawHeader(doc: Doc, report: RangeReport, batchLabel: string): void {
  const top = MARGIN
  let titleX = MARGIN
  const logo = readOnce('logo')
  if (logo) {
    try {
      doc.image(logo, MARGIN, top, { width: 34 })
      titleX = MARGIN + 46
    } catch {
      titleX = MARGIN
    }
  }

  const titleWidth = contentWidth(doc) - (titleX - MARGIN)
  doc.font('Bold').fontSize(18).fillColor(INK).text('Report votazioni', titleX, top - 2, { width: titleWidth })
  const range = `${dayKeyToShort(report.from)} – ${dayKeyToShort(report.to)}`
  const generated = shortDateTime.format(new Date(report.generatedAt))
  doc
    .font('Regular')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`FANTACER · Batch: ${batchLabel} · Intervallo: ${range} · Generato il ${generated}`, titleX, top + 22, {
      width: titleWidth,
    })

  doc.y = top + 48
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + contentWidth(doc), doc.y).strokeColor(ORANGE).lineWidth(2).stroke()
  doc.y += 12
}

function drawTotals(doc: Doc, report: RangeReport): void {
  sectionTitle(doc, 'Totali periodo')
  const peak = report.totals.peakDay
  keyValues(doc, [
    ['Giorni analizzati', itNum(report.totals.days)],
    ['Voti totali', itNum(report.totals.votes)],
    ['Votanti singoli', itNum(report.totals.uniqueVoters)],
    ['Punti assegnati', itNum(report.totals.totalPoints)],
    ['Giorno di picco', peak ? `${dayKeyToShort(peak.date)} (${itNum(peak.votes)} voti)` : '—'],
    ['Media voti/giorno', report.totals.days ? itNum(Math.round((report.totals.votes / report.totals.days) * 10) / 10) : '0'],
  ])
}

function drawDay(doc: Doc, day: DailyReport): void {
  sectionTitle(doc, capitalize(day.dayLabel))
  keyValues(doc, [
    ['Voti', itNum(day.votes)],
    ['Votanti singoli', itNum(day.uniqueVoters)],
    ['Punti', itNum(day.totalPoints)],
    ['Media voti/ora attiva', itNum(day.avgVotesPerHour)],
    ['Fascia di punta', day.peakHour === null ? '—' : `${formatHour(day.peakHour)}–${formatHour(day.peakHour + 1)}`],
    ['Ore attive', itNum(day.activeHours)],
    ['Primo voto', timeLabel(day.firstVoteAt)],
    ['Ultimo voto', timeLabel(day.lastVoteAt)],
    ['Voti ieri', itNum(day.yesterday.votes)],
    ['Votanti ieri', itNum(day.yesterday.uniqueVoters)],
  ])

  label(doc, 'Fasce orarie')
  const bands = formatBands(day.hourly)
  table(
    doc,
    bands.map((b) => b.label),
    [bands.map((b) => itNum(b.votes))],
    bands.map(() => 1),
    bands.map(() => 'right' as const),
  )

  label(doc, 'Top aziende del giorno')
  const top = day.companies.slice(0, 10)
  if (top.length === 0) {
    doc.font('Regular').fontSize(9).fillColor(MUTED).text('Nessun voto registrato.', MARGIN, doc.y)
    doc.y += 16
  } else {
    table(
      doc,
      ['#', 'Azienda', 'Punti', 'Voti'],
      top.map((company, index) => [String(index + 1), company.name, itNum(company.points), itNum(company.votes)]),
      [6, 60, 18, 16],
      ['left', 'left', 'right', 'right'],
    )
  }

  label(doc, 'Paesi')
  const countries = day.countries.length
    ? day.countries.map((c) => `${c.country} (${itNum(c.votes)})`).join(' · ')
    : 'Nessun dato.'
  doc.font('Regular').fontSize(9).fillColor(INK).text(countries, MARGIN, doc.y, { width: contentWidth(doc) })
  doc.y += 20
}

function addFooters(doc: Doc): void {
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i)
    // Dentro l'area del margine inferiore, ma con spazio sufficiente a evitare
    // che pdfkit inserisca una pagina per overflow del testo.
    const y = doc.page.height - MARGIN - 16
    doc.moveTo(MARGIN, y - 6).lineTo(MARGIN + contentWidth(doc), y - 6).strokeColor(LINE).lineWidth(0.5).stroke()
    doc.font('Regular').fontSize(8).fillColor(MUTED).text('FANTACER · Report votazioni', MARGIN, y, {
      width: contentWidth(doc) / 2,
      lineBreak: false,
    })
    doc.text(`Pagina ${i - range.start + 1} / ${range.count}`, MARGIN + contentWidth(doc) / 2, y, {
      width: contentWidth(doc) / 2,
      align: 'right',
      lineBreak: false,
    })
  }
}

/**
 * Rende il report multi-giorno in un PDF A4 brandizzato (Open Sauce One +
 * logo). Ritorna il buffer completo. Lato server (pdfkit, runtime Node).
 */
export function renderRangeReportPdf(report: RangeReport, batchLabel: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true })

  const regular = readOnce('regular')
  const bold = readOnce('bold')
  if (regular) doc.registerFont('Regular', regular)
  if (bold) doc.registerFont('Bold', bold)
  doc.font(regular ? 'Regular' : 'Helvetica')

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  drawHeader(doc, report, batchLabel)
  drawTotals(doc, report)

  if (report.days.length === 0) {
    doc.font('Regular').fontSize(10).fillColor(MUTED).text('Nessun dato nel periodo selezionato.', MARGIN, doc.y)
  } else {
    for (const day of report.days) drawDay(doc, day)
  }

  addFooters(doc)
  doc.end()
  return done
}
