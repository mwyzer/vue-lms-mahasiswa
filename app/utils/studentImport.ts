/**
 * Student import — pure validation of a roster CSV (no DOM, no Nuxt).
 *
 * Columns (header names are case-insensitive, aliases in COLUMN_ALIASES):
 *   nama*  npm*  kelas  level  sesi  email
 * `level` and `sesi` are required unless a target course is chosen, in which
 * case they default to the course's level/session (enrolment in this app is
 * level + session based).
 *
 * Every row gets a status:
 *   valid     — will be imported
 *   invalid   — has at least one error (listed per row)
 *   duplicate — NPM/email already in the roster or earlier in the file
 */
import { parseCsvText, toCsvString } from './csvTools'

export type SessionTime = 'morning' | 'evening'

export interface StudentImportData {
  nama: string
  npm: string
  kelas: string
  level: number
  session_time: SessionTime
  email: string | null
}

export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate'

export interface StudentImportRow {
  /** Line number in the CSV file (header = line 1). */
  line: number
  raw: Record<string, string>
  data: StudentImportData | null
  status: ImportRowStatus
  errors: string[]
  warnings: string[]
}

export interface StudentImportPreview {
  rows: StudentImportRow[]
  /** File-level problems (missing columns, empty file, too many rows). */
  fileErrors: string[]
  summary: { total: number; valid: number; invalid: number; duplicate: number }
}

export interface ExistingStudent {
  id?: string
  nama: string
  npm: string
  email?: string | null
}

export interface ImportTargetCourse {
  id: string
  kode?: string
  level: number
  session_time: SessionTime
}

export const MAX_IMPORT_ROWS = 500

export const IMPORT_COLUMNS = ['nama', 'npm', 'kelas', 'level', 'sesi', 'email'] as const
type ImportColumn = (typeof IMPORT_COLUMNS)[number]

const COLUMN_ALIASES: Record<ImportColumn, string[]> = {
  nama: ['nama', 'name', 'nama lengkap', 'nama mahasiswa'],
  npm: ['npm', 'nim', 'nomor induk', 'student id'],
  kelas: ['kelas', 'class'],
  level: ['level', 'tingkat', 'semester'],
  sesi: ['sesi', 'session', 'session_time', 'waktu', 'jadwal'],
  email: ['email', 'e-mail', 'surel'],
}

const SESSION_ALIASES: Record<string, SessionTime> = {
  morning: 'morning', pagi: 'morning', p: 'morning',
  evening: 'evening', sore: 'evening', malam: 'evening', s: 'evening',
}

const NPM_RE = /^[A-Za-z0-9]{4,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KELAS_RE = /^[A-Za-z0-9-]{1,10}$/

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Map CSV headers to known columns. Unknown headers are ignored. */
export function mapImportHeaders(headers: string[]): Partial<Record<ImportColumn, number>> {
  const map: Partial<Record<ImportColumn, number>> = {}
  headers.forEach((h, idx) => {
    const n = normHeader(h)
    for (const col of IMPORT_COLUMNS) {
      if (map[col] === undefined && COLUMN_ALIASES[col].includes(n)) map[col] = idx
    }
  })
  return map
}

export function parseSessionTime(v: string): SessionTime | null {
  return SESSION_ALIASES[v.trim().toLowerCase()] ?? null
}

/** Validate one record. Exported for the server endpoint (re-validation). */
export function validateStudentRecord(
  raw: Record<string, string>,
  course: ImportTargetCourse | null = null,
): { data: StudentImportData | null; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  const nama = (raw.nama ?? '').trim().replace(/\s+/g, ' ')
  const npm = (raw.npm ?? '').trim()
  const kelas = (raw.kelas ?? '').trim().toUpperCase()
  const levelRaw = (raw.level ?? '').trim()
  const sesiRaw = (raw.sesi ?? '').trim()
  const emailRaw = (raw.email ?? '').trim()

  if (!nama) errors.push('Nama wajib diisi.')
  else if (nama.length < 2 || nama.length > 255) errors.push('Nama harus 2–255 karakter.')
  else if (/^[=+\-@]/.test(nama)) errors.push('Nama tidak boleh diawali =, +, - atau @.')

  if (!npm) errors.push('NPM wajib diisi.')
  else if (!NPM_RE.test(npm)) errors.push('NPM harus 4–20 karakter huruf/angka tanpa spasi.')

  if (kelas && !KELAS_RE.test(kelas)) errors.push('Kelas maksimal 10 karakter (huruf, angka, -).')

  let level: number | null = null
  if (levelRaw) {
    const n = Number(levelRaw)
    if (!Number.isInteger(n) || n < 1 || n > 5) errors.push('Level harus bilangan bulat 1–5.')
    else level = n
  }

  let session: SessionTime | null = null
  if (sesiRaw) {
    session = parseSessionTime(sesiRaw)
    if (!session) errors.push('Sesi harus "pagi"/"morning" atau "sore"/"evening".')
  }

  if (course) {
    if (level !== null && level !== course.level) {
      warnings.push(`Level ${level} diganti ${course.level} mengikuti mata kuliah ${course.kode ?? ''}`.trim() + '.')
    }
    if (session !== null && session !== course.session_time) {
      warnings.push(`Sesi diganti ${course.session_time === 'morning' ? 'pagi' : 'sore'} mengikuti mata kuliah.`)
    }
    level = course.level
    session = course.session_time
  } else {
    if (!levelRaw) errors.push('Level wajib diisi (atau pilih mata kuliah tujuan).')
    if (!sesiRaw) errors.push('Sesi wajib diisi (atau pilih mata kuliah tujuan).')
  }

  let email: string | null = null
  if (emailRaw) {
    if (!EMAIL_RE.test(emailRaw) || emailRaw.length > 255) errors.push('Format email tidak valid.')
    else email = emailRaw.toLowerCase()
  }

  if (errors.length > 0 || level === null || session === null) return { data: null, errors, warnings }

  const finalKelas = kelas || `${level}${session === 'morning' ? 'A' : 'B'}`
  if (!kelas) warnings.push(`Kelas kosong, diisi otomatis "${finalKelas}".`)

  return { data: { nama, npm, kelas: finalKelas, level, session_time: session, email }, errors, warnings }
}

/**
 * Parse + validate a roster CSV and detect duplicates (inside the file and
 * against the existing roster).
 */
export function buildStudentImportPreview(
  csvText: string,
  existing: ExistingStudent[] = [],
  course: ImportTargetCourse | null = null,
): StudentImportPreview {
  const fileErrors: string[] = []
  const parsed = parseCsvText(csvText)
  const empty = { rows: [], summary: { total: 0, valid: 0, invalid: 0, duplicate: 0 } }

  if (parsed.headers.length === 0) {
    return { ...empty, fileErrors: ['File kosong atau tidak bisa dibaca sebagai CSV.'] }
  }

  const map = mapImportHeaders(parsed.headers)
  const missing = (['nama', 'npm'] as const).filter((c) => map[c] === undefined)
  if (!course) {
    for (const c of ['level', 'sesi'] as const) if (map[c] === undefined) missing.push(c as never)
  }
  if (missing.length > 0) {
    return { ...empty, fileErrors: [`Kolom wajib tidak ditemukan: ${missing.join(', ')}. Gunakan template.`] }
  }

  let records = parsed.rows
  if (records.length === 0) fileErrors.push('Tidak ada baris data di bawah header.')
  if (records.length > MAX_IMPORT_ROWS) {
    fileErrors.push(`Maksimal ${MAX_IMPORT_ROWS} baris per impor; ${records.length - MAX_IMPORT_ROWS} baris terakhir diabaikan.`)
    records = records.slice(0, MAX_IMPORT_ROWS)
  }

  const existingNpm = new Map(existing.map((s) => [String(s.npm).toLowerCase(), s]))
  const existingEmail = new Map(
    existing.filter((s) => s.email).map((s) => [String(s.email).toLowerCase(), s]),
  )
  const seenNpm = new Map<string, number>()
  const seenEmail = new Map<string, number>()

  const rows: StudentImportRow[] = records.map((r) => {
    const raw: Record<string, string> = {}
    for (const col of IMPORT_COLUMNS) {
      const idx = map[col]
      raw[col] = idx === undefined ? '' : (r.cells[idx] ?? '')
    }

    const { data, errors, warnings } = validateStudentRecord(raw, course)
    let status: ImportRowStatus = errors.length > 0 ? 'invalid' : 'valid'

    const npmKey = raw.npm.trim().toLowerCase()
    if (npmKey) {
      const ex = existingNpm.get(npmKey)
      const prev = seenNpm.get(npmKey)
      if (ex) {
        errors.push(`NPM ${raw.npm.trim()} sudah terdaftar atas nama ${ex.nama}.`)
        status = 'duplicate'
      } else if (prev !== undefined) {
        errors.push(`NPM ${raw.npm.trim()} sudah muncul di baris ${prev}.`)
        status = 'duplicate'
      } else {
        seenNpm.set(npmKey, r.line)
      }
    }

    const emailKey = data?.email ?? ''
    if (emailKey && status !== 'duplicate') {
      const ex = existingEmail.get(emailKey)
      const prev = seenEmail.get(emailKey)
      if (ex) {
        errors.push(`Email ${emailKey} sudah dipakai ${ex.nama}.`)
        status = 'duplicate'
      } else if (prev !== undefined) {
        errors.push(`Email ${emailKey} sudah muncul di baris ${prev}.`)
        status = 'duplicate'
      } else {
        seenEmail.set(emailKey, r.line)
      }
    }

    return { line: r.line, raw, data: status === 'valid' ? data : null, status, errors, warnings }
  })

  return {
    rows,
    fileErrors,
    summary: {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
    },
  }
}

/** Downloadable template (UTF-8 BOM, comma separated). */
export function studentImportTemplateCsv(): string {
  return toCsvString(
    ['nama', 'npm', 'kelas', 'level', 'sesi', 'email'],
    [
      ['Rina Maharani', '20261001', '1A', 1, 'pagi', 'rina@example.ac.id'],
      ['Satria Nugraha', '20261002', '1B', 1, 'sore', ''],
    ],
  )
}

/** CSV report of the rows that were not imported (for fixing and re-uploading). */
export function importErrorReportCsv(rows: StudentImportRow[]): string {
  return toCsvString(
    ['baris', 'status', 'nama', 'npm', 'kelas', 'level', 'sesi', 'email', 'masalah'],
    rows
      .filter((r) => r.status !== 'valid')
      .map((r) => [r.line, r.status, r.raw.nama, r.raw.npm, r.raw.kelas, r.raw.level, r.raw.sesi, r.raw.email, r.errors.join(' | ')]),
  )
}
