import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  buildXlsx,
  buildCsv,
  buildPdf,
  gradebookTable,
  attendanceTable,
  rosterTable,
  safeSheetName,
  safeFileName,
  pdfSafeText,
} from '~/utils/exportFiles'
import { UTF8_BOM, parseCsvText } from '~/utils/csvTools'

const weights = { tugas: 30, kuis: 20, presensi: 10, uts: 20, uas: 20 }
const gradeRows = [
  { nama: 'Ahmad Fauzi', npm: '20241001', tugas: 90, kuis: 90, presensi: 67, uts: 85, uas: null, final: 85.6, letter: 'A', isProvisional: true },
  { nama: '=cmd|calc', npm: '20241002', tugas: null, kuis: null, presensi: null, uts: null, uas: null, final: null, letter: null, isProvisional: true },
]

describe('table builders', () => {
  it('gradebookTable labels weights and statuses', () => {
    const t = gradebookTable(gradeRows, weights)
    expect(t.headers).toContain('Tugas (30%)')
    expect(t.rows[0]).toEqual([1, '20241001', 'Ahmad Fauzi', 90, 90, 67, 85, '-', 85.6, 'A', 'Sementara'])
    expect(t.rows[1].at(-1)).toBe('Belum ada nilai')
  })

  it('attendanceTable builds a meeting matrix with totals', () => {
    const t = attendanceTable(
      [{ id: 's1', nama: 'A', npm: '1' }, { id: 's2', nama: 'B', npm: '2' }],
      [
        { student_id: 's1', pertemuan: 1, tanggal: '2025-09-02', status: 'hadir' },
        { student_id: 's1', pertemuan: 2, tanggal: '2025-09-09', status: 'sakit' },
        { student_id: 's2', pertemuan: 1, tanggal: '2025-09-02', status: 'alpha' },
      ],
    )
    expect(t.headers).toEqual(['No', 'NPM', 'Nama Mahasiswa', 'P1 (2025-09-02)', 'P2 (2025-09-09)', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Kehadiran (%)'])
    expect(t.rows[0]).toEqual([1, '1', 'A', 'H', 'S', 1, 0, 1, 0, 50])
    expect(t.rows[1]).toEqual([2, '2', 'B', 'A', '-', 0, 0, 0, 1, 0])
  })

  it('rosterTable optionally includes campus', () => {
    const t = rosterTable([{ nama: 'A', npm: '1', kelas: '1A', level: 1, session_time: 'evening', kampus: 'Kampus Utama' }], 'M', true)
    expect(t.headers.at(-1)).toBe('Kampus')
    expect(t.rows[0]).toEqual([1, '1', 'A', '1A', 1, 'sore', '', 'Kampus Utama'])
  })
})

describe('file builders', () => {
  it('CSV export is UTF-8 BOM prefixed and neutralises formulas', () => {
    const csv = buildCsv(gradebookTable(gradeRows, weights))
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    const parsed = parseCsvText(csv)
    expect(parsed.rows[1].cells[2]).toBe("'=cmd|calc")
    expect(parsed.rows[1].cells[3]).toBe('-')
  })

  it('XLSX export keeps numbers numeric and writes formula-like text as plain strings', () => {
    const bytes = buildXlsx([gradebookTable(gradeRows, weights, 'Nilai MK101'), rosterTable([], 'Nilai MK101')])
    expect(bytes[0]).toBe(0x50) // "PK" zip header
    expect(bytes[1]).toBe(0x4b)
    const wb = XLSX.read(bytes, { type: 'array' })
    expect(wb.SheetNames).toEqual(['Nilai MK101', 'Nilai MK101 (2)'])
    const ws = wb.Sheets['Nilai MK101']
    expect(ws.D2.t).toBe('n')
    expect(ws.D2.v).toBe(90)
    expect(ws.C3.t).toBe('s')
    expect(ws.C3.v).toBe('=cmd|calc')
    expect(ws.C3.f).toBeUndefined()
  })

  it('PDF export produces a PDF document', async () => {
    const bytes = await buildPdf(gradebookTable(gradeRows, weights), { title: 'Buku Nilai — MK101', subtitle: 'Uji', footnote: 'Catatan' })
    const head = new TextDecoder().decode(bytes.slice(0, 5))
    expect(head).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('name helpers', () => {
    expect(safeSheetName('a/b:c?d*e[f]g'.repeat(4)).length).toBeLessThanOrEqual(31)
    expect(safeSheetName('a/b')).toBe('a b')
    expect(safeFileName('Nilai MK101 — Pemrograman/Dasar')).toBe('Nilai_MK101_Pemrograman_Dasar')
    expect(pdfSafeText('a — b → c “d”')).toBe('a - b -> c "d"')
  })
})
