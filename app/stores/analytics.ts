/**
 * Analytics Store — Aggregates per-student performance data for a course.
 *
 * Computes weighted overall scores from:
 *  - Assignments (40%)
 *  - Quizzes (30%)
 *  - Attendance (30%)
 * and reports lesson-completion progress separately.
 *
 * The math lives in pure, exported functions so it is unit-testable without
 * Pinia. The store read data from the existing auth/courses/assignments/quiz/
 * attendance stores so it stays in sync between demo and Supabase modes.
 */
import { defineStore } from 'pinia'
import type {
  StudentAnalytics,
  CourseAnalytics,
  CourseAnalyticsStats,
  OverallGrade,
} from '~/types/analytics'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useAssignmentsStore } from './assignments'
import { useQuizStore } from './quiz'
import { useAttendanceStore } from './attendance'

// ── Config ───────────────────────────────────────────────
/** Weights for the composite overall score: assignments / quiz / attendance. */
export const WEIGHTS = {
  assignments: 0.4,
  quiz: 0.3,
  attendance: 0.3,
} as const

/** Overall score below which a student is flagged at-risk. */
export const AT_RISK_THRESHOLD = 60

// ── Pure helpers (unit-testable) ─────────────────────────

/** Clamp a number to [0, 100]; non-finite values become 0. */
export function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Average of numbers; null for an empty list. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return clamp100(values.reduce((a, b) => a + b, 0) / values.length)
}

/** Map a score (0-100) to an Indonesian-universities-style letter grade. */
export function scoreToGrade(score: number | null): OverallGrade | null {
  if (score === null) return null
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'E'
}

/**
 * Compute the weighted composite score (0-100) from the three components.
 * Missing components are omitted (weight redistributed implicitly by dividing
 * by the used weight). Returns null when there is no data at all.
 */
export function computeOverallScore(
  assignmentAvg: number | null,
  quizAvg: number | null,
  attendanceRate: number | null
): number | null {
  let sum = 0
  let weight = 0

  if (assignmentAvg !== null) {
    sum += assignmentAvg * WEIGHTS.assignments
    weight += WEIGHTS.assignments
  }
  if (quizAvg !== null) {
    sum += quizAvg * WEIGHTS.quiz
    weight += WEIGHTS.quiz
  }
  if (attendanceRate !== null) {
    sum += attendanceRate * WEIGHTS.attendance
    weight += WEIGHTS.attendance
  }

  if (weight === 0) return null
  return clamp100((sum / weight))
}

// ── Store ────────────────────────────────────────────────

export const useAnalyticsStore = defineStore('analytics', {
  state: () => ({
    initialized: false,
  }),

  getters: {
    /** Aggregate per-student analytics for a course. */
    courseAnalytics(): (courseId: string) => CourseAnalytics {
      return (courseId: string): CourseAnalytics => {
        const auth = useAuthStore()
        const courses = useCoursesStore()
        const assignments = useAssignmentsStore()
        const quiz = useQuizStore()
        const attendance = useAttendanceStore()
        return buildCourseAnalytics(courseId, { auth, courses, assignments, quiz, attendance })
      }
    },

    /** Students flagged at-risk (overallScore < AT_RISK_THRESHOLD). */
    atRiskStudents(): (courseId: string) => StudentAnalytics[] {
      return (courseId: string) =>
        this.courseAnalytics(courseId).students.filter((s) => s.atRisk)
    },
  },

  actions: {
    /** Placeholder — analytics is computed live from dependency stores. */
    async init() {
      this.initialized = true
    },
  },
})

// ── Pure computation (exported for tests) ────────────────

interface AnalyticsSource {
  auth: ReturnType<typeof useAuthStore>
  courses: ReturnType<typeof useCoursesStore>
  assignments: ReturnType<typeof useAssignmentsStore>
  quiz: ReturnType<typeof useQuizStore>
  attendance: ReturnType<typeof useAttendanceStore>
}

/**
 * Build the full course analytics from store sources. Kept pure (takes plain
 * stores) so it can be unit-tested by passing a mocked source object.
 */
export function buildCourseAnalytics(
  courseId: string,
  src: AnalyticsSource
): CourseAnalytics {
  const { auth, courses, assignments, quiz, attendance } = src

  // Which data arrays are active, based on each store's demo/sb mode.
  const courseAssignments = (assignments.isDemoMode ? assignments.assignments : assignments.sbAssignments)
    .filter((a) => a.course_id === courseId)
  const courseSubmissions = (assignments.isDemoMode ? assignments.submissions : assignments.sbSubmissions)
    .filter((s) => courseAssignments.some((a) => a.id === s.assignment_id))
  const courseQuizzes = (quiz.isDemoMode ? quiz.quizzes : quiz.sbQuizzes)
    .filter((q) => q.course_id === courseId)
  const courseAttempts = (quiz.isDemoMode ? quiz.attempts : quiz.sbAttempts)
    .filter((a) => courseQuizzes.some((q) => q.id === a.quiz_id))
  const courseAttendance = (attendance.isDemoMode ? attendance.records : attendance.sbRecords)
    .filter((r) => r.course_id === courseId)

  const totalMeetings = new Set(courseAttendance.map((r) => r.pertemuan)).size

  // Course definition (demo or sb)
  const course = (courses.isDemoMode ? courses.courses : courses.sbCourses)
    .find((c) => c.id === courseId)
  if (!course) {
    return { courseId, students: [], stats: emptyStats() }
  }

  // Enrolled students: same reverse-lookup the instructor course page uses.
  const enrolled = auth.studentRoster.filter(
    (s) => s.level === course.level && s.session_time === course.session_time
  )

  const students: StudentAnalytics[] = enrolled.map((s) => {
    // Assignment performance: use graded submissions (nilai is a number).
    const subs = courseSubmissions.filter((x) => x.student_id === s.id)
    const graded = subs.filter((x) => typeof x.nilai === 'number')
    const assignmentAvg = average(graded.map((x) => Number(x.nilai)))

    // Quiz performance: average percentage across attempts.
    const attempts = courseAttempts.filter((x) => x.student_id === s.id)
    const quizAvg = average(attempts.map((x) => Number(x.percentage)))

    // Attendance: % of 'hadir' among recorded pertemuan.
    const attRecords = courseAttendance.filter((r) => r.student_id === s.id)
    const hadirCount = attRecords.filter((r) => r.status === 'hadir').length
    const attendanceRate =
      attRecords.length > 0
        ? Math.round((hadirCount / attRecords.length) * 100)
        : null

    // Lesson progress: completed / total lessons for this course.
    const lessonStats = courses.courseLessonStats(courseId, s.id)

    const overallScore = computeOverallScore(assignmentAvg, quizAvg, attendanceRate)
    const overallGrade = scoreToGrade(overallScore)
    const atRisk = overallScore !== null && overallScore < AT_RISK_THRESHOLD

    return {
      student_id: s.id,
      nama: s.nama,
      npm: (s as any).npm ?? null,
      kelas: (s as any).kelas ?? null,
      assignmentDone: graded.length,
      assignmentTotal: courseAssignments.length,
      assignmentAvg,
      quizAttempts: attempts.length,
      quizTotal: courseQuizzes.length,
      quizAvg,
      attendanceRate,
      hadirCount,
      totalMeetings,
      lessonProgress: lessonStats.total > 0 ? lessonStats.completed / lessonStats.total : 0,
      lessonCompleted: lessonStats.completed,
      lessonTotal: lessonStats.total,
      overallScore,
      overallGrade,
      atRisk,
    }
  })

  return {
    courseId,
    students,
    stats: computeCourseStats(students),
  }
}

function emptyStats(): CourseAnalyticsStats {
  return {
    studentCount: 0,
    classAssignmentAvg: null,
    classQuizAvg: null,
    classAttendanceRate: null,
    classCompletionRate: null,
    atRiskCount: 0,
  }
}

/** Compute course-wide aggregate statistics. */
export function computeCourseStats(students: StudentAnalytics[]): CourseAnalyticsStats {
  const graded = students.filter((s) => s.assignmentAvg !== null)
  const quizzed = students.filter((s) => s.quizAvg !== null)
  const attended = students.filter((s) => s.attendanceRate !== null)

  return {
    studentCount: students.length,
    classAssignmentAvg: average(graded.map((s) => s.assignmentAvg!)),
    classQuizAvg: average(quizzed.map((s) => s.quizAvg!)),
    classAttendanceRate: average(attended.map((s) => s.attendanceRate!)),
    classCompletionRate: average(students.map((s) => s.lessonProgress * 100)),
    atRiskCount: students.filter((s) => s.atRisk).length,
  }
}