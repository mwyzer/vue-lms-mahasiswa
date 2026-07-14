/**
 * Assignments Store — Manages assignment and submission data.
 *
 * Features:
 * - Fetch assignments by course or for overall view
 * - Submit assignments (students)
 * - Grade submissions (instructors)
 * - Demo mode support
 */
import { defineStore } from 'pinia'
import type { Assignment, Submission } from '~/types/database'
import type { AssignmentWithCourse, SubmissionWithStudent } from '~/types/assignment'
import { useAuthStore } from './auth'

// ── Demo data ─────────────────────────────────────────
const DEMO_ASSIGNMENTS: Assignment[] = [
  { id: 'a1', course_id: 'c1', instructor_id: 'i1', judul: 'Tugas 1: Hello World', deskripsi: 'Buat program Hello World dalam Python.', tenggat_waktu: '2025-08-15T23:59:59Z' },
  { id: 'a2', course_id: 'c1', instructor_id: 'i1', judul: 'Tugas 2: Kalkulator Sederhana', deskripsi: 'Buat kalkulator sederhana dengan Python.', tenggat_waktu: '2025-08-22T23:59:59Z' },
  { id: 'a3', course_id: 'c2', instructor_id: 'i2', judul: 'Tugas 1: Diagram Venn', deskripsi: 'Buat diagram Venn dari 3 himpunan.', tenggat_waktu: '2025-08-18T23:59:59Z' },
  { id: 'a4', course_id: 'c5', instructor_id: 'i1', judul: 'Tugas 1: Implementasi Array', deskripsi: 'Implementasikan operasi dasar array.', tenggat_waktu: '2025-09-01T23:59:59Z' },
  { id: 'a5', course_id: 'c8', instructor_id: 'i1', judul: 'Tugas 1: Class & Object', deskripsi: 'Buat class sederhana dengan enkapsulasi.', tenggat_waktu: '2025-09-15T23:59:59Z' },
]

const DEMO_SUBMISSIONS: Submission[] = [
  { id: 'sub1', assignment_id: 'a1', student_id: 's1', jawaban: 'print("Hello, World!")', submitted_at: '2025-08-14T10:30:00Z', nilai: 90, feedback: 'Bagus! Codingan rapi.', graded_at: '2025-08-15T08:00:00Z' },
  { id: 'sub2', assignment_id: 'a1', student_id: 's2', jawaban: 'print("Hello World")', submitted_at: '2025-08-14T11:00:00Z', submitted: true },
  { id: 'sub3', assignment_id: 'a2', student_id: 's1', jawaban: '# Kalkulator sederhana\n...', submitted_at: '2025-08-20T14:00:00Z' },
]

// Map courses for display
const COURSE_NAMES: Record<string, { nama: string; kode: string }> = {
  'c1': { nama: 'Pemrograman Dasar', kode: 'MK101' },
  'c2': { nama: 'Matematika Diskrit', kode: 'MK102' },
  'c5': { nama: 'Struktur Data', kode: 'MK201' },
  'c8': { nama: 'Pemrograman Berorientasi Objek', kode: 'MK301' },
}

interface AssignmentsState {
  assignments: AssignmentWithCourse[]
  currentAssignment: Assignment | null
  submissions: Submission[]
  loading: boolean
  error: string | null
}

export const useAssignmentsStore = defineStore('assignments', {
  state: (): AssignmentsState => ({
    assignments: [],
    currentAssignment: null,
    submissions: [],
    loading: false,
    error: null,
  }),

  getters: {
    /** Assignments visible to the current student (based on enrolled courses). */
    myAssignments(state): AssignmentWithCourse[] {
      const auth = useAuthStore()
      if (!auth.user) return []

      if (auth.isStudent) {
        const coursesStore = useCoursesStore()
        const myCourseIds = coursesStore.myCourses.map((c) => c.id)

        return DEMO_ASSIGNMENTS
          .filter((a) => myCourseIds.includes(a.course_id))
          .map((a) => ({
            ...a,
            course_name: COURSE_NAMES[a.course_id]?.nama || '',
            course_kode: COURSE_NAMES[a.course_id]?.kode || '',
            submission: DEMO_SUBMISSIONS.find(
              (s) => s.assignment_id === a.id && s.student_id === auth.user!.id
            ),
          }))
      }

      if (auth.isInstructor) {
        return DEMO_ASSIGNMENTS
          .filter((a) => a.instructor_id === auth.user!.id)
          .map((a) => ({
            ...a,
            course_name: COURSE_NAMES[a.course_id]?.nama || '',
            course_kode: COURSE_NAMES[a.course_id]?.kode || '',
          }))
      }

      return []
    },

    /** Submissions for a given assignment (for instructor grading). */
    submissionsForAssignment(state): (assignmentId: string) => SubmissionWithStudent[] {
      return (assignmentId: string) => {
        return DEMO_SUBMISSIONS
          .filter((s) => s.assignment_id === assignmentId)
          .map((s) => ({
            ...s,
            student_name: '', // Would be populated from profiles in real mode
            student_npm: '',
          }))
      }
    },
  },

  actions: {
    /**
     * Set the currently viewed assignment.
     */
    setCurrentAssignment(assignmentId: string) {
      const assignment = DEMO_ASSIGNMENTS.find((a) => a.id === assignmentId)
      if (assignment) {
        this.currentAssignment = assignment
      }
    },

    /**
     * Submit an assignment (student).
     */
    submitAssignment(assignmentId: string, jawaban: string) {
      const auth = useAuthStore()
      if (!auth.user?.id) return

      const existing = DEMO_SUBMISSIONS.findIndex(
        (s) => s.assignment_id === assignmentId && s.student_id === auth.user.id
      )

      const submission: Submission = {
        id: `sub-${Date.now()}`,
        assignment_id: assignmentId,
        student_id: auth.user.id,
        jawaban,
        submitted_at: new Date().toISOString(),
      }

      if (existing >= 0) {
        DEMO_SUBMISSIONS[existing] = { ...DEMO_SUBMISSIONS[existing], ...submission }
      } else {
        DEMO_SUBMISSIONS.push(submission)
      }

      // Refresh local state
      this.submissions = DEMO_SUBMISSIONS.filter(
        (s) => s.assignment_id === assignmentId
      )
    },

    /**
     * Create a new assignment (instructor, demo mode).
     */
    addAssignment(courseId: string, judul: string, deskripsi: string, tenggatWaktu: string) {
      const auth = useAuthStore()
      const newAssignment: Assignment = {
        id: `a-${Date.now()}`,
        course_id: courseId,
        instructor_id: auth.user?.id || '',
        judul,
        deskripsi,
        tenggat_waktu: tenggatWaktu,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      DEMO_ASSIGNMENTS.push(newAssignment)
    },

    /**
     * Grade a submission (instructor, demo mode).
     */
    gradeSubmission(submissionId: string, nilai: number, feedback: string) {
      const idx = DEMO_SUBMISSIONS.findIndex((s) => s.id === submissionId)
      if (idx >= 0) {
        DEMO_SUBMISSIONS[idx] = {
          ...DEMO_SUBMISSIONS[idx],
          nilai,
          feedback,
          graded_at: new Date().toISOString(),
        }
      }
    },
  },
})
