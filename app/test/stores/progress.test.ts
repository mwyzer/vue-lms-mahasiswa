/**
 * Progress Store — Unit Tests (demo mode)
 *
 * Derived activity, streak, badge evaluation + notifications, explicit logging,
 * live hooks on the source stores, persistence and certificate issuance.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProgressStore } from '~/stores/progress'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'
import { useQuizStore } from '~/stores/quiz'
import { useNotificationsStore } from '~/stores/notifications'
import { useUiStore } from '~/stores/ui'
import { VERIFICATION_CODE_RE } from '~/lib/certificate'

async function login(nama: string, npm: string) {
  await useAuthStore().init()
  expect(await useAuthStore().loginAsStudent(nama, npm, 'mahasiswa123')).toBe(true)
  await useNotificationsStore().init()
  const progress = useProgressStore()
  await progress.init()
  return progress
}

const earnedIds = () => useProgressStore().earned.map((e) => e.badge_id)
const myNotifTitles = () => useNotificationsStore().mine.map((n) => n.judul)

describe('progress store (demo mode)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is empty when signed out', async () => {
    const progress = useProgressStore()
    await progress.init()
    expect(progress.activities).toEqual([])
    expect(await progress.evaluate()).toEqual([])
  })

  it('derives activity from lessons, quizzes, submissions and forum, plus the demo seed', async () => {
    const progress = await login('Ahmad Fauzi', '20241001')
    const types = new Set(progress.activities.map((a) => a.tipe))
    expect(types).toEqual(new Set(['lesson_completed', 'quiz_submitted', 'assignment_submitted', 'forum_post', 'flashcard_reviewed']))
    expect(progress.stats.lessonsCompleted).toBe(2) // l1, l2
    expect(progress.stats.perfectQuizzes).toBe(1) // qa1 = 100%
    // Seed: 5 previous days of flashcards + lessons completed today.
    expect(progress.streak.current).toBe(6)
    expect(progress.streak.activeToday).toBe(true)
  })

  it('awards badges once and notifies through the notifications store', async () => {
    const progress = await login('Ahmad Fauzi', '20241001')
    expect(earnedIds()).toEqual(expect.arrayContaining(['pemula', 'streak-3', 'nilai-sempurna']))
    expect(earnedIds()).not.toContain('streak-7')
    expect(myNotifTitles().some((t) => t.includes('Nilai Sempurna'))).toBe(true)
    expect(useUiStore().toasts.some((t) => t.message.includes('badge'))).toBe(true)

    const before = useNotificationsStore().mine.length
    expect(await progress.evaluate()).toEqual([])
    expect(useNotificationsStore().mine.length).toBe(before)
  })

  it('record() logs activity, persists it and can unlock a badge', async () => {
    const progress = await login('Ahmad Fauzi', '20241001')
    expect(earnedIds()).not.toContain('pengulang')
    await progress.record('flashcard_reviewed', 'deck-1', 'c1', { count: 30 })
    expect(progress.stats.flashcardReviews).toBe(5 * 8 + 30)
    expect(earnedIds()).toContain('pengulang')
    expect(myNotifTitles().some((t) => t.includes('Ahli Flashcard'))).toBe(true)

    const saved = JSON.parse(localStorage.getItem('lms-progress-v1:s1')!)
    expect(saved.logged.some((a: { ref_id: string }) => a.ref_id === 'deck-1')).toBe(true)
    expect(saved.earned.map((e: { badge_id: string }) => e.badge_id)).toContain('pengulang')

    // New app session (fresh Pinia) restores from storage without re-awarding.
    setActivePinia(createPinia())
    const again = await login('Ahmad Fauzi', '20241001')
    expect(again.earned.map((e) => e.badge_id)).toContain('pengulang')
    expect(again.stats.flashcardReviews).toBe(70)
  })

  it('observes submitQuiz and records the best score (perfect retake ⇒ Nilai Sempurna)', async () => {
    const progress = await login('Budi Santoso', '20241002')
    expect(earnedIds()).not.toContain('nilai-sempurna') // qa2 = 67%
    const quiz = useQuizStore()
    quiz.startQuiz('qz2')
    for (const q of quiz.questionsForQuiz('qz2')) quiz.answerQuestion(q.id, q.jawaban_benar)
    quiz.submitQuiz('s2')
    await new Promise((r) => setTimeout(r, 0))
    expect(progress.logged.some((a) => a.tipe === 'quiz_submitted' && a.meta?.percentage === 100)).toBe(true)
    expect(earnedIds()).toContain('nilai-sempurna')
    expect(progress.activities.filter((a) => a.tipe === 'quiz_submitted' && a.ref_id === 'qz2')).toHaveLength(1)
  })

  it('issues a certificate when every lesson of a course is completed', async () => {
    const progress = await login('Citra Dewi', '20241003')
    const courses = useCoursesStore()
    const row = () => progress.courseProgress.find((c) => c.course_id === 'c2')!
    expect(row().completed).toBe(false)
    expect(await progress.downloadCertificate('c2')).toBe(false)

    for (const l of courses.lessonsByCourse('c2')) await courses.markLessonCompleted(l.id)
    await new Promise((r) => setTimeout(r, 0))

    expect(row().completed).toBe(true)
    expect(row().percent).toBe(100)
    expect(row().certificate?.verification_code).toMatch(VERIFICATION_CODE_RE)
    expect(earnedIds()).toContain('tuntas')
    expect(myNotifTitles().some((t) => t.startsWith('Sertifikat siap: MK102'))).toBe(true)
    // Lesson completions were logged via the courses-store hook.
    expect(progress.logged.filter((a) => a.tipe === 'lesson_completed').map((a) => a.ref_id).sort()).toEqual(['l5', 'l6'])

    // Only one certificate per course, even after re-evaluation.
    await progress.evaluate()
    expect(progress.certificates.filter((c) => c.course_id === 'c2')).toHaveLength(1)
  })

  it('does nothing for instructors', async () => {
    await useAuthStore().init()
    expect(await useAuthStore().loginAsInstructor('Dr. Andi Wijaya', 'instruktur123')).toBe(true)
    const progress = useProgressStore()
    await progress.init()
    expect(progress.activities).toEqual([])
    expect(progress.courseProgress).toEqual([])
    expect(await progress.record('lesson_completed', 'l1')).toBeNull()
  })
})
