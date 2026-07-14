/**
 * Assignments Store — Manages assignment and submission data.
 *
 * Features:
 * - Fetch assignments by course or for overall view
 * - Submit assignments (students)
 * - Grade submissions (instructors)
 * - Demo mode + Supabase production mode
 */
import { defineStore } from 'pinia'
import type { Assignment, Submission } from '~/types/database'
import type { AssignmentWithCourse, SubmissionWithStudent } from '~/types/assignment'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'

// ── Demo data (fallback when demoMode=true) ──────────
const DEMO_ASSIGNMENTS: Assignment[] = [
  { id: 'a1', course_id: 'c1', instructor_id: 'i1', judul: 'Tugas 1: Hello World', deskripsi: 'Buat program Hello World dalam Python.', tenggat_waktu: '2025-08-15T23:59:59Z' },
  { id: 'a2', course_id: 'c1', instructor_id: 'i1', judul: 'Tugas 2: Kalkulator Sederhana', deskripsi: 'Buat kalkulator sederhana dengan Python.', tenggat_waktu: '2025-08-22T23:59:59Z' },
  { id: 'a3', course_id: 'c2', instructor_id: 'i2', judul: 'Tugas 1: Diagram Venn', deskripsi: 'Buat diagram Venn dari 3 himpunan.', tenggat_waktu: '2025-08-18T23:59:59Z' },
  { id: 'a4', course_id: 'c5', instructor_id: 'i1', judul: 'Tugas 1: Implementasi Array', deskripsi: 'Implementasikan operasi dasar array.', tenggat_waktu: '2025-09-01T23:59:59Z' },
  { id: 'a5', course_id: 'c8', instructor_id: 'i1', judul: 'Tugas 1: Class & Object', deskripsi: 'Buat class sederhana dengan enkapsulasi.', tenggat_waktu: '2025-09-15T23:59:59Z' },
]

const DEMO_SUBMISSIONS: Submission[] = [
  { id: 'sub1', assignment_id: 'a1', student_id: 's1', jawaban: 'print("Hello, World!")', submitted_at: '2025-08-14T10:30:00Z', nilai: 90, feedback: 'Bagus! Codingan rapi.', graded_at: '2025-08-15T08:00:00Z' },
  { id: 'sub2', assignment_id: 'a1', student_id: 's2', jawaban: 'print("Hello World")', submitted_at: '2025-08-14T11:00:00Z' },
  { id: 'sub3', assignment_id: 'a2', student_id: 's1', jawaban: '# Kalkulator sederhana\n...', submitted_at: '2025-08-20T14:00:00Z' },
]

const DEMO_COURSE_NAMES: Record<string, { nama: string; kode: string }> = {
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

  // Demo reactivity version (incremented on mutations to force getter re-evaluation)
  demoVersion: number

  // Supabase data cache
  isDemoMode: boolean
  initialized: boolean
  sbAssignments: Assignment[]
  sbSubmissions: Submission[]
  sbCourseNames: Record<string, { nama: string; kode: string }>
}

export const useAssignmentsStore = defineStore('assignments', {
  state: (): AssignmentsState => ({
    assignments: [],
    currentAssignment: null,
    submissions: [],
    loading: false,
    error: null,
    demoVersion: 0,
    isDemoMode: true,
    initialized: false,
    sbAssignments: [],
    sbSubmissions: [],
    sbCourseNames: {},
  }),

  getters: {
    /** Assignments visible to the current user. */
    myAssignments(): AssignmentWithCourse[] {
      const store = useAssignmentsStore()
      const auth = useAuthStore()
      if (!auth.user) return []
      // Track demoVersion for reactivity when DEMO_* arrays are mutated
      void store.demoVersion

      const assignments = store.isDemoMode ? DEMO_ASSIGNMENTS : store.sbAssignments
      const submissions = store.isDemoMode ? DEMO_SUBMISSIONS : store.sbSubmissions
      const courseNames = store.isDemoMode ? DEMO_COURSE_NAMES : store.sbCourseNames

      if (auth.isStudent) {
        const coursesStore = useCoursesStore()
        const myCourseIds = coursesStore.myCourses.map((c) => c.id)

        return assignments
          .filter((a) => myCourseIds.includes(a.course_id))
          .map((a) => ({
            ...a,
            course_name: courseNames[a.course_id]?.nama || '',
            course_kode: courseNames[a.course_id]?.kode || '',
            submission: submissions.find(
              (s) => s.assignment_id === a.id && s.student_id === auth.user!.id
            ),
          }))
      }

      if (auth.isInstructor) {
        return assignments
          .filter((a) => a.instructor_id === auth.user!.id)
          .map((a) => ({
            ...a,
            course_name: courseNames[a.course_id]?.nama || '',
            course_kode: courseNames[a.course_id]?.kode || '',
            submissionCount: submissions.filter((s) => s.assignment_id === a.id).length,
          }))
      }

      return []
    },

    /** Submissions for a given assignment (for instructor grading). */
    submissionsForAssignment(): (assignmentId: string) => SubmissionWithStudent[] {
      return (assignmentId: string) => {
        const store = useAssignmentsStore()
        const submissions = store.isDemoMode ? DEMO_SUBMISSIONS : store.sbSubmissions
        const auth = useAuthStore()

        // Get student names from auth store
        const roster = auth.studentRoster

        return submissions
          .filter((s) => s.assignment_id === assignmentId)
          .map((s) => ({
            ...s,
            student_name: roster.find((r) => r.id === s.student_id)?.nama || '',
            student_npm: roster.find((r) => r.id === s.student_id)?.npm || '',
          }))
      }
    },
  },

  actions: {
    /**
     * Initialize store: fetch data from Supabase in production mode.
     */
    async init() {
      if (this.initialized) return
      const config = useRuntimeConfig()
      this.isDemoMode = config.public.demoMode !== 'false'

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          this.loading = true

          // Ensure auth roster is loaded (for student names)
          const auth = useAuthStore()
          if (!auth.initialized) await auth.init()

          // Fetch assignments
          const { data: assignments } = await supabase
            .from('assignments')
            .select('*')
            .order('created_at')

          if (assignments) {
            this.sbAssignments = assignments as Assignment[]
          }

          // Fetch submissions
          const { data: submissions } = await supabase
            .from('submissions')
            .select('*')
            .order('submitted_at')

          if (submissions) {
            this.sbSubmissions = submissions as Submission[]
          }

          // Build course name map from courses store
          const coursesStore = useCoursesStore()
          if (!coursesStore.initialized) await coursesStore.init()

          const courses = coursesStore.isDemoMode
            ? (await import('./courses')).DEMO_COURSES || []
            : coursesStore.sbCourses

          const nameMap: Record<string, { nama: string; kode: string }> = {}
          for (const c of coursesStore.sbCourses) {
            nameMap[c.id] = { nama: c.nama, kode: c.kode }
          }
          // Also add any from courses store allCourses getter
          for (const c of coursesStore.allCourses) {
            if (!nameMap[c.id]) {
              nameMap[c.id] = { nama: c.nama || c.nama, kode: c.kode || c.kode }
            }
          }
          this.sbCourseNames = nameMap
        } catch (err) {
          console.error('Failed to fetch assignments from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      this.initialized = true
    },

    /**
     * Set the currently viewed assignment.
     */
    setCurrentAssignment(assignmentId: string) {
      const assignments = this.isDemoMode ? DEMO_ASSIGNMENTS : this.sbAssignments
      const assignment = assignments.find((a) => a.id === assignmentId)
      if (assignment) {
        this.currentAssignment = assignment
      }
    },

    /**
     * Submit an assignment (student).
     */
    async submitAssignment(assignmentId: string, jawaban: string) {
      const auth = useAuthStore()
      if (!auth.user?.id) return

      if (this.isDemoMode) {
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

        this.submissions = DEMO_SUBMISSIONS.filter(
          (s) => s.assignment_id === assignmentId
        )
        this.demoVersion++
        return
      }

      // Production: upsert into Supabase
      try {
        const supabase = useNuxtApp().$supabase

        const { data: existing } = await supabase
          .from('submissions')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('student_id', auth.user.id)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('submissions')
            .update({ jawaban, submitted_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('submissions')
            .insert({
              assignment_id: assignmentId,
              student_id: auth.user.id,
              jawaban,
              submitted_at: new Date().toISOString(),
            })
        }

        // Refresh local cache
        const { data: refreshed } = await supabase
          .from('submissions')
          .select('*')
          .eq('assignment_id', assignmentId)

        if (refreshed) {
          this.sbSubmissions = this.sbSubmissions.filter(
            (s) => s.assignment_id !== assignmentId
          ).concat(refreshed as Submission[])
        }
      } catch (err) {
        console.error('Failed to submit assignment:', err)
      }
    },

    /**
     * Create a new assignment (instructor).
     */
    async addAssignment(courseId: string, judul: string, deskripsi: string, tenggatWaktu: string) {
      const auth = useAuthStore()

      if (this.isDemoMode) {
        DEMO_ASSIGNMENTS.push({
          id: `a-${Date.now()}`,
          course_id: courseId,
          instructor_id: auth.user?.id || '',
          judul,
          deskripsi,
          tenggat_waktu: tenggatWaktu,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        this.demoVersion++
        return
      }

      // Production: insert into Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { data } = await supabase
          .from('assignments')
          .insert({
            course_id: courseId,
            instructor_id: auth.user?.id || '',
            judul,
            deskripsi,
            tenggat_waktu: tenggatWaktu,
          })
          .select()
          .single()

        if (data) {
          this.sbAssignments.push(data as Assignment)
        }
      } catch (err) {
        console.error('Failed to add assignment:', err)
      }
    },

    /**
     * Grade a submission (instructor).
     */
    async gradeSubmission(submissionId: string, nilai: number, feedback: string) {
      if (this.isDemoMode) {
        const idx = DEMO_SUBMISSIONS.findIndex((s) => s.id === submissionId)
        if (idx >= 0) {
          DEMO_SUBMISSIONS[idx] = {
            ...DEMO_SUBMISSIONS[idx],
            nilai,
            feedback,
            graded_at: new Date().toISOString(),
          }
        }
        this.demoVersion++
        return
      }

      // Production: update in Supabase
      try {
        const supabase = useNuxtApp().$supabase
        await supabase
          .from('submissions')
          .update({
            nilai,
            feedback,
            graded_at: new Date().toISOString(),
          })
          .eq('id', submissionId)

        // Update local cache
        const idx = this.sbSubmissions.findIndex((s) => s.id === submissionId)
        if (idx >= 0) {
          this.sbSubmissions[idx] = {
            ...this.sbSubmissions[idx],
            nilai,
            feedback,
            graded_at: new Date().toISOString(),
          }
        }
      } catch (err) {
        console.error('Failed to grade submission:', err)
      }
    },
  },
})
