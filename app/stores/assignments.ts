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
export const DEMO_ASSIGNMENTS: Assignment[] = [
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
    isDemoMode: true,
    initialized: false,
    sbAssignments: [],
    sbSubmissions: [],
    sbCourseNames: {},
  }),

  getters: {
    /** Assignments visible to the current user. */
    myAssignments(): AssignmentWithCourse[] {
      const auth = useAuthStore()
      if (!auth.user) return []

      const assignments = this.isDemoMode ? this.assignments : this.sbAssignments
      const submissions = this.isDemoMode ? this.submissions : this.sbSubmissions
      const courseNames = this.isDemoMode ? DEMO_COURSE_NAMES : this.sbCourseNames

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
        const submissions = this.isDemoMode ? this.submissions : this.sbSubmissions
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
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode

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

      // Seed reactive state from demo data
      if (this.isDemoMode) {
        this.assignments = [...DEMO_ASSIGNMENTS]
        this.submissions = [...DEMO_SUBMISSIONS]
      }

      this.initialized = true
    },

    /** Sync demo data into reactive state to trigger getter re-evaluation. */
    _syncDemo() {
      if (this.isDemoMode) {
        this.assignments = [...DEMO_ASSIGNMENTS]
        this.submissions = [...DEMO_SUBMISSIONS]
      }
    },

    /**
     * Set the currently viewed assignment.
     */
    setCurrentAssignment(assignmentId: string) {
      const assignments = this.isDemoMode ? this.assignments : this.sbAssignments
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
        this._syncDemo()
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
     * Create a new assignment (instructor/admin).
     * @param courseId - Target course ID
     * @param judul - Assignment title
     * @param deskripsi - Assignment description
     * @param tenggatWaktu - ISO deadline string
     * @param instructorId - Optional instructor override (admin use). Defaults to current user.
     */
    async addAssignment(courseId: string, judul: string, deskripsi: string, tenggatWaktu: string, instructorId?: string) {
      const auth = useAuthStore()
      const instId = instructorId || auth.user?.id || ''

      if (this.isDemoMode) {
        DEMO_ASSIGNMENTS.push({
          id: `a-${Date.now()}`,
          course_id: courseId,
          instructor_id: instId,
          judul,
          deskripsi,
          tenggat_waktu: tenggatWaktu,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        this._syncDemo()
        return
      }

      // Production: insert into Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { data } = await supabase
          .from('assignments')
          .insert({
            course_id: courseId,
            instructor_id: instId,
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
     * Update an existing assignment (instructor).
     */
    async updateAssignment(assignmentId: string, data: { judul?: string; deskripsi?: string; tenggat_waktu?: string }) {
      if (this.isDemoMode) {
        const idx = DEMO_ASSIGNMENTS.findIndex((a) => a.id === assignmentId)
        if (idx >= 0) {
          if (data.judul !== undefined) DEMO_ASSIGNMENTS[idx].judul = data.judul
          if (data.deskripsi !== undefined) DEMO_ASSIGNMENTS[idx].deskripsi = data.deskripsi
          if (data.tenggat_waktu !== undefined) DEMO_ASSIGNMENTS[idx].tenggat_waktu = data.tenggat_waktu
          DEMO_ASSIGNMENTS[idx].updated_at = new Date().toISOString()
        }
        this._syncDemo()
        return
      }

      try {
        const supabase = useNuxtApp().$supabase
        const payload: Record<string, any> = { updated_at: new Date().toISOString() }
        if (data.judul !== undefined) payload.judul = data.judul
        if (data.deskripsi !== undefined) payload.deskripsi = data.deskripsi
        if (data.tenggat_waktu !== undefined) payload.tenggat_waktu = data.tenggat_waktu

        await supabase.from('assignments').update(payload).eq('id', assignmentId)

        const idx = this.sbAssignments.findIndex((a) => a.id === assignmentId)
        if (idx >= 0) {
          if (data.judul !== undefined) this.sbAssignments[idx].judul = data.judul
          if (data.deskripsi !== undefined) this.sbAssignments[idx].deskripsi = data.deskripsi
          if (data.tenggat_waktu !== undefined) this.sbAssignments[idx].tenggat_waktu = data.tenggat_waktu
        }
      } catch (err) {
        console.error('Failed to update assignment:', err)
      }
    },

    /**
     * Delete an assignment (instructor).
     */
    async deleteAssignment(assignmentId: string) {
      if (this.isDemoMode) {
        const idx = DEMO_ASSIGNMENTS.findIndex((a) => a.id === assignmentId)
        if (idx >= 0) {
          DEMO_ASSIGNMENTS.splice(idx, 1)
          // Also remove related submissions
          for (let i = DEMO_SUBMISSIONS.length - 1; i >= 0; i--) {
            if (DEMO_SUBMISSIONS[i].assignment_id === assignmentId) {
              DEMO_SUBMISSIONS.splice(i, 1)
            }
          }
        }
        this._syncDemo()
        return
      }

      try {
        const supabase = useNuxtApp().$supabase
        await supabase.from('assignments').delete().eq('id', assignmentId)

        this.sbAssignments = this.sbAssignments.filter((a) => a.id !== assignmentId)
        this.sbSubmissions = this.sbSubmissions.filter((s) => s.assignment_id !== assignmentId)
      } catch (err) {
        console.error('Failed to delete assignment:', err)
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
        this._syncDemo()
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

    /**
     * Direct grade a student without requiring a submission.
     * Creates a submission placeholder if one doesn't exist.
     */
    async directGradeStudent(
      courseId: string,
      assignmentId: string,
      studentId: string,
      nilai: number,
      feedback: string
    ) {
      if (this.isDemoMode) {
        // Find existing submission or create placeholder
        let sub = DEMO_SUBMISSIONS.find(
          (s) => s.assignment_id === assignmentId && s.student_id === studentId
        )
        if (!sub) {
          const newSub: any = {
            id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            assignment_id: assignmentId,
            course_id: courseId,
            student_id: studentId,
            jawaban: '(Dinilai langsung)',
            submitted_at: new Date().toISOString(),
            nilai,
            feedback,
            graded_at: new Date().toISOString(),
          }
          DEMO_SUBMISSIONS.push(newSub)
        } else {
          const idx = DEMO_SUBMISSIONS.indexOf(sub)
          DEMO_SUBMISSIONS[idx] = { ...sub, nilai, feedback, graded_at: new Date().toISOString() }
        }
        this._syncDemo()
        return true
      }

      // Production
      try {
        const supabase = useNuxtApp().$supabase
        // Check for existing submission
        const { data: existing } = await supabase
          .from('submissions')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .single()

        if (existing) {
          await supabase
            .from('submissions')
            .update({ nilai, feedback, graded_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('submissions')
            .insert({
              assignment_id: assignmentId,
              course_id: courseId,
              student_id: studentId,
              jawaban: '(Dinilai langsung)',
              submitted_at: new Date().toISOString(),
              nilai,
              feedback,
              graded_at: new Date().toISOString(),
            })
        }
        return true
      } catch (err) {
        console.error('Failed to direct grade:', err)
        return false
      }
    },
  },
})
