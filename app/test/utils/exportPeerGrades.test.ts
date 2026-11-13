/**
 * Gradebook export with peer review (Prioritas 3b-B).
 *
 * Proves that the numbers in the grade export (table → CSV / XLSX) are the
 * same numbers the gradebook shows, for: no peer review, incomplete peer
 * review, and complete peer review. The export is built exactly like
 * ImportExportPanel does: gradebookTable(courseGradebook, weightsFor, name,
 * coursePeerBreakdown).
 *
 * Demo data is module-level and shared between the tests in this file, so they
 * run in order and build on each other.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import { useRubricsStore } from '~/stores/rubrics'
import { useAssignmentsStore } from '~/stores/assignments'
import { useAuthStore } from '~/stores/auth'
import { useGradebookStore, assignmentScore } from '~/stores/gradebook'
import { buildCsv, buildXlsx, gradebookTable, peerColumnHeaders, type ExportTable } from '~/utils/exportFiles'
import { UTF8_BOM, parseCsvText } from '~/utils/csvTools'

const COURSE = 'c1'
const A1 = 'Tugas 1: Hello World' // a1 — gets peer review
const A2 = 'Tugas 2: Kalkulator Sederhana' // a2 — never has peer review

async function loginInstructor() {
  expect(await useAuthStore().loginAsInstructor('Dr. Andi Wijaya', 'instruktur123')).toBe(true)
}
async function loginStudent(nama: string, npm: string) {
  expect(await useAuthStore().loginAsStudent(nama, npm, 'mahasiswa123')).toBe(true)
}

/** Export table built the same way as ImportExportPanel.gradeTable(). */
function exportTable(): ExportTable {
  const gb = useGradebookStore()
  return gradebookTable(gb.courseGradebook(COURSE), gb.weightsFor(COURSE), 'Nilai MK101', gb.coursePeerBreakdown(COURSE))
}

function col(t: ExportTable, header: string): number {
  const i = t.headers.indexOf(header)
  expect(i, `header "${header}"`).toBeGreaterThanOrEqual(0)
  return i
}

const num = (v: unknown) => (v === '-' ? null : v)

/**
 * The core check: every number in the export equals the gradebook on screen
 * (Tugas, final, letter) and the per-assignment final equals
 * rubrics.finalScoreFor (the function the assignment pages use). Tugas is also
 * recomputed from the exported per-assignment finals.
 */
function expectExportMatchesGradebook(t: ExportTable) {
  const gb = useGradebookStore()
  const rubrics = useRubricsStore()
  const assignments = useAssignmentsStore()
  const rows = gb.courseGradebook(COURSE)
  const w = gb.weightsFor(COURSE)
  expect(t.rows).toHaveLength(rows.length)

  const iTugas = col(t, `Tugas (${w.tugas}%)`)
  const iFinal = col(t, 'Nilai Akhir')
  const iHuruf = col(t, 'Huruf')
  const peer = gb.coursePeerBreakdown(COURSE)
  const courseAssignments = assignments.assignments.filter((a) => a.course_id === COURSE)

  rows.forEach((r, idx) => {
    const cells = t.rows[idx]!
    expect(cells[1]).toBe(r.npm)
    expect(num(cells[iTugas])).toBe(r.tugas)
    expect(num(cells[iFinal])).toBe(r.final)
    expect(cells[iHuruf]).toBe(r.letter ?? '-')

    // Per-assignment final: peer columns for peer assignments, assignmentScore otherwise.
    const perAssignment: number[] = []
    for (const a of courseAssignments) {
      const sub = assignments.submissions.find((s) => s.assignment_id === a.id && s.student_id === r.student_id)
      const expected = assignmentScore(a, sub ? { nilai: rubrics.finalScoreFor(sub) } : undefined)
      if (peer.assignments.some((p) => p.id === a.id)) {
        const [hDosen, , , , hFinal] = peerColumnHeaders(a.judul)
        expect(num(cells[col(t, hFinal!)])).toBe(expected)
        expect(num(cells[col(t, hDosen!)])).toBe(typeof sub?.nilai === 'number' ? sub.nilai : null)
        const v = num(cells[col(t, hFinal!)])
        if (typeof v === 'number') perAssignment.push(v)
      } else if (expected !== null) {
        perAssignment.push(expected)
      }
    }
    const mean = perAssignment.length ? Math.round((perAssignment.reduce((s, x) => s + x, 0) / perAssignment.length) * 10) / 10 : null
    expect(mean).toBe(r.tugas)
  })
}

/** Parse the CSV and XLSX bytes back and check they carry the same cells as the table. */
function expectFilesMatchTable(t: ExportTable) {
  const csv = buildCsv(t)
  expect(csv.startsWith(UTF8_BOM)).toBe(true)
  const parsed = parseCsvText(csv)
  expect(parsed.headers).toEqual(t.headers)
  t.rows.forEach((r, i) => expect(parsed.rows[i]!.cells).toEqual(r.map((c) => String(c ?? ''))))

  const wb = XLSX.read(buildXlsx([t]), { type: 'array' })
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, defval: '' })
  expect(aoa[0]).toEqual(t.headers)
  t.rows.forEach((r, i) => expect(aoa[i + 1]).toEqual(r.map((c) => c ?? '')))
}

function rowOf(t: ExportTable, npm: string) {
  const r = t.rows.find((x) => x[1] === npm)!
  return (header: string) => r[col(t, header)]
}

describe('grade export with peer review == gradebook', () => {
  beforeEach(async () => {
    await useGradebookStore().init()
  })

  it('without peer review: layout unchanged, numbers equal the gradebook', async () => {
    await loginInstructor()
    const gb = useGradebookStore()
    expect(gb.coursePeerBreakdown(COURSE).assignments).toEqual([])
    const t = exportTable()
    // Same columns as before 3b-B.
    expect(t.headers).toEqual([
      'No', 'NPM', 'Nama Mahasiswa', 'Tugas (30%)', 'Kuis (20%)', 'Presensi (10%)', 'UTS (20%)', 'UAS (20%)',
      'Nilai Akhir', 'Huruf', 'Status',
    ])
    expect(t).toEqual(gradebookTable(gb.courseGradebook(COURSE), gb.weightsFor(COURSE), 'Nilai MK101'))
    expectExportMatchesGradebook(t)
    expectFilesMatchTable(t)
  })

  it('incomplete peer review: peer columns appear, uncounted reviews keep the instructor score', async () => {
    const assignments = useAssignmentsStore()
    const rubrics = useRubricsStore()
    // Third submitter for a1 (s3), then grade sub2 and s3's work.
    await loginStudent('Citra Dewi', '20241003')
    await assignments.submitAssignment('a1', 'print("Halo Dunia")')
    await loginInstructor()
    const sub3a1 = assignments.submissions.find((s) => s.assignment_id === 'a1' && s.student_id === 's3')!
    await assignments.gradeSubmission('sub2', 72, 'ok')
    await assignments.gradeSubmission(sub3a1.id, 60, 'ok')

    expect(await rubrics.savePeerConfig('a1', { enabled: true, reviewers_per_submission: 2, deadline: '2099-01-01T00:00:00Z', weight: 20 })).toBe(true)
    expect(await rubrics.assignPeerReviews('a1')).toMatchObject({ created: 6, effectiveK: 2 })

    // Only Ahmad (s1) submits his two reviews, top level everywhere → 100 each.
    await loginStudent('Ahmad Fauzi', '20241001')
    const criteria = rubrics.rubricFor('a1')!.criteria
    const top = Object.fromEntries(criteria.map((c) => [c.id, c.levels[0]!.id]))
    for (const task of rubrics.myReviewTasks('a1')) {
      expect(await rubrics.submitPeerReview(task.id, top, 'Programnya benar dan rapi.')).toBe(true)
    }
    await loginInstructor()

    const t = exportTable()
    expect(t.headers).toEqual([
      'No', 'NPM', 'Nama Mahasiswa', 'Tugas (30%)', 'Kuis (20%)', 'Presensi (10%)', 'UTS (20%)', 'UAS (20%)',
      ...peerColumnHeaders(A1),
      'Nilai Akhir', 'Huruf', 'Status',
    ])
    expect(t.headers.some((h) => h.startsWith(A2))).toBe(false) // a2 has no peer review → no extra columns

    const [hDosen, hPeer, hCount, hBobot, hFinal] = peerColumnHeaders(A1) as [string, string, string, string, string]
    const s1 = rowOf(t, '20241001')
    expect([s1(hDosen), s1(hPeer), s1(hCount), s1(hBobot), s1(hFinal)]).toEqual([90, '-', '0 dari 2', 20, 90])
    const s2 = rowOf(t, '20241002')
    expect([s2(hDosen), s2(hPeer), s2(hCount), s2(hBobot), s2(hFinal)]).toEqual([72, 100, '1 dari 2', 20, 78]) // 57.6 + 20
    const s3 = rowOf(t, '20241003')
    expect([s3(hDosen), s3(hPeer), s3(hCount), s3(hBobot), s3(hFinal)]).toEqual([60, 100, '1 dari 2', 20, 68]) // 48 + 20
    // Tugas: s2 → (78 + 0 for a2 missed) / 2 = 39; s3 → (68 + 0) / 2 = 34.
    expect(s2('Tugas (30%)')).toBe(39)
    expect(s3('Tugas (30%)')).toBe(34)

    expectExportMatchesGradebook(t)
    expectFilesMatchTable(t)
  })

  it('complete peer review (with an instructor override): numbers still equal the gradebook', async () => {
    const rubrics = useRubricsStore()
    const criteria = rubrics.rubricFor('a1')!.criteria
    const mid = Object.fromEntries(criteria.map((c) => [c.id, c.levels[1]!.id]))
    for (const [nama, npm] of [['Budi Santoso', '20241002'], ['Citra Dewi', '20241003']] as const) {
      await loginStudent(nama, npm)
      for (const task of rubrics.myReviewTasks('a1')) {
        expect(await rubrics.submitPeerReview(task.id, mid, 'Sudah cukup baik, rapikan lagi.')).toBe(true)
      }
    }
    await loginInstructor()
    // Override one review of sub2 so the average is not just the rubric score.
    const r = rubrics.reviewsForSubmission('sub2').find((x) => x.reviewer_id !== 's1')!
    expect(await rubrics.overridePeerReview(r.id, { override_skor: 40 })).toBe(true)

    const t = exportTable()
    const [hDosen, hPeer, hCount, , hFinal] = peerColumnHeaders(A1) as [string, string, string, string, string]
    for (const npm of ['20241001', '20241002', '20241003']) expect(rowOf(t, npm)(hCount)).toBe('2 dari 2')

    const s2 = rowOf(t, '20241002')
    const avg2 = rubrics.peerSummaryFor('sub2')!.average!
    expect(avg2).toBe(70) // (100 + 40) / 2
    expect([s2(hDosen), s2(hPeer), s2(hFinal)]).toEqual([72, 70, 72]) // 57.6 + 14 = 71.6 → 72

    expectExportMatchesGradebook(t)
    expectFilesMatchTable(t)
  })

  it('peer columns keep CSV injection guard and plain-string XLSX cells for the assignment title', () => {
    const peer = {
      assignments: [{ id: 'ax', judul: '=HYPERLINK("http://x")', weight: 25 }],
      cells: { s1: { ax: { instructor: 80, peerAverage: 60, peerCounted: 1, peerAssigned: 2, weight: 25, final: 75 } } },
    }
    const rows = [
      { student_id: 's1', nama: 'Ahmad', npm: '1', tugas: 75, kuis: null, presensi: null, uts: null, uas: null, final: 75, letter: 'B', isProvisional: true },
      { student_id: 's9', nama: '@evil', npm: '2', tugas: null, kuis: null, presensi: null, uts: null, uas: null, final: null, letter: null, isProvisional: true },
    ]
    const t = gradebookTable(rows, { tugas: 30, kuis: 20, presensi: 10, uts: 20, uas: 20 }, 'X', peer)
    expect(t.rows[0]!.slice(8, 13)).toEqual([80, 60, '1 dari 2', 25, 75])
    expect(t.rows[1]!.slice(8, 13)).toEqual(['-', '-', '-', 25, '-']) // no cell for that student

    const csv = buildCsv(t)
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    const parsed = parseCsvText(csv)
    expect(parsed.headers[8]).toBe(`'=HYPERLINK("http://x") - Nilai Dosen`)
    expect(parsed.rows[1]!.cells[2]).toBe("'@evil")

    const ws = XLSX.read(buildXlsx([t]), { type: 'array' }).Sheets['X']!
    expect(ws.I1.t).toBe('s')
    expect(ws.I1.f).toBeUndefined()
    expect(ws.I2.t).toBe('n')
  })
})
