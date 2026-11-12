/**
 * Course completion certificate — verification code + client-side PDF.
 *
 * The PDF is built in the browser with pdf-lib (loaded on demand, so it is
 * not part of the main bundle). Only the built-in standard fonts are used and
 * there is no third-party logo/branding.
 */

export interface CertificateData {
  studentName: string
  studentNpm?: string | null
  courseName: string
  courseCode: string
  /** ISO timestamp of issue (course completed). */
  issuedAt: string
  verificationCode: string
  appName?: string
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // no 0/O/1/I

function fnv1a(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Deterministic verification code `LMS-XXXX-XXXX-XXXX` for (student, course, issue day).
 * Same inputs → same code, so re-downloading a certificate gives the same code.
 * (Demo: not a cryptographic signature; the DB row in `certificates` is the record.)
 */
export function makeVerificationCode(studentId: string, courseId: string, issuedAt: string): string {
  const day = String(issuedAt).slice(0, 10)
  const base = `${studentId}|${courseId}|${day}`
  const chars: string[] = []
  for (const n of [fnv1a(base), fnv1a(base, 0x9e3779b9), fnv1a(base, 0x5bd1e995)]) {
    let x = n
    for (let i = 0; i < 4; i++) {
      chars.push(CODE_ALPHABET[x % 32]!)
      x = Math.floor(x / 32)
    }
  }
  return `LMS-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

export const VERIFICATION_CODE_RE = /^LMS-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/

/** Indonesian long date, e.g. "12 November 2026" (WIB). */
export function formatCertificateDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

/**
 * Standard PDF fonts only cover WinAnsi; replace anything else so pdf-lib
 * does not throw on e.g. emoji or non-Latin names.
 */
export function toWinAnsi(text: string): string {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

export function certificateFileName(d: Pick<CertificateData, 'courseCode' | 'studentName'>): string {
  const slug = (s: string) => toWinAnsi(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `sertifikat-${slug(d.courseCode) || 'mk'}-${slug(d.studentName) || 'mahasiswa'}.pdf`
}

/** Build the certificate PDF (A4 landscape). Returns the file bytes. */
export async function buildCertificatePdf(d: CertificateData): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Sertifikat ${toWinAnsi(d.courseName)}`)
  pdf.setSubject('Sertifikat penyelesaian mata kuliah')
  pdf.setCreator(toWinAnsi(d.appName || 'LMS Mahasiswa'))
  pdf.setProducer(toWinAnsi(d.appName || 'LMS Mahasiswa'))

  const W = 842
  const H = 595
  const page = pdf.addPage([W, H])
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const sans = await pdf.embedFont(StandardFonts.Helvetica)
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Print palette (the PDF is a document, not themed UI).
  const ink = rgb(0.11, 0.12, 0.16)
  const muted = rgb(0.38, 0.4, 0.46)
  const accent = rgb(0.2, 0.23, 0.52)
  const paper = rgb(0.995, 0.99, 0.975)

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: paper })
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: accent, borderWidth: 2.5 })
  page.drawRectangle({ x: 34, y: 34, width: W - 68, height: H - 68, borderColor: accent, borderWidth: 0.6 })

  const center = (text: string, y: number, font: typeof serif, size: number, color = ink) => {
    const t = toWinAnsi(text)
    const w = font.widthOfTextAtSize(t, size)
    page.drawText(t, { x: (W - w) / 2, y, size, font, color })
  }
  /** Shrink to fit `maxWidth`. */
  const fit = (text: string, font: typeof serif, size: number, maxWidth: number) => {
    let s = size
    while (s > 12 && font.widthOfTextAtSize(toWinAnsi(text), s) > maxWidth) s -= 1
    return s
  }

  center((d.appName || 'LMS Mahasiswa').toUpperCase(), H - 92, sansBold, 11, accent)
  center('SERTIFIKAT PENYELESAIAN', H - 150, serifBold, 34, ink)
  page.drawLine({ start: { x: W / 2 - 90, y: H - 166 }, end: { x: W / 2 + 90, y: H - 166 }, thickness: 1, color: accent })
  center('Diberikan kepada', H - 205, serifItalic, 15, muted)

  const nameSize = fit(d.studentName, serifBold, 38, W - 200)
  center(d.studentName, H - 255, serifBold, nameSize, ink)
  if (d.studentNpm) center(`NPM ${d.studentNpm}`, H - 280, sans, 11, muted)

  center('atas keberhasilannya menyelesaikan seluruh materi mata kuliah', H - 320, serif, 15, ink)
  const courseLine = `${d.courseCode} - ${d.courseName}`
  center(courseLine, H - 356, serifBold, fit(courseLine, serifBold, 24, W - 200), accent)

  // Footer: date (left), verification code (right).
  const footY = 112
  page.drawLine({ start: { x: 110, y: footY + 18 }, end: { x: 330, y: footY + 18 }, thickness: 0.6, color: muted })
  page.drawText('Tanggal terbit', { x: 110, y: footY, size: 10, font: sans, color: muted })
  page.drawText(toWinAnsi(formatCertificateDate(d.issuedAt)), { x: 110, y: footY + 26, size: 13, font: serif, color: ink })

  const code = toWinAnsi(d.verificationCode)
  const codeW = sansBold.widthOfTextAtSize(code, 13)
  const rightEdge = W - 110
  page.drawLine({ start: { x: rightEdge - 220, y: footY + 18 }, end: { x: rightEdge, y: footY + 18 }, thickness: 0.6, color: muted })
  page.drawText(code, { x: rightEdge - codeW, y: footY + 26, size: 13, font: sansBold, color: ink })
  const lbl = 'Kode verifikasi'
  page.drawText(lbl, { x: rightEdge - sans.widthOfTextAtSize(lbl, 10), y: footY, size: 10, font: sans, color: muted })

  center('Sertifikat ini dibuat otomatis oleh sistem setelah progres materi mencapai 100%.', 58, sans, 8.5, muted)

  return pdf.save()
}

/** Trigger a browser download of PDF bytes. */
export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
