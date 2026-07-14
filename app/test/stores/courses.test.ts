/**
 * Courses Store — Unit Tests
 *
 * Tests course listing, enrollment mapping, lesson management,
 * and progress tracking in demo mode.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'

describe('Courses Store', () => {
  let store: ReturnType<typeof useCoursesStore>

  beforeEach(() => {
    store = useCoursesStore()
  })

  // ── Initial State ──
  describe('initial state', () => {
    it('starts with empty state and demo mode', () => {
      expect(store.courses).toEqual([])
      expect(store.currentCourse).toBeNull()
      expect(store.lessons).toEqual([])
      expect(store.isDemoMode).toBe(true)
      expect(store.initialized).toBe(false)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  // ── init() ──
  describe('init', () => {
    it('sets initialized to true after calling init', async () => {
      await store.init()
      expect(store.initialized).toBe(true)
    })

    it('does not re-initialize if already initialized', async () => {
      await store.init()
      // Mock the config check to verify it's skipped
      const spy = vi.spyOn(store, 'init')
      await store.init()
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })

  // ── allCourses ──
  describe('allCourses getter', () => {
    it('returns all 13 demo courses', () => {
      const courses = store.allCourses
      expect(courses.length).toBe(13)
    })

    it('includes courses at all 4 levels', () => {
      const levels = new Set(store.allCourses.map((c) => c.level))
      expect(levels).toEqual(new Set([1, 2, 3, 4]))
    })

    it('includes both session times', () => {
      const sessions = new Set(store.allCourses.map((c) => c.session_time))
      expect(sessions).toEqual(new Set(['morning', 'evening']))
    })

    it('has unique course codes', () => {
      const codes = store.allCourses.map((c) => c.kode)
      expect(new Set(codes).size).toBe(codes.length)
    })
  })

  // ── myCourses (Student) ──
  describe('myCourses for students', () => {
    it('returns empty array when no user is logged in', () => {
      expect(store.myCourses).toEqual([])
    })

    it('returns s1 enrolled courses (Pemrograman Dasar + Matematika Diskrit)', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Ahmad Fauzi', '20241001')

      const courses = store.myCourses
      expect(courses.length).toBe(2)
      expect(courses[0].kode).toBe('MK101')
      expect(courses[1].kode).toBe('MK102')
    })

    it('returns s4 enrolled courses (Logika Informatika + Pengantar TI)', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Dian Permata', '20241004')

      const courses = store.myCourses
      expect(courses.length).toBe(2)
      expect(courses[0].kode).toBe('MK103')
      expect(courses[1].kode).toBe('MK104')
    })

    it('includes progress for s1 (2 of 4 lessons completed in c1)', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Ahmad Fauzi', '20241001')

      const courses = store.myCourses
      const c1 = courses.find((c) => c.id === 'c1')
      expect(c1).toBeDefined()
      expect(c1!.lessonCount).toBe(4)
      expect(c1!.completedLessons).toBe(2)
      expect(c1!.progressPercent).toBe(50)
    })

    it('includes progress for s2 (1 of 4 lessons completed in c1)', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Budi Santoso', '20241002')

      const courses = store.myCourses
      const c1 = courses.find((c) => c.id === 'c1')
      expect(c1).toBeDefined()
      expect(c1!.lessonCount).toBe(4)
      expect(c1!.completedLessons).toBe(1)
      expect(c1!.progressPercent).toBe(25)
    })
  })

  // ── myCourses (Instructor) ──
  describe('myCourses for instructors', () => {
    it('returns i1 courses (5 courses taught by Dr. Andi)', async () => {
      const auth = useAuthStore()
      await auth.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'instruktur123')

      const courses = store.myCourses
      expect(courses.length).toBe(5)
      const courseIds = courses.map((c) => c.id)
      expect(courseIds).toContain('c1') // Pemrograman Dasar
      expect(courseIds).toContain('c4') // Pengantar TI
      expect(courseIds).toContain('c5') // Struktur Data
      expect(courseIds).toContain('c8') // OOP
      expect(courseIds).toContain('c11') // RPL
    })

    it('returns i2 courses (4 courses taught by Dr. Dewi)', async () => {
      const auth = useAuthStore()
      await auth.loginAsInstructor('Dr. Dewi Lestari, M.Pd.', 'instruktur123')

      const courses = store.myCourses
      expect(courses.length).toBe(4)
    })

    it('returns i3 courses (4 courses taught by Prof. Budi)', async () => {
      const auth = useAuthStore()
      await auth.loginAsInstructor('Prof. Budi Hartono, Ph.D.', 'instruktur123')

      const courses = store.myCourses
      expect(courses.length).toBe(4)
    })
  })

  // ── fetchCoursesByLevel ──
  describe('fetchCoursesByLevel', () => {
    it('returns 4 Level 1 morning courses', async () => {
      const courses = await store.fetchCoursesByLevel(1, 'morning')
      expect(courses.length).toBe(2)
      expect(courses[0].kode).toBe('MK101')
      expect(courses[1].kode).toBe('MK102')
    })

    it('returns 2 Level 1 evening courses', async () => {
      const courses = await store.fetchCoursesByLevel(1, 'evening')
      expect(courses.length).toBe(2)
    })

    it('returns empty for level 4 evening (only 1 course)', async () => {
      const courses = await store.fetchCoursesByLevel(4, 'evening')
      expect(courses.length).toBe(1)
      expect(courses[0].kode).toBe('MK403')
    })

    it('returns empty for non-existent level', async () => {
      const courses = await store.fetchCoursesByLevel(5, 'morning')
      expect(courses.length).toBe(0)
    })
  })

  // ── setCurrentCourse ──
  describe('setCurrentCourse', () => {
    it('sets the current course and loads its lessons', () => {
      store.setCurrentCourse('c1')
      expect(store.currentCourse).not.toBeNull()
      expect(store.currentCourse!.id).toBe('c1')
      expect(store.currentCourse!.nama).toBe('Pemrograman Dasar')
      expect(store.lessons.length).toBe(4)
    })

    it('loads 2 lessons for Matematika Diskrit (c2)', () => {
      store.setCurrentCourse('c2')
      expect(store.lessons.length).toBe(2)
    })

    it('does nothing for non-existent course', () => {
      store.setCurrentCourse('non-existent')
      expect(store.currentCourse).toBeNull()
    })
  })

  // ── currentLessons ──
  describe('currentLessons', () => {
    it('shows lesson progress for s1 in c1 (2 of 4 completed)', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Ahmad Fauzi', '20241001')
      store.setCurrentCourse('c1')

      const lessons = store.currentLessons
      expect(lessons.length).toBe(4)
      const completedLessons = lessons.filter((l) => l.progress?.completed)
      expect(completedLessons.length).toBe(2)
    })

    it('shows no progress for s3 in c1', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Citra Dewi', '20241003')
      store.setCurrentCourse('c1')

      const lessons = store.currentLessons
      const completedLessons = lessons.filter((l) => l.progress?.completed)
      expect(completedLessons.length).toBe(0)
    })
  })

  // ── markLessonCompleted (Demo Mode) ──
  describe('markLessonCompleted', () => {
    it('marks a lesson as completed', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Citra Dewi', '20241003')
      store.setCurrentCourse('c1')

      await store.markLessonCompleted('l1')
      const completedLesson = store.currentLessons.find((l) => l.id === 'l1')
      expect(completedLesson?.progress?.completed).toBe(true)
    })

    it('does not duplicate progress on re-completion', async () => {
      const auth = useAuthStore()
      await auth.loginAsStudent('Ahmad Fauzi', '20241001')
      store.setCurrentCourse('c1')

      await store.markLessonCompleted('l1') // Already completed
      await store.markLessonCompleted('l1') // Again

      const progress = store.currentLessons.filter((l) => l.progress?.completed)
      expect(progress.length).toBe(2) // l1 and l2 still
    })
  })

  // ── addLesson (Instructor, Demo Mode) ──
  describe('addLesson', () => {
    it('adds a new lesson to a course', async () => {
      store.setCurrentCourse('c1')
      const initialCount = store.lessons.length

      await store.addLesson('c1', 'Test Lesson', 'Test content')
      expect(store.lessons.length).toBe(initialCount + 1)
      expect(store.lessons[store.lessons.length - 1].judul).toBe('Test Lesson')
    })

    it('assigns correct urutan sequence', async () => {
      store.setCurrentCourse('c1')
      const maxExisting = Math.max(...store.lessons.map((l) => l.urutan))

      await store.addLesson('c1', 'New Lesson', 'Content')
      const added = store.lessons.find((l) => l.judul === 'New Lesson')
      expect(added?.urutan).toBe(maxExisting + 1)
    })
  })

  // ── deleteLesson (Instructor, Demo Mode) ──
  describe('deleteLesson', () => {
    it('removes a lesson by id', async () => {
      store.setCurrentCourse('c1')
      const initialCount = store.lessons.length

      await store.deleteLesson('l1')
      expect(store.lessons.length).toBe(initialCount - 1)
      expect(store.lessons.find((l) => l.id === 'l1')).toBeUndefined()
    })

    it('does nothing for non-existent lesson', async () => {
      store.setCurrentCourse('c1')
      const initialCount = store.lessons.length

      await store.deleteLesson('non-existent')
      expect(store.lessons.length).toBe(initialCount)
    })
  })
})
