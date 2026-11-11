/**
 * Gradebook Store — Unit Tests
 *
 * Covers the pure grade math (weights, components, final score) and the
 * store in demo mode (weights, UTS/UAS input, student view).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  useGradebookStore,
  DEFAULT_WEIGHTS,
  weightsTotal,
  validateWeights,
  computeFinalScore,
  assignmentComponent,
  quizComponent,
  attendanceComponent,
  type ComponentScores,
} from '~/stores/gradebook'
import { useAuthStore } from '~/stores/auth'
import type { Assignment, Submission, Quiz, QuizAttempt, Attendance } from '~/types/database'

const NOW = new Date('2026-01-01T00:00:00Z').getTime()

function assignment(id: string, deadline: string | null): Assignment {
  return { id, course_id: 'c1', instructor_id: 'i1', judul: id, tenggat_waktu: deadline, created_at: '', updated_at: '' }
}

function submission(assignmentId: string, studentId: string, nilai?: number | null): Submission {
  return { id: `${assignmentId}-${studentId}`, assignment_id: assignmentId, student_id: studentId, submitted_at: '', nilai }
}

describe('weights', () => {
  it('default weights total 100', () => {
    expect(weightsTotal(DEFAULT_WEIGHTS)).toBe(100)
    expect(validateWeights(DEFAULT_WEIGHTS)).toBeNull()
  })

  it('rejects totals other than 100', () => {
    expect(validateWeights({ tugas: 30, kuis: 20, presensi: 10, uts: 20, uas: 30 })).toContain('110')
    expect(validateWeights({ tugas: 10, kuis: 10, presensi: 10, uts: 10, uas: 10 })).toContain('50')
  })

  it('rejects negative, fractional and out-of-range weights', () => {
    expect(validateWeights({ tugas: -10, kuis: 40, presensi: 10, uts: 30, uas: 30 })).toContain('Tugas')
    expect(validateWeights({ tugas: 25.5, kuis: 14.5, presensi: 10, uts: 20, uas: 30 })).toContain('Tugas')
    expect(validateWeights({ tugas: 0, kuis: 0, presensi: 0, uts: 0, uas: 101 })).toContain('UAS')
  })

  it('allows a component to be switched off with weight 0', () => {
    expect(validateWeights({ tugas: 40, kuis: 0, presensi: 0, uts: 30, uas: 30 })).toBeNull()
  })
})

describe('computeFinalScore', () => {
  const w = { tugas: 30, kuis: 20, presensi: 10, uts: 20, uas: 20 }

  it('computes the weighted average when every component has data', () => {
    const scores: ComponentScores = { tugas: 80, kuis: 70, presensi: 100, uts: 60, uas: 90 }
    // 24 + 14 + 10 + 12 + 18 = 78
    expect(computeFinalScore(scores, w)).toEqual({ final: 78, coveredWeight: 100, isProvisional: false })
  })

  it('re-normalises over components that have data and flags the grade provisional', () => {
    const scores: ComponentScores = { tugas: 80, kuis: null, presensi: 100, uts: null, uas: null }
    // (80*30 + 100*10) / 40 = 85
    expect(computeFinalScore(scores, w)).toEqual({ final: 85, coveredWeight: 40, isProvisional: true })
  })

  it('returns null when nothing has data', () => {
    const scores: ComponentScores = { tugas: null, kuis: null, presensi: null, uts: null, uas: null }
    expect(computeFinalScore(scores, w)).toEqual({ final: null, coveredWeight: 0, isProvisional: true })
  })

  it('ignores zero-weight components entirely', () => {
    const scores: ComponentScores = { tugas: 90, kuis: 10, presensi: null, uts: 70, uas: 80 }
    const off = { tugas: 40, kuis: 0, presensi: 0, uts: 30, uas: 30 }
    // 36 + 21 + 24 = 81 — kuis (10) must not count; missing presensi must not make it provisional
    expect(computeFinalScore(scores, off)).toEqual({ final: 81, coveredWeight: 100, isProvisional: false })
  })

  it('treats a real score of 0 as data, not as missing', () => {
    const scores: ComponentScores = { tugas: 0, kuis: null, presensi: null, uts: 100, uas: null }
    // (0*30 + 100*20) / 50 = 40
    expect(computeFinalScore(scores, w).final).toBe(40)
  })

  it('rounds to one decimal', () => {
    const scores: ComponentScores = { tugas: 77, kuis: 68, presensi: null, uts: null, uas: null }
    // (77*30 + 68*20) / 50 = 73.4
    expect(computeFinalScore(scores, w).final).toBe(73.4)
  })
})

describe('components', () => {
  it('tugas: graded counts, missing past deadline is 0, ungraded and not-yet-due are skipped', () => {
    const assignments = [
      assignment('graded', '2025-06-01T00:00:00Z'),
      assignment('missing', '2025-06-01T00:00:00Z'),
      assignment('pending', '2025-06-01T00:00:00Z'),
      assignment('future', '2026-06-01T00:00:00Z'),
      assignment('no-deadline', null),
    ]
    const subs = [submission('graded', 's1', 90), submission('pending', 's1', null)]
    // (90 + 0) / 2
    expect(assignmentComponent(assignments, subs, 's1', NOW)).toBe(45)
  })

  it('tugas: null when there is nothing to count yet', () => {
    expect(assignmentComponent([assignment('future', '2026-06-01T00:00:00Z')], [], 's1', NOW)).toBeNull()
    expect(assignmentComponent([], [], 's1', NOW)).toBeNull()
  })

  it('tugas: does not count other students\' submissions', () => {
    const assignments = [assignment('a', '2026-06-01T00:00:00Z')]
    expect(assignmentComponent(assignments, [submission('a', 's2', 100)], 's1', NOW)).toBeNull()
  })

  it('kuis: uses the best attempt per quiz and skips unattempted quizzes', () => {
    const quizzes = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] as Quiz[]
    const attempts = [
      { quiz_id: 'q1', student_id: 's1', percentage: 40 },
      { quiz_id: 'q1', student_id: 's1', percentage: 80 },
      { quiz_id: 'q2', student_id: 's1', percentage: 60 },
      { quiz_id: 'q3', student_id: 's2', percentage: 100 },
    ] as QuizAttempt[]
    expect(quizComponent(quizzes, attempts, 's1')).toBe(70)
    expect(quizComponent(quizzes, attempts, 's9')).toBeNull()
  })

  it('presensi: percentage of meetings attended', () => {
    const records = [
      { student_id: 's1', status: 'hadir' },
      { student_id: 's1', status: 'hadir' },
      { student_id: 's1', status: 'sakit' },
      { student_id: 's2', status: 'alpha' },
    ] as Attendance[]
    expect(attendanceComponent(records, 's1')).toBe(67)
    expect(attendanceComponent(records, 's2')).toBe(0)
    expect(attendanceComponent(records, 's3')).toBeNull()
  })
})

describe('gradebook store (demo mode)', () => {
  beforeEach(async () => {
    await useGradebookStore().init()
  })

  it('uses saved weights for c1 and defaults elsewhere', () => {
    const store = useGradebookStore()
    expect(store.hasCustomWeights('c1')).toBe(true)
    expect(weightsTotal(store.weightsFor('c1'))).toBe(100)
    expect(store.hasCustomWeights('c2')).toBe(false)
    expect(store.weightsFor('c2')).toEqual(DEFAULT_WEIGHTS)
  })

  it('builds one row per enrolled student, sorted by name', () => {
    const rows = useGradebookStore().courseGradebook('c1')
    expect(rows.map((r) => r.student_id)).toEqual(['s1', 's2', 's3'])
    expect(rows.every((r) => r.npm.length > 0)).toBe(true)
  })

  it('returns no rows for an unknown course', () => {
    expect(useGradebookStore().courseGradebook('nope')).toEqual([])
  })

  it('combines assignments, attendance and UTS into a provisional final grade', () => {
    const s1 = useGradebookStore().courseGradebook('c1').find((r) => r.student_id === 's1')!
    expect(s1.uts).toBe(85)
    expect(s1.uas).toBeNull()
    expect(s1.presensi).toBe(67) // hadir, hadir, sakit
    expect(s1.final).not.toBeNull()
    expect(s1.isProvisional).toBe(true)
    expect(s1.letter).not.toBeNull()

    // The final must equal the weighted mean of the components that have data.
    const w = useGradebookStore().weightsFor('c1')
    const expected = computeFinalScore(
      { tugas: s1.tugas, kuis: s1.kuis, presensi: s1.presensi, uts: s1.uts, uas: s1.uas }, w
    )
    expect(s1.final).toBe(expected.final)
    expect(s1.coveredWeight).toBe(expected.coveredWeight)
  })

  it('saves valid weights and rejects invalid ones', async () => {
    const store = useGradebookStore()
    expect(await store.saveWeights('c2', { tugas: 50, kuis: 50, presensi: 50, uts: 0, uas: 0 })).toBe(false)
    expect(store.error).toContain('150')
    expect(store.hasCustomWeights('c2')).toBe(false)

    expect(await store.saveWeights('c2', { tugas: 40, kuis: 10, presensi: 10, uts: 20, uas: 20 })).toBe(true)
    expect(store.weightsFor('c2').tugas).toBe(40)
  })

  it('sets, updates and clears an exam score, and the final grade follows', async () => {
    const store = useGradebookStore()
    const before = store.courseGradebook('c1').find((r) => r.student_id === 's3')!

    expect(await store.setExamScore('c1', 's3', 'uas', 100)).toBe(true)
    let row = store.courseGradebook('c1').find((r) => r.student_id === 's3')!
    expect(row.uas).toBe(100)
    expect(row.final).toBeGreaterThan(before.final!)

    expect(await store.setExamScore('c1', 's3', 'uas', 50)).toBe(true)
    row = store.courseGradebook('c1').find((r) => r.student_id === 's3')!
    expect(row.uas).toBe(50)
    expect(store.examScores.filter((e) => e.student_id === 's3' && e.tipe === 'uas')).toHaveLength(1)

    expect(await store.setExamScore('c1', 's3', 'uas', null)).toBe(true)
    row = store.courseGradebook('c1').find((r) => r.student_id === 's3')!
    expect(row.uas).toBeNull()
    expect(row.final).toBe(before.final)
  })

  it('rejects out-of-range exam scores', async () => {
    const store = useGradebookStore()
    expect(await store.setExamScore('c1', 's1', 'uts', 101)).toBe(false)
    expect(await store.setExamScore('c1', 's1', 'uts', -1)).toBe(false)
    expect(await store.setExamScore('c1', 's1', 'uts', 80.5)).toBe(false)
    expect(store.courseGradebook('c1').find((r) => r.student_id === 's1')!.uts).toBe(85)
  })

  it('myGrades lists the signed-in student\'s courses with their own row only', async () => {
    const auth = useAuthStore()
    await auth.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')
    const grades = useGradebookStore().myGrades
    expect(grades.map((g) => g.course_id)).toEqual(['c1', 'c2'])
    expect(grades.every((g) => g.student_id === 's1')).toBe(true)
    expect(grades[0].course_kode).toBe('MK101')
  })

  it('myGrades is empty for instructors', async () => {
    const auth = useAuthStore()
    await auth.loginAsInstructor('Dr. Andi Wijaya', 'instruktur123')
    expect(useGradebookStore().myGrades).toEqual([])
  })
})
