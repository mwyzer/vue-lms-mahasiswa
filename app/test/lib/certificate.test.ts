/**
 * Certificate — verification code and PDF generation (pdf-lib).
 */
import { describe, it, expect } from 'vitest'
import {
  buildCertificatePdf,
  certificateFileName,
  makeVerificationCode,
  toWinAnsi,
  VERIFICATION_CODE_RE,
} from '~/lib/certificate'

describe('makeVerificationCode', () => {
  it('is deterministic per student + course + issue day and well-formed', () => {
    const a = makeVerificationCode('s1', 'c2', '2026-11-12T08:00:00Z')
    expect(a).toMatch(VERIFICATION_CODE_RE)
    expect(makeVerificationCode('s1', 'c2', '2026-11-12T23:00:00Z')).toBe(a)
    expect(makeVerificationCode('s2', 'c2', '2026-11-12T08:00:00Z')).not.toBe(a)
    expect(makeVerificationCode('s1', 'c1', '2026-11-12T08:00:00Z')).not.toBe(a)
  })
})

describe('text helpers', () => {
  it('maps text to WinAnsi-safe characters', () => {
    expect(toWinAnsi('Siti Nur’aini 🎓 — Café')).toBe("Siti Nur'aini  - Cafe")
  })
  it('builds a safe file name', () => {
    expect(certificateFileName({ courseCode: 'MK102', studentName: 'Ahmad Fauzi' })).toBe('sertifikat-mk102-ahmad-fauzi.pdf')
  })
})

describe('buildCertificatePdf', () => {
  it('produces a one-page PDF containing the data', async () => {
    const bytes = await buildCertificatePdf({
      studentName: 'Ahmad Fauzi',
      studentNpm: '20241001',
      courseName: 'Matematika Diskrit',
      courseCode: 'MK102',
      issuedAt: '2026-11-12T08:00:00Z',
      verificationCode: 'LMS-ABCD-EFGH-JKLM',
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')

    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('Sertifikat Matematika Diskrit')
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
    expect(w).toBeGreaterThan(h) // landscape
  })

  it('does not throw on names outside WinAnsi', async () => {
    await expect(
      buildCertificatePdf({ studentName: '王小明 Ahmad', courseName: 'X', courseCode: 'MK1', issuedAt: '2026-01-01', verificationCode: 'LMS-AAAA-BBBB-CCCC' }),
    ).resolves.toBeInstanceOf(Uint8Array)
  })
})
