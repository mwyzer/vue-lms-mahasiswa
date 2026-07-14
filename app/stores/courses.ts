/**
 * Courses Store — Manages course, lesson, and enrollment data.
 *
 * Features:
 * - Fetches courses by level/session for students
 * - Fetches courses by instructor for instructors
 * - Lesson progress tracking
 * - Demo mode support
 */
import { defineStore } from 'pinia'
import type { Course, Lesson, LessonProgress, Enrollment } from '~/types/database'
import type { CourseWithProgress, LessonWithProgress } from '~/types/course'
import { useAuthStore } from './auth'

// ── Demo data ─────────────────────────────────────────
const DEMO_COURSES: Course[] = [
  // Level 1 - Morning
  { id: 'c1', instructor_id: 'i1', kode: 'MK101', nama: 'Pemrograman Dasar', deskripsi: 'Belajar dasar-dasar pemrograman dengan Python.', level: 1, session_time: 'morning', color: '#3b82f6', icon: '💻' },
  { id: 'c2', instructor_id: 'i2', kode: 'MK102', nama: 'Matematika Diskrit', deskripsi: 'Konsep matematika untuk ilmu komputer.', level: 1, session_time: 'morning', color: '#8b5cf6', icon: '🔢' },
  // Level 1 - Evening
  { id: 'c3', instructor_id: 'i3', kode: 'MK103', nama: 'Logika Informatika', deskripsi: 'Logika proposisional dan predikat.', level: 1, session_time: 'evening', color: '#ec4899', icon: '🧠' },
  { id: 'c4', instructor_id: 'i1', kode: 'MK104', nama: 'Pengantar TI', deskripsi: 'Pengantar Teknologi Informasi.', level: 1, session_time: 'evening', color: '#14b8a6', icon: '🖥️' },
  // Level 2 - Morning
  { id: 'c5', instructor_id: 'i1', kode: 'MK201', nama: 'Struktur Data', deskripsi: 'Struktur data fundamental seperti array, linked list, tree.', level: 2, session_time: 'morning', color: '#f59e0b', icon: '📊' },
  { id: 'c6', instructor_id: 'i2', kode: 'MK202', nama: 'Basis Data', deskripsi: 'Konsep database SQL dan NoSQL.', level: 2, session_time: 'morning', color: '#10b981', icon: '🗄️' },
  // Level 2 - Evening
  { id: 'c7', instructor_id: 'i3', kode: 'MK203', nama: 'Pemrograman Web', deskripsi: 'HTML, CSS, JavaScript untuk web development.', level: 2, session_time: 'evening', color: '#ef4444', icon: '🌐' },
  // Level 3 - Morning
  { id: 'c8', instructor_id: 'i1', kode: 'MK301', nama: 'Pemrograman Berorientasi Objek', deskripsi: 'OOP dengan Java dan konsep desain pattern.', level: 3, session_time: 'morning', color: '#6366f1', icon: '📦' },
  { id: 'c9', instructor_id: 'i2', kode: 'MK302', nama: 'Analisis dan Desain Sistem', deskripsi: 'SDLC, UML, dan perancangan sistem.', level: 3, session_time: 'morning', color: '#a855f7', icon: '📐' },
  // Level 3 - Evening
  { id: 'c10', instructor_id: 'i3', kode: 'MK303', nama: 'Jaringan Komputer', deskripsi: 'TCP/IP, routing, switching, network security.', level: 3, session_time: 'evening', color: '#06b6d4', icon: '🌐' },
  // Level 4 - Morning
  { id: 'c11', instructor_id: 'i1', kode: 'MK401', nama: 'Rekayasa Perangkat Lunak', deskripsi: 'Metodologi pengembangan perangkat lunak.', level: 4, session_time: 'morning', color: '#84cc16', icon: '🛠️' },
  { id: 'c12', instructor_id: 'i2', kode: 'MK402', nama: 'Kecerdasan Buatan', deskripsi: 'Machine learning, NLP, dan AI fundamentals.', level: 4, session_time: 'morning', color: '#f97316', icon: '🤖' },
  // Level 4 - Evening
  { id: 'c13', instructor_id: 'i3', kode: 'MK403', nama: 'Keamanan Informasi', deskripsi: 'Kriptografi, ethical hacking, security audit.', level: 4, session_time: 'evening', color: '#dc2626', icon: '🔒' },
]

const DEMO_ENROLLMENTS: Record<string, string[]> = {
  // Student enrollments by student_id → course_id[]
  's1': ['c1', 'c2'],
  's2': ['c1', 'c2'],
  's3': ['c1', 'c2'],
  's4': ['c3', 'c4'],
  's5': ['c3', 'c4'],
  's6': ['c5', 'c6'],
  's7': ['c5', 'c6'],
  's8': ['c7'],
  's9': ['c8', 'c9'],
  's10': ['c8', 'c9'],
  's11': ['c10'],
  's12': ['c11', 'c12'],
  's13': ['c11', 'c12'],
  's14': ['c13'],
  's15': ['c13'],
  // Instructors (for courses they teach)
  'i1': ['c1', 'c4', 'c5', 'c8', 'c11'],
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
  }),

  getters: {
    /** Courses for the current student (based on their enrollments). */
    myCourses(state): CourseWithProgress[] {
      const auth = useAuthStore()
      if (!auth.user) return []

      if (auth.isStudent) {
        const enrolledIds = DEMO_ENROLLMENTS[auth.user.id] || []
        return enrolledIds.map((cid) => {
          const course = DEMO_COURSES.find((c) => c.id === cid)
          if (!course) return null

          const courseLessons = DEMO_LESSONS[cid] || []
          const completedLessons = (DEMO_LESSON_PROGRESS[auth.user!.id] || [])
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
      }

      if (auth.isInstructor) {
        const courseIds = DEMO_ENROLLMENTS[auth.user.id] || []
        return courseIds.map((cid) => {
          const course = DEMO_COURSES.find((c) => c.id === cid)
          if (!course) return null
          return { ...course } as CourseWithProgress
        }).filter(Boolean) as CourseWithProgress[]
      }

      return []
    },

    /** All courses (for admin/instructor overview). */
    allCourses(): Course[] {
      return DEMO_COURSES
    },

    /** Get lessons for current course. */
    currentLessons(state): LessonWithProgress[] {
      const auth = useAuthStore()
      if (!auth.user || !state.currentCourse) return []

      const courseLessons = DEMO_LESSONS[state.currentCourse.id] || []
      const progress = DEMO_LESSON_PROGRESS[auth.user.id] || []

      return courseLessons.map((lesson) => ({
        ...lesson,
        progress: progress.find((p) => p.lesson_id === lesson.id),
      }))
    },
  },

  actions: {
    /**
     * Set the currently viewed course.
     */
    setCurrentCourse(courseId: string) {
      const course = DEMO_COURSES.find((c) => c.id === courseId)
      if (course) {
        this.currentCourse = course
        this.lessons = DEMO_LESSONS[courseId] || []
      }
    },

    /**
     * Fetch courses for a specific level and session.
     */
    fetchCoursesByLevel(level: number, sessionTime: string): Course[] {
      return DEMO_COURSES.filter(
        (c) => c.level === level && c.session_time === sessionTime
      )
    },

    /**
     * Mark a lesson as completed for the current student.
     */
    markLessonCompleted(lessonId: string) {
      const auth = useAuthStore()
      if (!auth.user?.id) return

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

      // Refresh local state
      this.lessonProgress = DEMO_LESSON_PROGRESS[auth.user.id] || []
    },

    /**
     * Add a new lesson to a course (instructor, demo mode).
     */
    addLesson(courseId: string, judul: string, konten: string) {
      if (!DEMO_LESSONS[courseId]) {
        DEMO_LESSONS[courseId] = []
      }
      const existing = DEMO_LESSONS[courseId]
      const maxOrder = existing.reduce((max, l) => Math.max(max, l.urutan), 0)
      const newLesson: Lesson = {
        id: `l-${Date.now()}`,
        course_id: courseId,
        judul,
        konten,
        urutan: maxOrder + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      existing.push(newLesson)

      // Refresh local state
      if (this.currentCourse?.id === courseId) {
        this.lessons = DEMO_LESSONS[courseId] || []
      }
    },

    /**
     * Delete a lesson (instructor, demo mode).
     */
    deleteLesson(lessonId: string) {
      for (const courseId in DEMO_LESSONS) {
        const idx = DEMO_LESSONS[courseId].findIndex((l) => l.id === lessonId)
        if (idx >= 0) {
          DEMO_LESSONS[courseId].splice(idx, 1)
          break
        }
      }

      // Refresh local state
      if (this.currentCourse) {
        this.lessons = DEMO_LESSONS[this.currentCourse.id] || []
      }
    },
  },
})
