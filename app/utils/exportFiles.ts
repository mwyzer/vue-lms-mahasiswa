/**
 * Export builders — pure functions that turn tables into file bytes.
 *
 *  - CSV  : toCsvString (UTF-8 BOM, formula-injection guard) → Blob
 *  - XLSX : SheetJS (`xlsx`), every text cell written as a string cell (never a formula)
 *  - PDF  : jsPDF + jspdf-autotable, loaded lazily so they stay out of the main bundle
 *
 * Plus row builders for the three exports (gradebook, attendance, roster), so
 * the column layout is unit-tested and shared by the instructor and admin pages.
 */
import * as XLSX from 'xlsx'
import { toCsvString, type CsvCell } from './csvTools'

export interface ExportTable {
  /** Sheet name (XLSX) / title. */
  name: string
  headers: string[]
  rows: CsvCell[][]
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const CSV_MIME = 'text/csv;charset=utf-8'

/** Excel sheet names: max 31 chars, none of : \ / ? * [ ] */
export function safeSheetName(name: string): string {
  return (name || 'Sheet1').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1'
}

/** File-system friendly name (keeps letters, digits, - and _). */
export function safeFileName(name: string): string {
  return (name || 'export').normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'export'
}

export function buildCsv(table: Pick<ExportTable, 'headers' | 'rows'>): string {
  return toCsvString(table.headers, table.rows)
}

/**
 * Build an .xlsx workbook. Text cells are always typed as strings (`t: 's'`)
 * and no cell ever gets a formula (`f`), so a value such as "=HYPERLINK(...)"
 * is shown as text and never evaluated. (The apostrophe guard is only needed
 * for CSV, where the spreadsheet app decides the cell type itself.)
 */
export function buildXlsx(tables: ExportTable[]): Uint8Array {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const t of tables) {
    const aoa = [t.headers, ...t.rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : c)))]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Force every non-number cell to a plain string cell.
    for (const key of Object.keys(ws)) {
      if (key.startsWith('!')) continue
      const cell = ws[key] as XLSX.CellObject
      delete cell.f
      if (cell.t !== 'n' && cell.t !== 'b') {
        cell.t = 's'
        cell.v = String(cell.v ?? '')
      }
    }
    ws['!cols'] = t.headers.map((h, i) => ({
      wch: Math.min(45, Math.max(String(h).length, ...t.rows.map((r) => String(r[i] ?? '').length)) + 2),
    }))
    let name = safeSheetName(t.name)
    let n = 2
    while (used.has(name)) name = safeSheetName(`${t.name.slice(0, 27)} (${n++})`)
    used.add(name)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Uint8Array(out)
}

export interface PdfOptions {
  title: string
  subtitle?: string
  orientation?: 'portrait' | 'landscape'
  footnote?: string
}

/** Replace characters outside WinAnsi (jsPDF standard fonts) with close ASCII. */
export function pdfSafeText(v: CsvCell): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/[–—−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '')
}

/** Build a PDF with one table. Returns the raw bytes. */
export async function buildPdf(table: Pick<ExportTable, 'headers' | 'rows'>, opts: PdfOptions): Promise<Uint8Array> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any).autoTable
  const doc = new jsPDF({ orientation: opts.orientation ?? 'portrait', unit: 'pt', format: 'a4' })

  doc.setFontSize(14)
  doc.text(pdfSafeText(opts.title), 40, 44)
  let y = 44
  if (opts.subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(90)
    y += 16
    doc.text(pdfSafeText(opts.subtitle), 40, y)
    doc.setTextColor(0)
  }

  autoTable(doc, {
    startY: y + 14,
    head: [table.headers.map(pdfSafeText)],
    body: table.rows.map((r) => r.map(pdfSafeText)),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 40, right: 40 },
  })

  if (opts.footnote) {
    const finalY = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 16
    doc.setFontSize(7)
    doc.setTextColor(90)
    doc.text(doc.splitTextToSize(pdfSafeText(opts.footnote), doc.internal.pageSize.getWidth() - 80), 40, finalY)
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

/** Trigger a browser download (client only). */
export function downloadFile(data: string | Uint8Array | Blob, filename: string, mime: string): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Row builders ─────────────────────────────────────────

export interface GradebookExportRow {
  nama: string
  npm: string
  tugas: number | null
  kuis: number | null
  presensi: number | null
  uts: number | null
  uas: number | null
  final: number | null
  letter: string | null
  isProvisional: boolean
}

export type GradeWeightSet = Record<'tugas' | 'kuis' | 'presensi' | 'uts' | 'uas', number>

export function gradebookTable(rows: GradebookExportRow[], weights: GradeWeightSet, name = 'Nilai'): ExportTable {
  const dash = (v: number | null) => (v === null || v === undefined ? '-' : v)
  return {
    name,
    headers: [
      'No', 'NPM', 'Nama Mahasiswa',
      `Tugas (${weights.tugas}%)`, `Kuis (${weights.kuis}%)`, `Presensi (${weights.presensi}%)`,
      `UTS (${weights.uts}%)`, `UAS (${weights.uas}%)`,
      'Nilai Akhir', 'Huruf', 'Status',
    ],
    rows: rows.map((r, i) => [
      i + 1, r.npm, r.nama,
      dash(r.tugas), dash(r.kuis), dash(r.presensi), dash(r.uts), dash(r.uas),
      dash(r.final), r.letter ?? '-',
      r.final === null ? 'Belum ada nilai' : r.isProvisional ? 'Sementara' : 'Final',
    ]),
  }
}

export interface AttendanceExportRecord {
  student_id: string
  pertemuan: number
  tanggal: string
  status: 'hadir' | 'izin' | 'sakit' | 'alpha'
}

const STATUS_CODE: Record<AttendanceExportRecord['status'], string> = { hadir: 'H', izin: 'I', sakit: 'S', alpha: 'A' }

/**
 * Attendance matrix: one row per student, one column per meeting (H/I/S/A),
 * plus totals and the attendance percentage (hadir / recorded meetings).
 */
export function attendanceTable(
  students: { id: string; nama: string; npm: string }[],
  records: AttendanceExportRecord[],
  name = 'Presensi',
): ExportTable {
  const meetings = [...new Set(records.map((r) => r.pertemuan))].sort((a, b) => a - b)
  const dateOf = (p: number) => records.find((r) => r.pertemuan === p)?.tanggal?.slice(0, 10) ?? ''
  return {
    name,
    headers: [
      'No', 'NPM', 'Nama Mahasiswa',
      ...meetings.map((p) => `P${p}${dateOf(p) ? ` (${dateOf(p)})` : ''}`),
      'Hadir', 'Izin', 'Sakit', 'Alpa', 'Kehadiran (%)',
    ],
    rows: students.map((s, i) => {
      const mine = records.filter((r) => r.student_id === s.id)
      const count = (st: AttendanceExportRecord['status']) => mine.filter((r) => r.status === st).length
      const cells = meetings.map((p) => {
        const r = mine.find((x) => x.pertemuan === p)
        return r ? STATUS_CODE[r.status] : '-'
      })
      return [
        i + 1, s.npm, s.nama, ...cells,
        count('hadir'), count('izin'), count('sakit'), count('alpha'),
        mine.length ? Math.round((count('hadir') / mine.length) * 100) : '-',
      ]
    }),
  }
}

export interface RosterExportStudent {
  nama: string
  npm: string
  kelas: string
  level: number
  session_time: 'morning' | 'evening'
  email?: string | null
  kampus?: string | null
}

export function rosterTable(students: RosterExportStudent[], name = 'Mahasiswa', withCampus = false): ExportTable {
  const headers = ['No', 'NPM', 'Nama', 'Kelas', 'Level', 'Sesi', 'Email']
  if (withCampus) headers.push('Kampus')
  return {
    name,
    headers,
    rows: students.map((s, i) => {
      const row: CsvCell[] = [i + 1, s.npm, s.nama, s.kelas, s.level, s.session_time === 'morning' ? 'pagi' : 'sore', s.email ?? '']
      if (withCampus) row.push(s.kampus ?? '')
      return row
    }),
  }
}
