/**
 * Analytics type definitions.
 *
 * Aggregates per-student performance across assignments, quizzes,
 * attendance, and lesson progress for a given course.
 */

/** Letter grade derived from a weighted overall score. */
export type OverallGrade = 'A' | 'B' | 'C' | 'D' | 'E'

/** Aggregated performance metrics for a single student in one course. */
export interface StudentAnalytics {
  student_id: string
  nama: string
  npm: string | null
  kelas: string | null

  /** Assignments submitted (graded or not) vs total in the course. */
  assignmentDone: number
  assignmentTotal: number
  /** Average grade across graded assignments (0-100). Null if none graded. */
  assignmentAvg: number | null

  quizAttempts: number
  quizTotal: number
  /** Average quiz percentage across attempts (0-100). Null if none. */
  quizAvg: number | null

  /** Attendance rate in percent (0-100). Null if no attendance records. */
  attendanceRate: number | null
  hadirCount: number
  totalMeetings: number

  /** Fraction of enrolled lessons completed (0-1). */
  lessonProgress: number
  lessonCompleted: number
  lessonTotal: number

  /** Weighted composite: 40% assignments, 30% quiz, 30% attendance. 0-100. Null if no graded data. */
  overallScore: number | null
  overallGrade: OverallGrade | null
  /** True when the student is flagged for intervention (overallScore < threshold). */
  atRisk: boolean
}

/** Aggregate statistics for the whole course. */
export interface CourseAnalyticsStats {
  studentCount: number
  classAssignmentAvg: number | null
  classQuizAvg: number | null
  classAttendanceRate: number | null
  classCompletionRate: number | null
  atRiskCount: number
}

/** Result of computing a course's analytics. */
export interface CourseAnalytics {
  courseId: string
  students: StudentAnalytics[]
  stats: CourseAnalyticsStats
}
