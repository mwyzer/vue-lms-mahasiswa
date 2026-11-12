import { describe, it, expect } from 'vitest'
import {
  parseCsvText,
  parseCsvRecords,
  detectCsvDelimiter,
  sanitizeCsvCell,
  toCsvString,
  UTF8_BOM,
} from '~/utils/csvTools'
import {
  buildStudentImportPreview,
  studentImportTemplateCsv,
  importErrorReportCsv,
  validateStudentRecord,
  MAX_IMPORT_ROWS,
} from '~/utils/studentImport'

describe('parseCsvText', () => {
  it('parses quoted fields, escaped quotes, embedded newlines and CRLF', () => {
    const text = 'nama,catatan\r\n"Budi, S.Kom","Kata ""halo""\nbaris dua"\r\nCitra,biasa\r\n'
    const p = parseCsvText(text)
    expect(p.headers).toEqual(['nama', 'catatan'])
    expect(p.rows).toHaveLength(2)
    expect(p.rows[0].cells).toEqual(['Budi, S.Kom', 'Kata "halo"\nbaris dua'])
    expect(p.rows[0].line).toBe(2)
    expect(p.rows[1].line).toBe(4)
  })

  it('strips the UTF-8 BOM and auto-detects semicolons', () => {
    const p = parseCsvText(`${UTF8_BOM}nama;npm\nSiti Nurhaliza;123456\n`)
    expect(p.delimiter).toBe(';')
    expect(p.headers).toEqual(['nama', 'npm'])
    expect(p.rows[0].cells).toEqual(['Siti Nurhaliza', '123456'])
  })

  it('skips blank lines and handles a missing trailing newline', () => {
    expect(parseCsvRecords('a,b\n\n1,2')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 3, cells: ['1', '2'] },
    ])
    expect(detectCsvDelimiter('a\tb\tc\n')).toBe('\t')
  })
})

describe('CSV injection guard', () => {
  it('prefixes cells that start with = + - @ tab or CR', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1")
    expect(sanitizeCsvCell('+62812')).toBe("'+62812")
    expect(sanitizeCsvCell('-2+3')).toBe("'-2+3")
    expect(sanitizeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(sanitizeCsvCell('\t=cmd')).toBe("'\t=cmd")
    expect(sanitizeCsvCell('Budi')).toBe('Budi')
  })

  it('leaves numbers, empty values and the "-" placeholder alone', () => {
    expect(sanitizeCsvCell(-5)).toBe('-5')
    expect(sanitizeCsvCell(null)).toBe('')
    expect(sanitizeCsvCell('-')).toBe('-')
  })

  it('toCsvString adds a BOM, CRLF line endings and quotes when needed', () => {
    const csv = toCsvString(['nama', 'catatan'], [['=HYPERLINK("http://x")', 'a, b'], ['Ana', 'kata "x"']])
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    expect(csv).toBe(`${UTF8_BOM}nama,catatan\r\n"'=HYPERLINK(""http://x"")","a, b"\r\nAna,"kata ""x"""\r\n`)
    // Round-trip: the parser reads back the sanitised value
    const back = parseCsvText(csv)
    expect(back.rows[0].cells[0]).toBe(`'=HYPERLINK("http://x")`)
    expect(toCsvString(['a'], [], { bom: false })).toBe('a\r\n')
  })
})

describe('buildStudentImportPreview', () => {
  const existing = [{ id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', email: 'ahmad@lms.ac.id' }]

  it('accepts the downloadable template as-is', () => {
    const p = buildStudentImportPreview(studentImportTemplateCsv(), existing)
    expect(p.fileErrors).toEqual([])
    expect(p.summary).toEqual({ total: 2, valid: 2, invalid: 0, duplicate: 0 })
    expect(p.rows[0].data).toEqual({ nama: 'Rina Maharani', npm: '20261001', kelas: '1A', level: 1, session_time: 'morning', email: 'rina@example.ac.id' })
    expect(p.rows[1].data?.session_time).toBe('evening')
  })

  it('reports per-row validation errors with the file line number', () => {
    const csv = [
      'Nama,NIM,Kelas,Level,Sesi,Email',
      ',123,1A,9,siang,bukan-email',
      '=cmd|calc,20260001,1A,1,pagi,',
      'Dewi Sartika,2026 0002,1A,1,pagi,',
    ].join('\n')
    const p = buildStudentImportPreview(csv, existing)
    expect(p.summary.invalid).toBe(3)
    const [r1, r2, r3] = p.rows
    expect(r1.line).toBe(2)
    expect(r1.errors).toEqual(expect.arrayContaining([
      'Nama wajib diisi.',
      'NPM harus 4–20 karakter huruf/angka tanpa spasi.',
      'Level harus bilangan bulat 1–5.',
      'Sesi harus "pagi"/"morning" atau "sore"/"evening".',
      'Format email tidak valid.',
    ]))
    expect(r2.errors).toContain('Nama tidak boleh diawali =, +, - atau @.')
    expect(r3.line).toBe(4)
    expect(r3.data).toBeNull()
  })

  it('detects duplicates against the roster and inside the file', () => {
    const csv = [
      'nama,npm,level,sesi,email',
      'Ahmad Lain,20241001,1,pagi,',
      'Baru Satu,20269999,1,pagi,baru@x.id',
      'Baru Dua,20269999,1,pagi,',
      'Baru Tiga,20268888,1,pagi,AHMAD@lms.ac.id',
      'Baru Empat,20267777,1,pagi,baru@x.id',
    ].join('\n')
    const p = buildStudentImportPreview(csv, existing)
    expect(p.rows.map((r) => r.status)).toEqual(['duplicate', 'valid', 'duplicate', 'duplicate', 'duplicate'])
    expect(p.rows[0].errors[0]).toMatch(/sudah terdaftar atas nama Ahmad Fauzi/)
    expect(p.rows[2].errors[0]).toMatch(/sudah muncul di baris 3/)
    expect(p.rows[3].errors[0]).toMatch(/sudah dipakai Ahmad Fauzi/)
    expect(p.rows[4].errors[0]).toMatch(/Email baru@x.id sudah muncul di baris 3/)
    expect(p.summary).toEqual({ total: 5, valid: 1, invalid: 0, duplicate: 4 })
    expect(p.rows[1].warnings[0]).toMatch(/Kelas kosong/)
  })

  it('uses the target course level/session and makes those columns optional', () => {
    const course = { id: 'c1', kode: 'MK101', level: 1, session_time: 'morning' as const }
    const p = buildStudentImportPreview('nama,npm\nTono,20265555\n', [], course)
    expect(p.fileErrors).toEqual([])
    expect(p.rows[0].data).toMatchObject({ level: 1, session_time: 'morning', kelas: '1A' })

    const r = validateStudentRecord({ nama: 'Tini', npm: '20265556', level: '3', sesi: 'sore' }, course)
    expect(r.data?.level).toBe(1)
    expect(r.warnings.join(' ')).toMatch(/Level 3 diganti 1/)
  })

  it('reports file-level problems', () => {
    expect(buildStudentImportPreview('').fileErrors[0]).toMatch(/kosong/)
    expect(buildStudentImportPreview('nama,kelas\nA,1A').fileErrors[0]).toMatch(/npm, level, sesi/)
    const many = ['nama,npm,level,sesi', ...Array.from({ length: MAX_IMPORT_ROWS + 3 }, (_, i) => `Mhs ${i},N${10000 + i},1,pagi`)].join('\n')
    const p = buildStudentImportPreview(many)
    expect(p.rows).toHaveLength(MAX_IMPORT_ROWS)
    expect(p.fileErrors[0]).toMatch(/3 baris terakhir diabaikan/)
  })

  it('builds an error report CSV with only the rejected rows (sanitised)', () => {
    const p = buildStudentImportPreview('nama,npm,level,sesi\n=evil(),20261234,1,pagi\nOke,20261235,1,pagi\n')
    const report = importErrorReportCsv(p.rows)
    const parsed = parseCsvText(report)
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].cells[0]).toBe('2')
    expect(parsed.rows[0].cells[2]).toBe("'=evil()")
  })
})
