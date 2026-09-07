/**
 * Analytics Store — Unit Tests
 *
 * Tests the pure score helpers and course analytics aggregation
 * in demo mode.
 */
import { describe, it, expect } from 'vitest'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'
import { useAssignmentsStore } from '~/stores/assignments'
import { useQuizStore } from '~/stores/quiz'
import { useAttendanceStore } from '~/stores/attendance'
import {
  clamp100,
  average,
  scoreToGrade,
  computeOverallScore,
  computeCourseStats,
  buildCourseAnalytics,
  AT_RISK_THRESHOLD,
} from '~/stores/analytics'

/** Initialize every store that feeds analytics (demo mode). */
async function initAllStores(): Promise<void> {
  await useAuthStore().init()
  await useCoursesStore().init()
  await useAssignmentsStore().init()
  await useQuizStore().init()
  await useAttendanceStore().init()
}

describe('analytics pure helpers', () => {
  describe('clamp100', () => {
    it('clamps values to the [0, 100] range', () => {
      expect(clamp100(50)).toBe(50)
      expect(clamp100(120)).toBe(100)
      expect(clamp100(-10)).toBe(0)
      expect(clamp100(99.9)).toBeCloseTo(99.9)
    })

    it('treats non-finite values as 0', () => {
      expect(clamp100(NaN)).toBe(0)
      expect(clamp100(Infinity)).toBe(0)
      expect(clamp100(-Infinity)).toBe(0)
    })
  })

  describe('average', () => {
    it('returns null for an empty list', () => {
      expect(average([])).toBeNull()
    })

    it('averages the given numbers', () => {
      expect(average([90, 80, 70])).toBe(80)
      expect(average([100])).toBe(100)
      expect(average([10, 20])).toBeCloseTo(15)
    })
  })

  describe('scoreToGrade', () => {
    it('returns null for a null score', () => {
      expect(scoreToGrade(null)).toBeNull()
    })

    it('maps scores to A/B/C/D/E bands', () => {
      expect(scoreToGrade(85)).toBe('A')
      expect(scoreToGrade(99)).toBe('A')
      expect(scoreToGrade(84)).toBe('B')
      expect(scoreToGrade(70)).toBe('B')
      expect(scoreToGrade(69)).toBe('C')
      expect(scoreToGrade(60)).toBe('C')
      expect(scoreToGrade(59)).toBe('D')
      expect(scoreToGrade(50)).toBe('D')
      expect(scoreToGrade(49)).toBe('E')
      expect(scoreToGrade(0)).toBe('E')
    })
  })

  describe('computeOverallScore', () => {
    it('computes the 40/30/30 weighted composite', () => {
      // 90 (0.4) + 80 (0.3) + 70 (0.3) = 36 + 24 + 21 = 81
      expect(computeOverallScore(90, 80, 70)).toBeCloseTo(81)
    })

    it('redistributes weight when a component is missing', () => {
      // Only assignments: score equals assignment average
      expect(computeOverallScore(75, null, null)).toBeCloseTo(75)
      // Only assignments + attendance, quiz missing:
      // (75*0.4 + 50*0.3) / 0.7 = (30 + 15) / 0.7 = 64.29
      expect(computeOverallScore(75, null, 50)).toBeCloseTo(64.29, 2)
    })

    it('returns null when there is no data', () => {
      expect(computeOverallScore(null, null, null)).toBeNull()
    })
  })
})

describe('computeCourseStats', () => {
  const base = {
    student_id: 'x',
    nama: 'X',
    npm: null,
    kelas: null,
    assignmentDone: 0,
    assignmentTotal: 1,
    assignmentAvg: null,
    quizAttempts: 0,
    quizTotal: 1,
    quizAvg: null,
    attendanceRate: null,
    hadirCount: 0,
    totalMeetings: 1,
    lessonProgress: 0,
    lessonCompleted: 0,
    lessonTotal: 1,
    overallScore: null,
    overallGrade: null,
    atRisk: false,
  }

  it('aggregates class averages and counts at-risk students', () => {
    const stats = computeCourseStats([
      {
        ...base,
        student_id: 's1',
        nama: 'Satu',
        assignmentAvg: 90,
        quizAvg: 80,
        attendanceRate: 100,
        lessonProgress: 0.5,
        overallScore: 90,
        overallGrade: 'A' as const,
        atRisk: false,
      },
      {
        ...base,
        student_id: 's2',
        nama: 'Dua',
        assignmentAvg: 50,
        quizAvg: 40,
        attendanceRate: 50,
        lessonProgress: 0,
        overallScore: 45,
        overallGrade: 'E' as const,
        atRisk: true,
      },
    ] as any)

    expect(stats.studentCount).toBe(2)
    expect(stats.classAssignmentAvg).toBe(70)
    expect(stats.classQuizAvg).toBe(60)
    expect(stats.classAttendanceRate).toBe(75)
    expect(stats.classCompletionRate).toBe(25)
    expect(stats.atRiskCount).toBe(1)
  })
})

describe('buildCourseAnalytics (demo mode, course c1)', () => {
  it('aggregates student performance for course c1', async () => {
    await initAllStores()

    const result = buildCourseAnalytics('c1', {
      auth: useAuthStore(),
      courses: useCoursesStore(),
      assignments: useAssignmentsStore(),
      quiz: useQuizStore(),
      attendance: useAttendanceStore(),
    })

    // Course c1 = level 1 morning → s1, s2, s3 enrolled
    expect(result.students).toHaveLength(3)
    expect(result.stats.studentCount).toBe(3)

    const s1 = result.students.find((s) => s.student_id === 's1')!
    // Assignments: a1 (graded 90), a2 (ungraded) → avg 90
    expect(s1.assignmentDone).toBe(1)
    expect(s1.assignmentTotal).toBe(2)
    expect(s1.assignmentAvg).toBe(90)

    // Quizzes for c1: qz1 (80%), qz2 (100%) → avg 90
    expect(s1.quizAttempts).toBe(2)
    expect(s1.quizAvg).toBe(90)

    // Attendance: 2 hadir / 3 records → 67
    expect(s1.attendanceRate).toBe(67)
    expect(s1.totalMeetings).toBe(3)

    // Lessons: 2 completed / 4 total → 0.5
    expect(s1.lessonCompleted).toBe(2)
    expect(s1.lessonTotal).toBe(4)
    expect(s1.lessonProgress).toBeCloseTo(0.5)

    // Composite: (90*0.4 + 90*0.3 + 67*0.3) = 36 + 27 + 20.1 = 83.1
    expect(s1.overallScore).toBeCloseTo(83.1)
    expect(s1.overallGrade).toBe('B')
    expect(s1.atRisk).toBe(false)

    // s2: one graded? s2 has an ungraded submission only → assignmentAvg null
    const s2 = result.students.find((s) => s.student_id === 's2')!
    expect(s2.assignmentAvg).toBeNull()
    // s2 quiz: qz2 67% → 67
    expect(s2.quizAvg).toBe(67)
    expect(s2.lessonProgress).toBeCloseTo(0.25)

    // s3: no submissions/quizzes → both null, attendance 67
    const s3 = result.students.find((s) => s.student_id === 's3')!
    expect(s3.assignmentAvg).toBeNull()
    expect(s3.quizAvg).toBeNull()
    expect(s3.attendanceRate).toBe(67)
  })

  it('flags at-risk students when overall score is below threshold', async () => {
    await initAllStores()

    const auth = useAuthStore()
    const course = useCoursesStore()
    const c1 = course.courses.find((c) => c.id === 'c1')!

    // Give s3 a failing assignment grade so their composite drops below 60.
    const assignments = useAssignmentsStore()
    const failingSub = assignments.submissions.find(
      (s) => s.assignment_id === 'a2' && s.student_id === 's3'
    )
    if (!failingSub) {
      assignments.submissions.push({
        id: 'sub-fail',
        assignment_id: 'a2',
        student_id: 's3',
        jawaban: 'late',
        submitted_at: '2025-08-21T10:00:00Z',
        nilai: 20,
      })
    } else {
      failingSub.nilai = 20
    }

    const result = buildCourseAnalytics('c1', {
      auth,
      courses: course,
      assignments,
      quiz: useQuizStore(),
      attendance: useAttendanceStore(),
    })

    const s3 = result.students.find((s) => s.student_id === 's3')!
    // assignment 20, quiz null, attendance 67 →
    // (20*0.4 + 67*0.3) / 0.7 = (8 + 20.1) / 0.7 = 40.14
    expect(s3.overallScore!).toBeLessThan(AT_RISK_THRESHOLD)
    expect(s3.atRisk).toBe(true)

    const atRisk = result.students.filter((s) => s.atRisk)
    expect(atRisk.map((s) => s.student_id)).toContain('s3')
  })

  it('applies the at-risk flag only when a score exists', async () => {
    await initAllStores()

    const result = buildCourseAnalytics('c1', {
      auth: useAuthStore(),
      courses: useCoursesStore(),
      assignments: useAssignmentsStore(),
      quiz: useQuizStore(),
      attendance: useAttendanceStore(),
    })

    // No student with zero data should be flagged as at-risk.
    for (const s of result.students) {
      if (s.overallScore === null) {
        expect(s.atRisk).toBe(false)
      }
    }
  })

  it('returns empty analytics for an unknown course', async () => {
    await initAllStores()

    const result = buildCourseAnalytics('c999', {
      auth: useAuthStore(),
      courses: useCoursesStore(),
      assignments: useAssignmentsStore(),
      quiz: useQuizStore(),
      attendance: useAttendanceStore(),
    })

    expect(result.students).toEqual([])
    expect(result.stats.studentCount).toBe(0)
    expect(result.stats.atRiskCount).toBe(0)
  })
})