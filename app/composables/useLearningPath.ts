/**
 * useLearningPath — wires the pure learning-path logic (app/utils/learningPath.ts)
 * to the quiz, courses and auth stores for /student/learning-path.
 *
 * Per-question answers:
 *   - Supabase mode: read the student's own rows from `quiz_answers` (RLS).
 *   - Demo mode: a small fixed set consistent with the demo attempts in
 *     stores/quiz.ts (the quiz store itself only keeps per-attempt scores).
 *   Without them, topic scores are estimated from the attempt percentage.
 */
import { buildLearningPath, LP_WEAK_THRESHOLD, type LpAnswer, type CourseLearningPath } from '~/utils/learningPath'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'
import { useQuizStore } from '~/stores/quiz'

/** Demo per-question answers matching DEMO_ATTEMPTS (qa1: s1 qz2 3/3, qa2: s2 qz2 2/3, qa3: s1 qz1 4/5). */
export const DEMO_QUIZ_ANSWERS: LpAnswer[] = [
  // qa3 — s1, qz1, 4/5 (salah di soal perulangan)
  ...['qq1', 'qq2', 'qq3', 'qq5'].map((id) => ({ quiz_id: 'qz1', student_id: 's1', question_id: id, is_correct: true, submitted_at: '2025-10-02T09:25:00Z' })),
  { quiz_id: 'qz1', student_id: 's1', question_id: 'qq4', is_correct: false, submitted_at: '2025-10-02T09:25:00Z' },
  // qa1 — s1, qz2, 3/3
  ...['qq6', 'qq7', 'qq8'].map((id) => ({ quiz_id: 'qz2', student_id: 's1', question_id: id, is_correct: true, submitted_at: '2025-09-11T08:12:00Z' })),
  // qa2 — s2, qz2, 2/3 (salah di soal tipe data)
  { quiz_id: 'qz2', student_id: 's2', question_id: 'qq6', is_correct: true, submitted_at: '2025-09-11T09:10:00Z' },
  { quiz_id: 'qz2', student_id: 's2', question_id: 'qq7', is_correct: false, submitted_at: '2025-09-11T09:10:00Z' },
  { quiz_id: 'qz2', student_id: 's2', question_id: 'qq8', is_correct: true, submitted_at: '2025-09-11T09:10:00Z' },
]

export function useLearningPath() {
  const auth = useAuthStore()
  const courses = useCoursesStore()
  const quiz = useQuizStore()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const answers = ref<LpAnswer[]>([])
  const threshold = ref(LP_WEAK_THRESHOLD)

  async function load() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([courses.init(), quiz.init()])
      const userId = auth.user?.id
      if (!userId) {
        answers.value = []
      } else if (quiz.isDemoMode) {
        answers.value = DEMO_QUIZ_ANSWERS.filter((a) => a.student_id === userId)
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          const { data, error: err } = await supabase
            .from('quiz_answers')
            .select('quiz_id, student_id, question_id, is_correct, submitted_at')
            .eq('student_id', userId)
          if (err) throw err
          answers.value = (data || []) as LpAnswer[]
        } catch (err) {
          // Not fatal: scores fall back to estimates from attempt percentages.
          console.warn('[learning-path] quiz_answers unavailable, using estimates:', err)
          answers.value = []
        }
      }
    } catch (err: any) {
      error.value = err?.message || 'Gagal memuat data jalur belajar.'
    } finally {
      loading.value = false
    }
  }

  const paths = computed<CourseLearningPath[]>(() => {
    const userId = auth.user?.id
    if (!userId) return []
    const myCourses = courses.myCourses
    // Lessons with text of the student's courses (same source as the AI tutor).
    const lessons = courses.getLessonsForAi().map((l, i) => ({ id: l.id, course_id: l.course_id, judul: l.judul, konten: l.konten, urutan: i }))
    return buildLearningPath({
      studentId: userId,
      courses: myCourses.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama })),
      quizzes: quiz.quizzes,
      questions: quiz.questions,
      attempts: quiz.attempts,
      answers: answers.value,
      lessons,
      threshold: threshold.value,
    })
  })

  return { load, loading, error, paths, threshold }
}
