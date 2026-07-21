/**
 * Courses Store — Manages course, lesson, and enrollment data.
 *
 * Features:
 * - Fetches courses by level/session for students
 * - Fetches courses by instructor for instructors
 * - Lesson progress tracking with Supabase sync
 * - Demo mode + Supabase production mode
 */
import { defineStore } from 'pinia'
import type { Course, Lesson, LessonProgress, Enrollment } from '~/types/database'
import type { CourseWithProgress, LessonWithProgress } from '~/types/course'
import { useAuthStore } from './auth'

// ── Demo data (fallback when demoMode=true) ──────────
const DEMO_COURSES: Course[] = [
  { id: 'c1', instructor_id: 'i1', kode: 'MK101', nama: 'Pemrograman Dasar', deskripsi: 'Belajar dasar-dasar pemrograman dengan Python.', level: 1, session_time: 'morning', color: '#3b82f6', icon: '💻' },
  { id: 'c2', instructor_id: 'i2', kode: 'MK102', nama: 'Matematika Diskrit', deskripsi: 'Konsep matematika untuk ilmu komputer.', level: 1, session_time: 'morning', color: '#8b5cf6', icon: '🔢' },
  { id: 'c3', instructor_id: 'i3', kode: 'MK103', nama: 'Logika Informatika', deskripsi: 'Logika proposisional dan predikat.', level: 1, session_time: 'evening', color: '#ec4899', icon: '🧠' },
  { id: 'c4', instructor_id: 'i1', kode: 'MK104', nama: 'Pengantar TI', deskripsi: 'Pengantar Teknologi Informasi.', level: 1, session_time: 'evening', color: '#14b8a6', icon: '🖥️' },
  { id: 'c5', instructor_id: 'i1', kode: 'MK201', nama: 'Struktur Data', deskripsi: 'Struktur data fundamental seperti array, linked list, tree.', level: 2, session_time: 'morning', color: '#f59e0b', icon: '📊' },
  { id: 'c6', instructor_id: 'i2', kode: 'MK202', nama: 'Basis Data', deskripsi: 'Konsep database SQL dan NoSQL.', level: 2, session_time: 'morning', color: '#10b981', icon: '🗄️' },
  { id: 'c7', instructor_id: 'i3', kode: 'MK203', nama: 'Pemrograman Web', deskripsi: 'HTML, CSS, JavaScript untuk web development.', level: 2, session_time: 'evening', color: '#ef4444', icon: '🌐' },
  { id: 'c8', instructor_id: 'i1', kode: 'MK301', nama: 'Pemrograman Berorientasi Objek', deskripsi: 'OOP dengan Java dan konsep desain pattern.', level: 3, session_time: 'morning', color: '#6366f1', icon: '📦' },
  { id: 'c9', instructor_id: 'i2', kode: 'MK302', nama: 'Analisis dan Desain Sistem', deskripsi: 'SDLC, UML, dan perancangan sistem.', level: 3, session_time: 'morning', color: '#a855f7', icon: '📐' },
  { id: 'c10', instructor_id: 'i3', kode: 'MK303', nama: 'Jaringan Komputer', deskripsi: 'TCP/IP, routing, switching, network security.', level: 3, session_time: 'evening', color: '#06b6d4', icon: '🌐' },
  { id: 'c11', instructor_id: 'i1', kode: 'MK401', nama: 'Rekayasa Perangkat Lunak', deskripsi: 'Metodologi pengembangan perangkat lunak.', level: 4, session_time: 'morning', color: '#84cc16', icon: '🛠️' },
  { id: 'c12', instructor_id: 'i2', kode: 'MK402', nama: 'Kecerdasan Buatan', deskripsi: 'Machine learning, NLP, dan AI fundamentals.', level: 4, session_time: 'morning', color: '#f97316', icon: '🤖' },
  { id: 'c13', instructor_id: 'i3', kode: 'MK403', nama: 'Keamanan Informasi', deskripsi: 'Kriptografi, ethical hacking, security audit.', level: 4, session_time: 'evening', color: '#dc2626', icon: '🔒' },
  { id: 'c14', instructor_id: 'i1', kode: 'MK501', nama: 'Farmakologi', deskripsi: 'Prinsip dasar farmakologi dan interaksi obat.', level: 5, session_time: 'morning', color: '#0891b2', icon: '💊' },
  { id: 'c15', instructor_id: 'i2', kode: 'MK502', nama: 'Farmasi Klinik', deskripsi: 'Pelayanan kefarmasian di rumah sakit dan klinik.', level: 5, session_time: 'evening', color: '#0d9488', icon: '🏥' },
]

const DEMO_ENROLLMENTS: Record<string, string[]> = {
  's1': ['c1', 'c2'], 's2': ['c1', 'c2'], 's3': ['c1', 'c2'],
  's4': ['c3', 'c4'], 's5': ['c3', 'c4'],
  's6': ['c5', 'c6'], 's7': ['c5', 'c6'], 's8': ['c7'],
  's9': ['c8', 'c9'], 's10': ['c8', 'c9'], 's11': ['c10'],
  's12': ['c11', 'c12'], 's13': ['c11', 'c12'], 's14': ['c13'], 's15': ['c13'],
  's16': ['c14', 'c15'], 's17': ['c14', 'c15'],
  'i1': ['c1', 'c4', 'c5', 'c8', 'c11', 'c14'],
  'i2': ['c2', 'c6', 'c9', 'c12'],
  'i3': ['c3', 'c7', 'c10', 'c13'],
}

const DEMO_LESSONS: Record<string, Lesson[]> = {
  'c1': [
    { id: 'l1', course_id: 'c1', judul: 'Pengantar Pemrograman', konten: 'Apa itu pemrograman?', urutan: 1 },
    { id: 'l2', course_id: 'c1', judul: 'Variabel dan Tipe Data', konten: 'Mengenal variabel dan tipe data.', urutan: 2 },
    { id: 'l3', course_id: 'c1', judul: 'Percabangan (If-Else)', konten: 'Logika percabangan dalam pemrograman.', urutan: 3 },
    { id: 'l4', course_id: 'c1', judul: 'Perulangan (Looping)', konten: 'For, while, dan do-while loops.', urutan: 4 },
  ],
  'c2': [
    { id: 'l5', course_id: 'c2', judul: 'Himpunan', konten: 'Konsep dasar himpunan.', urutan: 1 },
    { id: 'l6', course_id: 'c2', judul: 'Relasi dan Fungsi', konten: 'Relasi dan fungsi dalam matematika.', urutan: 2 },
  ],
}

const DEMO_LESSON_PROGRESS: Record<string, LessonProgress[]> = {
  's1': [
    { id: 'p1', student_id: 's1', lesson_id: 'l1', completed: true, completed_at: new Date().toISOString(), created_at: '', updated_at: '' },
    { id: 'p2', student_id: 's1', lesson_id: 'l2', completed: true, completed_at: new Date().toISOString(), created_at: '', updated_at: '' },
  ],
  's2': [
    { id: 'p3', student_id: 's2', lesson_id: 'l1', completed: true, completed_at: new Date().toISOString(), created_at: '', updated_at: '' },
  ],
}

interface CoursesState {
  courses: Course[]
  currentCourse: Course | null
  lessons: Lesson[]
  lessonProgress: LessonProgress[]
  enrollments: Enrollment[]
  loading: boolean
  error: string | null

  // Supabase data cache
  isDemoMode: boolean
  initialized: boolean
  sbCourses: Course[]
  sbEnrollments: { student_id: string; course_id: string }[]
  sbLessons: Lesson[]
  sbProgress: LessonProgress[]
  sbCourseMap: Record<string, Lesson[]>
  sbProgressMap: Record<string, LessonProgress[]>
}

export const useCoursesStore = defineStore('courses', {
  state: (): CoursesState => ({
    courses: [],
    currentCourse: null,
    lessons: [],
    lessonProgress: [],
    enrollments: [],
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
    sbCourses: [],
    sbEnrollments: [],
    sbLessons: [],
    sbProgress: [],
    sbCourseMap: {},
    sbProgressMap: {},
  }),

  getters: {
    /** Courses for the current user. */
    myCourses(): CourseWithProgress[] {
      const auth = useAuthStore()
      if (!auth.user) return []

      const courses = this.isDemoMode ? this.courses : this.sbCourses
      const enrollMap: Record<string, string[]> = {}

      if (this.isDemoMode) {
        Object.assign(enrollMap, DEMO_ENROLLMENTS)
      } else {
        for (const e of this.sbEnrollments) {
          if (!enrollMap[e.student_id]) enrollMap[e.student_id] = []
          enrollMap[e.student_id].push(e.course_id)
        }
        // Build instructor enrollments from courses
        for (const c of this.sbCourses) {
          if (!enrollMap[c.instructor_id]) enrollMap[c.instructor_id] = []
          if (!enrollMap[c.instructor_id].includes(c.id)) {
            enrollMap[c.instructor_id].push(c.id)
          }
        }
      }

      const courseIds = enrollMap[auth.user.id] || []

      return courseIds.map((cid) => {
        const course = courses.find((c) => c.id === cid)
        if (!course) return null

        if (auth.isInstructor) {
          return { ...course } as CourseWithProgress
        }

        // For students, compute lesson progress
        let courseLessons: Lesson[]
        let progressMap: Record<string, LessonProgress[]>

        if (this.isDemoMode) {
          courseLessons = DEMO_LESSONS[cid] || []
          progressMap = DEMO_LESSON_PROGRESS
        } else {
          courseLessons = this.sbCourseMap[cid] || []
          progressMap = this.sbProgressMap
        }

        const completedLessons = (progressMap[auth.user!.id] || [])
          .filter((p) => courseLessons.some((l) => l.id === p.lesson_id) && p.completed)

        return {
          ...course,
          lessonCount: courseLessons.length,
          completedLessons: completedLessons.length,
          progressPercent: courseLessons.length > 0
            ? Math.round((completedLessons.length / courseLessons.length) * 100)
            : 0,
        } as CourseWithProgress
      }).filter(Boolean) as CourseWithProgress[]
    },

    /** All courses (for admin/instructor overview). */
    allCourses(): Course[] {
      return this.isDemoMode ? this.courses : this.sbCourses
    },

    /** Get lessons for current course. */
    currentLessons(): LessonWithProgress[] {
      const auth = useAuthStore()
      if (!auth.user || !this.currentCourse) return []

      let courseLessons: Lesson[]
      let progress: LessonProgress[]

      if (this.isDemoMode) {
        courseLessons = DEMO_LESSONS[this.currentCourse.id] || []
        progress = DEMO_LESSON_PROGRESS[auth.user.id] || []
      } else {
        courseLessons = this.sbCourseMap[this.currentCourse.id] || []
        progress = this.sbProgressMap[auth.user.id] || []
      }

      return courseLessons.map((lesson) => ({
        ...lesson,
        progress: progress.find((p) => p.lesson_id === lesson.id),
      }))
    },
  },

  actions: {
    /**
     * Initialize store: fetch all data from Supabase in production mode.
     */
    async init() {
      if (this.initialized) return
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          this.loading = true

          // Fetch all courses
          const { data: courses, error: coursesErr } = await supabase.from('courses').select('*').order('level').order('session_time')
          if (coursesErr) throw coursesErr
          if (courses) this.sbCourses = courses as Course[]

          // Fetch enrollments
          const { data: enrollments, error: enrollErr } = await supabase.from('enrollments').select('student_id, course_id')
          if (enrollErr) throw enrollErr
          if (enrollments) this.sbEnrollments = enrollments

          // Fetch all lessons
          const { data: lessons, error: lessonsErr } = await supabase.from('lessons').select('*').order('urutan')
          if (lessonsErr) throw lessonsErr
          if (lessons) {
            this.sbLessons = lessons as Lesson[]
            // Build course → lessons map
            const map: Record<string, Lesson[]> = {}
            for (const l of lessons) {
              if (!map[l.course_id]) map[l.course_id] = []
              map[l.course_id].push(l as Lesson)
            }
            this.sbCourseMap = map
          }

          // Fetch lesson progress
          const { data: progress, error: progressErr } = await supabase.from('lesson_progress').select('*')
          if (progressErr) throw progressErr
          if (progress) {
            this.sbProgress = progress as LessonProgress[]
            // Build student → progress map
            const pMap: Record<string, LessonProgress[]> = {}
            for (const p of progress) {
              if (!pMap[p.student_id]) pMap[p.student_id] = []
              pMap[p.student_id].push(p as LessonProgress)
            }
            this.sbProgressMap = pMap
          }

          // If Supabase returned no courses at all, fall back to demo
          if (this.sbCourses.length === 0) {
            console.warn('Supabase returned zero courses — falling back to demo data.')
            this.isDemoMode = true
          }
        } catch (err) {
          console.error('Failed to fetch courses from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      // Seed reactive courses from demo data
      if (this.isDemoMode) {
        this.courses = [...DEMO_COURSES]
      }

      this.initialized = true
    },

    /** Sync demo data into reactive state to trigger getter re-evaluation. */
    _syncDemo() {
      if (this.isDemoMode) {
        this.courses = [...DEMO_COURSES]
      }
    },

    /**
     * Set the currently viewed course.
     */
    setCurrentCourse(courseId: string) {
      const courses = this.isDemoMode ? this.courses : this.sbCourses
      const course = courses.find((c) => c.id === courseId)
      if (course) {
        this.currentCourse = course
        if (this.isDemoMode) {
          this.lessons = DEMO_LESSONS[courseId] || []
        } else {
          this.lessons = this.sbCourseMap[courseId] || []
        }
      }
    },

    /**
     * Fetch courses for a specific level and session.
     */
    async fetchCoursesByLevel(level: number, sessionTime: string): Promise<Course[]> {
      if (this.isDemoMode) {
        return DEMO_COURSES.filter(
          (c) => c.level === level && c.session_time === sessionTime
        )
      }

      try {
        const supabase = useNuxtApp().$supabase
        const { data } = await supabase
          .from('courses')
          .select('*')
          .eq('level', level)
          .eq('session_time', sessionTime)

        return (data || []) as Course[]
      } catch {
        return []
      }
    },

    /**
     * Mark a lesson as completed for the current student.
     */
    async markLessonCompleted(lessonId: string) {
      const auth = useAuthStore()
      if (!auth.user?.id) return

      if (this.isDemoMode) {
        const existing = DEMO_LESSON_PROGRESS[auth.user.id] || []
        const already = existing.find((p) => p.lesson_id === lessonId)
        if (!already) {
          existing.push({
            id: `p-${Date.now()}`,
            student_id: auth.user.id,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          DEMO_LESSON_PROGRESS[auth.user.id] = existing
        }
        this.lessonProgress = DEMO_LESSON_PROGRESS[auth.user.id] || []
        this._syncDemo()
        return
      }

      // Production: upsert into Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { data: existing } = await supabase
          .from('lesson_progress')
          .select('id')
          .eq('student_id', auth.user.id)
          .eq('lesson_id', lessonId)
          .maybeSingle()

        if (existing) {
          // Already exists — update
          await supabase
            .from('lesson_progress')
            .update({ completed: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          // Create new
          await supabase
            .from('lesson_progress')
            .insert({
              student_id: auth.user.id,
              lesson_id: lessonId,
              completed: true,
              completed_at: new Date().toISOString(),
            })
        }

        // Refresh local progress map
        const { data: refreshed } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('student_id', auth.user.id)

        if (refreshed) {
          this.sbProgressMap[auth.user.id] = refreshed as LessonProgress[]
        }
      } catch (err) {
        console.error('Failed to save lesson progress:', err)
      }
    },

    /**
     * Toggle a lesson's completed status for the current student.
     */
    async toggleLessonCompleted(lessonId: string) {
      const auth = useAuthStore()
      if (!auth.user?.id) return

      if (this.isDemoMode) {
        const existing = DEMO_LESSON_PROGRESS[auth.user.id] || []
        const already = existing.find((p) => p.lesson_id === lessonId)
        if (already) {
          // Remove from progress (unmark)
          DEMO_LESSON_PROGRESS[auth.user.id] = existing.filter((p) => p.lesson_id !== lessonId)
        } else {
          // Mark as completed
          existing.push({
            id: `p-${Date.now()}`,
            student_id: auth.user.id,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          DEMO_LESSON_PROGRESS[auth.user.id] = existing
        }
        this.lessonProgress = DEMO_LESSON_PROGRESS[auth.user.id] || []
        this._syncDemo()
        return
      }

      // Production: toggle in Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { data: existing } = await supabase
          .from('lesson_progress')
          .select('id, completed')
          .eq('student_id', auth.user.id)
          .eq('lesson_id', lessonId)
          .maybeSingle()

        if (existing) {
          const newCompleted = !existing.completed
          await supabase
            .from('lesson_progress')
            .update({
              completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('lesson_progress')
            .insert({
              student_id: auth.user.id,
              lesson_id: lessonId,
              completed: true,
              completed_at: new Date().toISOString(),
            })
        }

        // Refresh local progress map
        const { data: refreshed } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('student_id', auth.user.id)

        if (refreshed) {
          this.sbProgressMap[auth.user.id] = refreshed as LessonProgress[]
        }
      } catch (err) {
        console.error('Failed to toggle lesson progress:', err)
      }
    },

    /**
     * Add a new lesson to a course (instructor).
     */
    async addLesson(courseId: string, judul: string, konten: string) {
      if (this.isDemoMode) {
        if (!DEMO_LESSONS[courseId]) DEMO_LESSONS[courseId] = []
        const existing = DEMO_LESSONS[courseId]
        const maxOrder = existing.reduce((max, l) => Math.max(max, l.urutan), 0)
        existing.push({
          id: `l-${Date.now()}`,
          course_id: courseId,
          judul,
          konten,
          urutan: maxOrder + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        if (this.currentCourse?.id === courseId) {
          this.lessons = DEMO_LESSONS[courseId] || []
        }
        this._syncDemo()
        return
      }

      // Production: insert into Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const maxUrutan = this.sbCourseMap[courseId]?.length || 0

        const { data } = await supabase
          .from('lessons')
          .insert({
            course_id: courseId,
            judul,
            konten,
            urutan: maxUrutan + 1,
          })
          .select()
          .single()

        if (data) {
          if (!this.sbCourseMap[courseId]) this.sbCourseMap[courseId] = []
          this.sbCourseMap[courseId].push(data as Lesson)
          if (this.currentCourse?.id === courseId) {
            this.lessons = this.sbCourseMap[courseId] || []
          }
        }
      } catch (err) {
        console.error('Failed to add lesson:', err)
      }
    },

    /**
     * Delete a lesson (instructor).
     */
    async deleteLesson(lessonId: string) {
      if (this.isDemoMode) {
        for (const courseId in DEMO_LESSONS) {
          const idx = DEMO_LESSONS[courseId].findIndex((l) => l.id === lessonId)
          if (idx >= 0) {
            DEMO_LESSONS[courseId].splice(idx, 1)
            break
          }
        }
        if (this.currentCourse) {
          this.lessons = DEMO_LESSONS[this.currentCourse.id] || []
        }
        return
      }

      // Production: delete from Supabase
      try {
        const supabase = useNuxtApp().$supabase
        await supabase.from('lessons').delete().eq('id', lessonId)

        // Remove from local cache
        for (const courseId in this.sbCourseMap) {
          this.sbCourseMap[courseId] = this.sbCourseMap[courseId].filter((l) => l.id !== lessonId)
        }
        if (this.currentCourse) {
          this.lessons = this.sbCourseMap[this.currentCourse.id] || []
        }
      } catch (err) {
        console.error('Failed to delete lesson:', err)
      }
    },

    /**
     * Update an existing lesson (instructor).
     */
    async updateLesson(lessonId: string, data: { judul?: string; konten?: string }) {
      if (this.isDemoMode) {
        for (const courseId in DEMO_LESSONS) {
          const idx = DEMO_LESSONS[courseId].findIndex((l) => l.id === lessonId)
          if (idx >= 0) {
            if (data.judul !== undefined) DEMO_LESSONS[courseId][idx].judul = data.judul
            if (data.konten !== undefined) DEMO_LESSONS[courseId][idx].konten = data.konten
            DEMO_LESSONS[courseId][idx].updated_at = new Date().toISOString()
            break
          }
        }
        if (this.currentCourse) {
          this.lessons = DEMO_LESSONS[this.currentCourse.id] || []
        }
        return
      }

      // Production: update in Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (data.judul !== undefined) payload.judul = data.judul
        if (data.konten !== undefined) payload.konten = data.konten

        await supabase.from('lessons').update(payload).eq('id', lessonId)

        // Update local cache
        for (const courseId in this.sbCourseMap) {
          const idx = this.sbCourseMap[courseId].findIndex((l) => l.id === lessonId)
          if (idx >= 0) {
            Object.assign(this.sbCourseMap[courseId][idx], payload)
            break
          }
        }
        if (this.currentCourse) {
          this.lessons = this.sbCourseMap[this.currentCourse.id] || []
        }
      } catch (err) {
        console.error('Failed to update lesson:', err)
      }
    },

    // ── Admin: Course CRUD ─────────────────────────────────────

    /**
     * Add a new course (admin).
     */
    async addCourse(data: {
      kode: string
      nama: string
      deskripsi: string
      level: number
      session_time: 'morning' | 'evening'
      instructor_id: string
      color: string
      icon: string
    }) {
      if (this.isDemoMode) {
        const maxNum = DEMO_COURSES.reduce((max, c) => {
          const num = parseInt(c.id.replace('c', ''))
          return num > max ? num : max
        }, 0)
        DEMO_COURSES.push({
          id: `c${maxNum + 1}`,
          instructor_id: data.instructor_id,
          kode: data.kode,
          nama: data.nama,
          deskripsi: data.deskripsi,
          level: data.level,
          session_time: data.session_time,
          color: data.color,
          icon: data.icon,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        // Also add instructor enrollment
        if (!DEMO_ENROLLMENTS[data.instructor_id]) DEMO_ENROLLMENTS[data.instructor_id] = []
        DEMO_ENROLLMENTS[data.instructor_id].push(`c${maxNum + 1}`)
        this._syncDemo()
        return
      }

      // Production: insert into Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { data: newCourse, error } = await supabase
          .from('courses')
          .insert({
            kode: data.kode,
            nama: data.nama,
            deskripsi: data.deskripsi,
            level: data.level,
            session_time: data.session_time,
            instructor_id: data.instructor_id,
            color: data.color,
            icon: data.icon,
          })
          .select()
          .single()

        if (error) throw error
        if (!newCourse) throw new Error('Gagal menambahkan mata kuliah — tidak ada data yang dikembalikan.')

        this.sbCourses.push(newCourse as Course)
      } catch (err) {
        console.error('Failed to add course:', err)
        throw err
      }
    },

    /**
     * Update an existing course (admin).
     */
    async updateCourse(id: string, data: Partial<{
      kode: string
      nama: string
      deskripsi: string
      level: number
      session_time: 'morning' | 'evening'
      instructor_id: string
      color: string
      icon: string
    }>) {
      if (this.isDemoMode) {
        const idx = DEMO_COURSES.findIndex((c) => c.id === id)
        if (idx >= 0) {
          DEMO_COURSES[idx] = { ...DEMO_COURSES[idx], ...data, updated_at: new Date().toISOString() }
        }
        this._syncDemo()
        return
      }

      // Production: update in Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { error } = await supabase.from('courses').update(data).eq('id', id)

        if (error) throw error

        // Update local cache
        const idx = this.sbCourses.findIndex((c) => c.id === id)
        if (idx >= 0) {
          this.sbCourses[idx] = { ...this.sbCourses[idx], ...data } as Course
        }
      } catch (err) {
        console.error('Failed to update course:', err)
        throw err
      }
    },

    /**
     * Delete a course (admin).
     */
    async deleteCourse(id: string) {
      if (this.isDemoMode) {
        const idx = DEMO_COURSES.findIndex((c) => c.id === id)
        if (idx >= 0) {
          DEMO_COURSES.splice(idx, 1)
        }
        // Clean up enrollments
        for (const userId in DEMO_ENROLLMENTS) {
          DEMO_ENROLLMENTS[userId] = DEMO_ENROLLMENTS[userId].filter((cid) => cid !== id)
        }
        // Clean up lessons
        delete DEMO_LESSONS[id]
        // Clean up progress
        for (const studentId in DEMO_LESSON_PROGRESS) {
          DEMO_LESSON_PROGRESS[studentId] = DEMO_LESSON_PROGRESS[studentId].filter(
            (p) => !DEMO_LESSONS[id]?.some((l) => l.id === p.lesson_id)
          )
        }
        this._syncDemo()
        return
      }

      // Production: delete from Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { error } = await supabase.from('courses').delete().eq('id', id)

        if (error) throw error

        // Remove from local cache
        this.sbCourses = this.sbCourses.filter((c) => c.id !== id)
        this.sbEnrollments = this.sbEnrollments.filter((e) => e.course_id !== id)
        delete this.sbCourseMap[id]
      } catch (err) {
        console.error('Failed to delete course:', err)
        throw err
      }
    },
  },
})
