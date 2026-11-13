/**
 * 3b-A — quizStore.submitQuiz stores per-question answers on the attempt
 * (demo + Supabase), and the learning path uses them instead of estimates.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useQuizStore, gradeAnswers } from '~/stores/quiz'
import { useAuthStore } from '~/stores/auth'
import { useLearningPath } from '~/composables/useLearningPath'

describe('gradeAnswers', () => {
  it('grades chosen options and keeps unanswered questions as wrong with null', () => {
    const qs = [
      { id: 'a', quiz_id: 'z', pertanyaan: '', pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', jawaban_benar: 'a' as const, urutan: 1, created_at: '' },
      { id: 'b', quiz_id: 'z', pertanyaan: '', pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', jawaban_benar: 'b' as const, urutan: 2, created_at: '' },
      { id: 'c', quiz_id: 'z', pertanyaan: '', pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', jawaban_benar: 'c' as const, urutan: 3, created_at: '' },
    ]
    expect(gradeAnswers(qs, { a: 'a', b: 'd' })).toEqual([
      { question_id: 'a', jawaban: 'a', is_correct: true, points: 1 },
      { question_id: 'b', jawaban: 'd', is_correct: false, points: 0 },
      { question_id: 'c', jawaban: null, is_correct: false, points: 0 },
    ])
  })
})

describe('quizStore.submitQuiz (demo)', () => {
  it('stores per-question answers on the attempt, consistent with the score', async () => {
    const store = useQuizStore()
    await store.init()
    store.startQuiz('qz3') // qq9 (b), qq10 (c), qq11 (b)
    store.answerQuestion('qq9', 'b')
    store.answerQuestion('qq10', 'a')
    const attempt = store.submitQuiz('sx')!
    expect(attempt).toMatchObject({ quiz_id: 'qz3', score: 1, total_questions: 3, percentage: 33 })
    expect(attempt.answers).toEqual([
      { question_id: 'qq9', jawaban: 'b', is_correct: true, points: 1 },
      { question_id: 'qq10', jawaban: 'a', is_correct: false, points: 0 },
      { question_id: 'qq11', jawaban: null, is_correct: false, points: 0 },
    ])
    expect(store.studentAttemptForQuiz('qz3', 'sx')?.answers).toHaveLength(3)
    // legacy demo attempts stay without answers
    expect(store.attempts.find((a) => a.id === 'qa3')?.answers).toBeUndefined()
  })

  it('learning path uses the stored answers (exact) for a freshly taken quiz', async () => {
    const auth = useAuthStore()
    await auth.init()
    expect(await auth.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')).toBe(true)
    const quiz = useQuizStore()
    const lp = useLearningPath()
    await lp.load()
    const before = lp.paths.value.find((p) => p.course_id === 'c1')!
    const userId = auth.user!.id

    // Legacy demo results are unchanged (exact via DEMO_QUIZ_ANSWERS).
    expect(before.weakTopics.map((t) => t.label)).toEqual(['Perulangan (Looping)'])
    expect(before.estimatedResults).toBe(0)

    // Take qz3 (c2, Struktur Data — not attempted by s1): all answers stored → no estimates.
    expect(userId).toBe('s1')
    expect(quiz.hasAttempted('qz3', userId)).toBe(false)
    const c2Before = lp.paths.value.find((p) => p.course_id === 'c2')!
    expect(c2Before.attemptsCounted).toBe(0)
    const qs = quiz.questionsForQuiz('qz3')
    quiz.startQuiz('qz3')
    // first answer right, the rest wrong
    qs.forEach((q, i) => quiz.answerQuestion(q.id, i === 0 ? q.jawaban_benar : (q.jawaban_benar === 'a' ? 'b' : 'a')))
    const attempt = quiz.submitQuiz(userId)!
    expect(attempt.answers?.filter((a) => a.is_correct)).toHaveLength(1)

    const after = lp.paths.value.find((p) => p.course_id === 'c2')!
    expect(after.attemptsCounted).toBe(1)
    expect(after.estimatedResults).toBe(0)
    expect(after.exactResults).toBe(qs.length)
    expect(after.topics.every((t) => !t.estimated && t.estimated_count === 0)).toBe(true)
    // exact per-question scores are 0 or 100 per question — not the spread percentage
    const correctSum = after.topics.reduce((s, t) => s + t.correct, 0)
    expect(correctSum).toBe(1)
  })
})

describe('quizStore.submitQuiz (Supabase)', () => {
  const originalNuxtApp = vi.mocked(globalThis.useNuxtApp).getMockImplementation()!
  afterEach(() => {
    vi.mocked(globalThis.useNuxtApp).mockImplementation(originalNuxtApp)
  })

  function fakeSupabase(opts: { missingColumns?: boolean } = {}) {
    const inserts: { table: string; payload: unknown }[] = []
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) {
            inserts.push({ table, payload })
            const hasNewCols = Array.isArray(payload)
              ? payload.some((r) => 'attempt_id' in (r as object))
              : 'answers' in (payload as object)
            const error = opts.missingColumns && hasNewCols ? { code: 'PGRST204', message: "Could not find the 'answers' column" } : null
            const result = { data: error ? null : { id: '11111111-1111-1111-1111-111111111111' }, error }
            return {
              select: () => ({ single: async () => result }),
              then: (res: (v: unknown) => unknown) => Promise.resolve({ error }).then(res),
            }
          },
        }
      },
    }
    vi.mocked(globalThis.useNuxtApp).mockImplementation(() => ({ $supabase: client }) as never)
    return inserts
  }

  async function submitInSupabaseMode() {
    const store = useQuizStore()
    await store.init()
    store.isDemoMode = false
    store.startQuiz('qz4') // qq12 (c), qq13 (d), qq14 (b)
    store.answerQuestion('qq12', 'c')
    store.answerQuestion('qq13', 'a')
    const attempt = store.submitQuiz('s9')!
    const saved = await store.waitForPersist()
    return { store, attempt, saved }
  }

  it('inserts the attempt with answers jsonb and one quiz_answers row per answered question', async () => {
    const inserts = fakeSupabase()
    const { store, saved } = await submitInSupabaseMode()
    expect(saved?.id).toBe('11111111-1111-1111-1111-111111111111')
    const att = inserts.find((i) => i.table === 'quiz_attempts')!.payload as Record<string, unknown>
    expect(att).toMatchObject({ quiz_id: 'qz4', student_id: 's9', score: 1, total_questions: 3, percentage: 33 })
    expect(att.answers).toHaveLength(3)
    const rows = inserts.find((i) => i.table === 'quiz_answers')!.payload as Record<string, unknown>[]
    expect(rows).toHaveLength(2) // the unanswered question has no row (jawaban NOT NULL)
    expect(rows[0]).toMatchObject({ question_id: 'qq12', jawaban: 'c', is_correct: true, points: 1, attempt_id: saved!.id })
    expect(store.attempts.some((a) => a.id === saved!.id && a.answers?.length === 3)).toBe(true)
    expect(store.sbAttempts.some((a) => a.id === saved!.id)).toBe(true)
  })

  it('retries without the new columns when the 3b-A migration is missing', async () => {
    const inserts = fakeSupabase({ missingColumns: true })
    const { saved } = await submitInSupabaseMode()
    expect(saved).not.toBeNull()
    const attemptInserts = inserts.filter((i) => i.table === 'quiz_attempts')
    expect(attemptInserts).toHaveLength(2)
    expect(attemptInserts[1]!.payload).not.toHaveProperty('answers')
    const answerInserts = inserts.filter((i) => i.table === 'quiz_answers')
    expect(answerInserts).toHaveLength(2)
    expect((answerInserts[1]!.payload as object[])[0]).not.toHaveProperty('attempt_id')
  })
})
