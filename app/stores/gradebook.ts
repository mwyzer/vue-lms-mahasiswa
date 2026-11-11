/**
 * Gradebook Store — weighted final grades per course.
 *
 * Final grade = weighted average of five components:
 *   Tugas, Kuis, Presensi, UTS, UAS
 * with weights configurable per course (must total 100).
 *
 * Component rules:
 * - Tugas    : mean over the course's assignments. Graded → its score; not submitted
 *              and past the deadline → 0; submitted but not graded yet → skipped.
 * - Kuis     : mean of the student's best percentage on each quiz they attempted.
 * - Presensi : % of recorded meetings with status "hadir".
 * - UTS/UAS  : entered manually by the instructor.
 *
 * A component with no data yet is left out and the remaining weights are
 * re-normalised, so the result is a *provisional* grade until every component
 * has data (`isProvisional`).
 *
 * The math is in pure exported functions (unit-testable without Pinia); the
 * store reads from the existing auth/courses/assignments/quiz/attendance stores
 * so it works in both demo and Supabase modes.
 */
import { defineStore } from 'pinia'
import type { GradeWeights, ExamScore, Assignment, Submission, Quiz, QuizAttempt, Attendance } from '~/types/database'
import type { OverallGrade } from '~/types/analytics'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useAssignmentsStore } from './assignments'
import { useQuizStore } from './quiz'
import { useAttendanceStore } from './attendance'
import { average, clamp100, scoreToGrade } from './analytics'

// ── Types ────────────────────────────────────────────────

export type GradeComponent = 'tugas' | 'kuis' | 'presensi' | 'uts' | 'uas'

export type WeightSet = Record<GradeComponent, number>
export type ComponentScores = Record<GradeComponent, number | null>

export interface GradebookRow extends ComponentScores {
  student_id: string
  nama: string
  npm: string
  /** Weighted final score (0-100, one decimal), null when no component has data. */
  final: number | null
  letter: OverallGrade | null
  /** Sum of weights of the components that have data (0-100). */
  coveredWeight: number
  /** True while at least one weighted component has no data yet. */
  isProvisional: boolean
}

export interface CourseGrade extends GradebookRow {
  course_id: string
  course_kode: string
  course_nama: string
  weights: WeightSet
}

// ── Config ───────────────────────────────────────────────

export const GRADE_COMPONENTS: GradeComponent[] = ['tugas', 'kuis', 'presensi', 'uts', 'uas']

export const COMPONENT_LABELS: Record<GradeComponent, string> = {
  tugas: 'Tugas',
  kuis: 'Kuis',
  presensi: 'Presensi',
  uts: 'UTS',
  uas: 'UAS',
}

export const DEFAULT_WEIGHTS: WeightSet = { tugas: 25, kuis: 15, presensi: 10, uts: 20, uas: 30 }

// ── Pure helpers (unit-testable) ─────────────────────────

export function weightsTotal(w: WeightSet): number {
  return GRADE_COMPONENTS.reduce((sum, k) => sum + (Number(w[k]) || 0), 0)
}

/** Returns an error message, or null when the weights are valid. */
export function validateWeights(w: WeightSet): string | null {
  for (const k of GRADE_COMPONENTS) {
    const v = w[k]
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return `Bobot ${COMPONENT_LABELS[k]} harus bilangan bulat 0–100.`
    }
  }
  const total = weightsTotal(w)
  if (total !== 100) return `Total bobot harus 100% (sekarang ${total}%).`
  return null
}

export function toWeightSet(row: GradeWeights | null | undefined): WeightSet {
  if (!row) return { ...DEFAULT_WEIGHTS }
  return {
    tugas: row.bobot_tugas,
    kuis: row.bobot_kuis,
    presensi: row.bobot_presensi,
    uts: row.bobot_uts,
    uas: row.bobot_uas,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Weighted final score. Components without data (null) or with weight 0 are
 * skipped and the remaining weights re-normalised.
 */
export function computeFinalScore(
  scores: ComponentScores,
  weights: WeightSet
): { final: number | null; coveredWeight: number; isProvisional: boolean } {
  let sum = 0
  let covered = 0
  let totalWeight = 0

  for (const k of GRADE_COMPONENTS) {
    const w = Number(weights[k]) || 0
    if (w <= 0) continue
    totalWeight += w
    const s = scores[k]
    if (s === null || s === undefined) continue
    sum += clamp100(s) * w
    covered += w
  }

  if (covered === 0) return { final: null, coveredWeight: 0, isProvisional: totalWeight > 0 }
  return {
    final: round1(sum / covered),
    coveredWeight: covered,
    isProvisional: covered < totalWeight,
  }
}

/** Tugas component — see the rules in the file header. */
export function assignmentComponent(
  assignments: Assignment[],
  submissions: Submission[],
  studentId: string,
  now: number = Date.now()
): number | null {
  const values: number[] = []
  for (const a of assignments) {
    const sub = submissions.find((s) => s.assignment_id === a.id && s.student_id === studentId)
    if (sub && typeof sub.nilai === 'number') {
      values.push(sub.nilai)
    } else if (!sub && a.tenggat_waktu && new Date(a.tenggat_waktu).getTime() < now) {
      values.push(0)
    }
  }
  const avg = average(values)
  return avg === null ? null : round1(avg)
}

/** Kuis component — mean of the best attempt per attempted quiz. */
export function quizComponent(quizzes: Quiz[], attempts: QuizAttempt[], studentId: string): number | null {
  const best: number[] = []
  for (const q of quizzes) {
    const mine = attempts.filter((a) => a.quiz_id === q.id && a.student_id === studentId)
    if (mine.length > 0) best.push(Math.max(...mine.map((a) => Number(a.percentage) || 0)))
  }
  const avg = average(best)
  return avg === null ? null : round1(avg)
}

/** Presensi component — % of recorded meetings attended. */
export function attendanceComponent(records: Attendance[], studentId: string): number | null {
  const mine = records.filter((r) => r.student_id === studentId)
  if (mine.length === 0) return null
  return Math.round((mine.filter((r) => r.status === 'hadir').length / mine.length) * 100)
}

export function examComponent(scores: ExamScore[], courseId: string, studentId: string, tipe: 'uts' | 'uas'): number | null {
  const row = scores.find((s) => s.course_id === courseId && s.student_id === studentId && s.tipe === tipe)
  return row ? row.nilai : null
}

interface GradebookSource {
  auth: ReturnType<typeof useAuthStore>
  courses: ReturnType<typeof useCoursesStore>
  assignments: ReturnType<typeof useAssignmentsStore>
  quiz: ReturnType<typeof useQuizStore>
  attendance: ReturnType<typeof useAttendanceStore>
}

/** Build one gradebook row per enrolled student of a course. */
export function buildGradebook(
  courseId: string,
  src: GradebookSource,
  weights: WeightSet,
  examScores: ExamScore[],
  now: number = Date.now()
): GradebookRow[] {
  const { auth, courses, assignments, quiz, attendance } = src

  const course = courses.allCourses.find((c) => c.id === courseId)
  if (!course) return []

  const courseAssignments = (assignments.isDemoMode ? assignments.assignments : assignments.sbAssignments)
    .filter((a) => a.course_id === courseId)
  const courseSubmissions = (assignments.isDemoMode ? assignments.submissions : assignments.sbSubmissions)
    .filter((s) => courseAssignments.some((a) => a.id === s.assignment_id))
  const courseQuizzes = quiz.quizzes.filter((q) => q.course_id === courseId)
  const courseAttempts = quiz.attempts.filter((a) => courseQuizzes.some((q) => q.id === a.quiz_id))
  const courseAttendance = (attendance.isDemoMode ? attendance.records : attendance.sbRecords)
    .filter((r) => r.course_id === courseId)

  // Enrolled students: same level + session lookup the rest of the app uses.
  const enrolled = auth.studentRoster.filter(
    (s) => s.level === course.level && s.session_time === course.session_time
  )

  return enrolled
    .map((s) => {
      const scores: ComponentScores = {
        tugas: assignmentComponent(courseAssignments, courseSubmissions, s.id, now),
        kuis: quizComponent(courseQuizzes, courseAttempts, s.id),
        presensi: attendanceComponent(courseAttendance, s.id),
        uts: examComponent(examScores, courseId, s.id, 'uts'),
        uas: examComponent(examScores, courseId, s.id, 'uas'),
      }
      const result = computeFinalScore(scores, weights)
      return {
        student_id: s.id,
        nama: s.nama,
        npm: s.npm,
        ...scores,
        final: result.final,
        letter: scoreToGrade(result.final),
        coveredWeight: result.coveredWeight,
        isProvisional: result.isProvisional,
      }
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

// ── Demo data ────────────────────────────────────────────

const DEMO_WEIGHTS: GradeWeights[] = [
  { course_id: 'c1', bobot_tugas: 30, bobot_kuis: 20, bobot_presensi: 10, bobot_uts: 20, bobot_uas: 20 },
]

const DEMO_EXAM_SCORES: ExamScore[] = [
  { id: 'ex1', course_id: 'c1', student_id: 's1', tipe: 'uts', nilai: 85 },
  { id: 'ex2', course_id: 'c1', student_id: 's2', tipe: 'uts', nilai: 68 },
  { id: 'ex3', course_id: 'c1', student_id: 's3', tipe: 'uts', nilai: 77 },
]

let demoSeq = 0

// ── Store ────────────────────────────────────────────────

interface GradebookState {
  weights: GradeWeights[]
  examScores: ExamScore[]
  loading: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
}

export const useGradebookStore = defineStore('gradebook', {
  state: (): GradebookState => ({
    weights: [],
    examScores: [],
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
  }),

  getters: {
    /** Weights of a course (defaults when the instructor has not set any). */
    weightsFor(): (courseId: string) => WeightSet {
      return (courseId: string) => toWeightSet(this.weights.find((w) => w.course_id === courseId))
    },

    /** True when the instructor has saved custom weights for the course. */
    hasCustomWeights(): (courseId: string) => boolean {
      return (courseId: string) => this.weights.some((w) => w.course_id === courseId)
    },

    /** One row per enrolled student. */
    courseGradebook(): (courseId: string) => GradebookRow[] {
      return (courseId: string) =>
        buildGradebook(
          courseId,
          {
            auth: useAuthStore(),
            courses: useCoursesStore(),
            assignments: useAssignmentsStore(),
            quiz: useQuizStore(),
            attendance: useAttendanceStore(),
          },
          this.weightsFor(courseId),
          this.examScores
        )
    },

    /** Final grade per enrolled course for the signed-in student. */
    myGrades(): CourseGrade[] {
      const auth = useAuthStore()
      if (!auth.user || !auth.isStudent) return []
      const uid = auth.user.id

      return useCoursesStore().myCourses
        .map((c) => {
          const row = this.courseGradebook(c.id).find((r) => r.student_id === uid)
          if (!row) return null
          return {
            ...row,
            course_id: c.id,
            course_kode: c.kode,
            course_nama: c.nama,
            weights: this.weightsFor(c.id),
          } as CourseGrade
        })
        .filter(Boolean) as CourseGrade[]
    },
  },

  actions: {
    /** Loads weights + exam scores, and makes sure the source stores are ready. */
    async init() {
      await Promise.all([
        useAuthStore().init(),
        useCoursesStore().init(),
        useQuizStore().init(),
        useAttendanceStore().init(),
      ])
      await useAssignmentsStore().init()

      if (this.initialized) return
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode
      this.error = null

      if (!this.isDemoMode) {
        this.loading = true
        try {
          const supabase = useNuxtApp().$supabase
          const { data: weights, error: wErr } = await supabase.from('grade_weights').select('*')
          if (wErr) throw wErr
          const { data: exams, error: eErr } = await supabase.from('exam_scores').select('*')
          if (eErr) throw eErr

          this.weights = (weights || []) as GradeWeights[]
          this.examScores = (exams || []) as ExamScore[]
        } catch (err: any) {
          console.error('Failed to fetch gradebook from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      if (this.isDemoMode) this._syncDemo()
      this.initialized = true
    },

    _syncDemo() {
      if (this.isDemoMode) {
        this.weights = [...DEMO_WEIGHTS]
        this.examScores = [...DEMO_EXAM_SCORES]
      }
    },

    /** Instructor: save the component weights of a course (must total 100). */
    async saveWeights(courseId: string, w: WeightSet): Promise<boolean> {
      this.error = validateWeights(w)
      if (this.error) return false

      const row: GradeWeights = {
        course_id: courseId,
        bobot_tugas: w.tugas,
        bobot_kuis: w.kuis,
        bobot_presensi: w.presensi,
        bobot_uts: w.uts,
        bobot_uas: w.uas,
        updated_at: new Date().toISOString(),
      }

      if (this.isDemoMode) {
        const idx = DEMO_WEIGHTS.findIndex((x) => x.course_id === courseId)
        if (idx >= 0) DEMO_WEIGHTS[idx] = row
        else DEMO_WEIGHTS.push(row)
        this._syncDemo()
        return true
      }

      try {
        const { error } = await useNuxtApp().$supabase
          .from('grade_weights')
          .upsert(row, { onConflict: 'course_id' })
        if (error) throw error
        this.weights = [...this.weights.filter((x) => x.course_id !== courseId), row]
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menyimpan bobot nilai.'
        return false
      }
    },

    /**
     * Instructor: set a student's UTS/UAS score. Pass null to clear it.
     */
    async setExamScore(courseId: string, studentId: string, tipe: 'uts' | 'uas', nilai: number | null): Promise<boolean> {
      this.error = null
      if (nilai !== null && (!Number.isInteger(nilai) || nilai < 0 || nilai > 100)) {
        this.error = 'Nilai harus bilangan bulat 0–100.'
        return false
      }

      const match = (s: ExamScore) => s.course_id === courseId && s.student_id === studentId && s.tipe === tipe

      if (this.isDemoMode) {
        const idx = DEMO_EXAM_SCORES.findIndex(match)
        if (nilai === null) {
          if (idx >= 0) DEMO_EXAM_SCORES.splice(idx, 1)
        } else if (idx >= 0) {
          DEMO_EXAM_SCORES[idx] = { ...DEMO_EXAM_SCORES[idx], nilai, updated_at: new Date().toISOString() }
        } else {
          DEMO_EXAM_SCORES.push({
            id: `ex-demo-${Date.now()}-${++demoSeq}`,
            course_id: courseId,
            student_id: studentId,
            tipe,
            nilai,
            updated_at: new Date().toISOString(),
          })
        }
        this._syncDemo()
        return true
      }

      try {
        const supabase = useNuxtApp().$supabase
        if (nilai === null) {
          const { error } = await supabase
            .from('exam_scores')
            .delete()
            .eq('course_id', courseId)
            .eq('student_id', studentId)
            .eq('tipe', tipe)
          if (error) throw error
          this.examScores = this.examScores.filter((s) => !match(s))
        } else {
          const { data, error } = await supabase
            .from('exam_scores')
            .upsert(
              { course_id: courseId, student_id: studentId, tipe, nilai, updated_at: new Date().toISOString() },
              { onConflict: 'course_id,student_id,tipe' }
            )
            .select()
            .single()
          if (error) throw error
          this.examScores = [...this.examScores.filter((s) => !match(s)), data as ExamScore]
        }
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menyimpan nilai ujian.'
        return false
      }
    },
  },
})
