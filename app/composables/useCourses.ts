/**
 * useCourses — Composable for course-related operations.
 */
import { useCoursesStore } from '~/stores/courses'

export function useCourses() {
  const store = useCoursesStore()

  return {
    // State
    courses: computed(() => store.courses),
    myCourses: computed(() => store.myCourses),
    currentCourse: computed(() => store.currentCourse),
    lessons: computed(() => store.lessons),
    lessonProgress: computed(() => store.lessonProgress),
    loading: computed(() => store.loading),

    // Actions
    setCurrentCourse: (id: string) => store.setCurrentCourse(id),
    fetchCoursesByLevel: (level: number, session: string) =>
      store.fetchCoursesByLevel(level, session),
    markLessonCompleted: (lessonId: string) =>
      store.markLessonCompleted(lessonId),
    toggleLessonCompleted: (lessonId: string) =>
      store.toggleLessonCompleted(lessonId),
    addLesson: (courseId: string, judul: string, konten: string) =>
      store.addLesson(courseId, judul, konten),
    deleteLesson: (lessonId: string) =>
      store.deleteLesson(lessonId),
  }
}
