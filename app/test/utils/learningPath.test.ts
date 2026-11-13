/**
 * Adaptive learning path — Unit Tests (pure logic in app/utils/learningPath.ts)
 * plus an integration check against the demo stores via useLearningPath.
 */
import { describe, it, expect } from 'vitest'
import {
  buildLearningPath,
  computeTopicStats,
  latestAttempts,
  lpTokens,
  matchQuestionToLesson,
  topicOfQuestion,
  type LpInput,
  type LpLesson,
  type LpQuestion,
} from '~/utils/learningPath'
import { useLearningPath, DEMO_QUIZ_ANSWERS } from '~/composables/useLearningPath'
import { useAuthStore } from '~/stores/auth'

const LESSONS: LpLesson[] = [
  { id: 'L1', course_id: 'C', judul: 'Variabel dan Tipe Data', konten: 'Variabel menyimpan nilai. Tipe data int, float, str dan bool.', urutan: 1 },
  { id: 'L2', course_id: 'C', judul: 'Percabangan', konten: 'Percabangan memakai if, elif dan else. Operator perbandingan seperti ==.', urutan: 2 },
  { id: 'L3', course_id: 'C', judul: 'Perulangan', konten: 'Perulangan for dan while. Gunakan break untuk berhenti.', urutan: 3 },
]

const q = (id: string, quiz_id: string, pertanyaan: string, extra: Partial<LpQuestion> = {}): LpQuestion => ({
  id, quiz_id, pertanyaan, pilihan_a: 'x', pilihan_b: 'y', pilihan_c: 'z', pilihan_d: 'w', jawaban_benar: 'a', ...extra,
})

const QUESTIONS: LpQuestion[] = [
  q('q1', 'Z1', 'Tipe data untuk bilangan desimal adalah...', { pilihan_a: 'float' }),
  q('q2', 'Z1', 'Kapan memakai perulangan while?'),
  q('q3', 'Z1', 'Operator perbandingan kesamaan adalah...', { pilihan_a: '==' }),
  q('q4', 'Z1', 'Apa kepanjangan IDE?', { pilihan_a: 'Integrated Development Environment' }),
  q('q5', 'Z2', 'Perintah untuk menghentikan perulangan lebih awal?', { pilihan_a: 'break' }),
  q('q6', 'Z2', 'Variabel dibuat dengan operator penugasan?'),
]

const base = (over: Partial<LpInput> = {}): LpInput => ({
  studentId: 'S',
  courses: [{ id: 'C', kode: 'K1', nama: 'Kursus' }],
  quizzes: [
    { id: 'Z1', course_id: 'C', judul: 'Kuis 1', is_active: true },
    { id: 'Z2', course_id: 'C', judul: 'Kuis 2', is_active: true },
    { id: 'Z3', course_id: 'C', judul: 'Kuis 3 (nonaktif)', is_active: false },
  ],
  questions: QUESTIONS,
  attempts: [{ id: 'a1', quiz_id: 'Z1', student_id: 'S', score: 2, total_questions: 4, percentage: 50, submitted_at: '2026-01-01T10:00:00Z' }],
  answers: [
    { quiz_id: 'Z1', student_id: 'S', question_id: 'q1', is_correct: true, submitted_at: '2026-01-01T10:00:00Z' },
    { quiz_id: 'Z1', student_id: 'S', question_id: 'q2', is_correct: false, submitted_at: '2026-01-01T10:00:00Z' },
    { quiz_id: 'Z1', student_id: 'S', question_id: 'q3', is_correct: true, submitted_at: '2026-01-01T10:00:00Z' },
    { quiz_id: 'Z1', student_id: 'S', question_id: 'q4', is_correct: false, submitted_at: '2026-01-01T10:00:00Z' },
  ],
  lessons: LESSONS,
  ...over,
})

describe('topic detection', () => {
  it('tokenises without stopwords and short tokens', () => {
    expect(lpTokens('Apa yang dimaksud dengan Variabel di Python?')).toEqual(['dimaksud', 'variabel', 'python'])
  })

  it('maps questions to the best-matching lesson, title weighted', () => {
    expect(matchQuestionToLesson(QUESTIONS[0]!, LESSONS)?.lesson.id).toBe('L1')
    expect(matchQuestionToLesson(QUESTIONS[1]!, LESSONS)?.lesson.id).toBe('L3')
    expect(matchQuestionToLesson(QUESTIONS[2]!, LESSONS)?.lesson.id).toBe('L2')
    expect(matchQuestionToLesson(QUESTIONS[3]!, LESSONS)).toBeNull()
    expect(matchQuestionToLesson(QUESTIONS[0]!, [])).toBeNull()
  })

  it('ignores course-name words when matching', () => {
    const lessons: LpLesson[] = [
      { id: 'A', course_id: 'C', judul: 'Pengantar Pemrograman', konten: 'Pemrograman adalah menulis program.' },
      { id: 'B', course_id: 'C', judul: 'Percabangan', konten: 'Operator perbandingan seperti == dipakai pada kondisi.' },
    ]
    const question = q('x', 'Z', 'Apa fungsi operator == dalam pemrograman?', { pilihan_a: 'Perbandingan' })
    expect(matchQuestionToLesson(question, lessons)?.lesson.id).toBe('A')
    expect(matchQuestionToLesson(question, lessons, undefined, new Set(['pemrograman', 'dasar']))?.lesson.id).toBe('B')
  })

  it('uses explicit topik/tags first and falls back to "Umum"', () => {
    expect(topicOfQuestion(q('t', 'Z', 'apa saja', { topik: 'Rekursi' }), 'C', LESSONS)).toEqual({ key: 'tag:rekursi', label: 'Rekursi', lesson_id: null })
    expect(topicOfQuestion(q('t', 'Z', 'apa saja', { tags: ['Perulangan'] }), 'C', LESSONS).key).toBe('lesson:L3')
    expect(topicOfQuestion(QUESTIONS[3]!, 'C', LESSONS).key).toBe('umum:C')
  })
})

describe('computeTopicStats', () => {
  it('uses exact per-question answers and flags weak topics (< 70)', () => {
    const { topics, attemptsCounted } = computeTopicStats(base(), 'C')
    expect(attemptsCounted).toBe(1)
    const byKey = Object.fromEntries(topics.map((t) => [t.key, t]))
    expect(byKey['lesson:L1']).toMatchObject({ score: 100, total: 1, weak: false, estimated: false })
    expect(byKey['lesson:L3']).toMatchObject({ score: 0, total: 1, weak: true })
    expect(byKey['umum:C']).toMatchObject({ score: 0, weak: true })
    // weakest first
    expect(topics[0]!.score).toBe(0)
  })

  it('estimates from the attempt percentage when answers are missing', () => {
    const { topics } = computeTopicStats(base({ answers: [] }), 'C')
    expect(topics.every((t) => t.estimated && t.score === 50 && t.weak)).toBe(true)
  })

  it('counts only the latest attempt per quiz and ignores answers of older attempts', () => {
    const input = base({
      attempts: [
        { id: 'a1', quiz_id: 'Z1', student_id: 'S', score: 2, total_questions: 4, percentage: 50, submitted_at: '2026-01-01T10:00:00Z' },
        { id: 'a2', quiz_id: 'Z1', student_id: 'S', score: 4, total_questions: 4, percentage: 100, started_at: '2026-02-01T09:00:00Z', submitted_at: '2026-02-01T09:30:00Z' },
      ],
    })
    expect(latestAttempts(input.attempts, 'S').get('Z1')?.id).toBe('a2')
    const { topics } = computeTopicStats(input, 'C')
    expect(topics.every((t) => t.score === 100 && t.estimated && !t.weak)).toBe(true)
  })

  it('ignores other students and the threshold is configurable', () => {
    const other = base({ studentId: 'X' })
    expect(computeTopicStats(other, 'C').topics).toEqual([])
    const strict = computeTopicStats(base({ threshold: 101 }), 'C')
    expect(strict.topics.every((t) => t.weak)).toBe(true)
  })
})

describe('buildLearningPath', () => {
  it('recommends the lesson and active practice quizzes (unattempted first)', () => {
    const [path] = buildLearningPath(base())
    expect(path!.overall).toBe(50)
    const loop = path!.recommendations.find((r) => r.topic.key === 'lesson:L3')!
    expect(loop.lesson?.id).toBe('L3')
    expect(loop.quizzes.map((x) => x.quiz_id)).toEqual(['Z2', 'Z1'])
    expect(loop.quizzes[0]).toMatchObject({ attempted: false, topic_questions: 1 })
    expect(loop.quizzes[1]).toMatchObject({ attempted: true, last_percentage: 50 })
    // inactive quizzes are never recommended
    expect(path!.recommendations.flatMap((r) => r.quizzes).some((x) => x.quiz_id === 'Z3')).toBe(false)
    // "Umum" has no lesson
    expect(path!.recommendations.find((r) => r.topic.key === 'umum:C')!.lesson).toBeNull()
  })

  it('lists lessons without quiz data and handles courses without attempts', () => {
    const [path] = buildLearningPath(base({ questions: QUESTIONS.filter((x) => x.id !== 'q2') }))
    expect(path!.untestedLessons.map((l) => l.id)).toEqual(['L3'])
    const [empty] = buildLearningPath(base({ attempts: [] }))
    expect(empty).toMatchObject({ overall: null, attemptsCounted: 0, topics: [], recommendations: [] })
    expect(empty!.untestedLessons).toHaveLength(3)
  })
})

describe('useLearningPath (demo stores)', () => {
  it('demo answers match the demo attempt scores', () => {
    const s1qz1 = DEMO_QUIZ_ANSWERS.filter((a) => a.student_id === 's1' && a.quiz_id === 'qz1')
    expect(s1qz1.filter((a) => a.is_correct)).toHaveLength(4)
    expect(s1qz1).toHaveLength(5)
  })

  it('finds "Perulangan (Looping)" as the weak topic of the demo student', async () => {
    const auth = useAuthStore()
    await auth.init()
    expect(await auth.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')).toBe(true)
    const lp = useLearningPath()
    await lp.load()
    const c1 = lp.paths.value.find((p) => p.course_id === 'c1')!
    expect(c1.attemptsCounted).toBe(2)
    expect(c1.weakTopics.map((t) => t.label)).toEqual(['Perulangan (Looping)'])
    const rec = c1.recommendations[0]!
    expect(rec.lesson?.id).toBe('l4')
    expect(rec.quizzes.map((x) => x.quiz_id)).toContain('qz1')
    expect(c1.topics.find((t) => t.lesson_id === 'l2')?.score).toBe(100)
    // "operator ==" question maps to Percabangan, not to "Pengantar Pemrograman" via the course name
    expect(c1.topics.find((t) => t.lesson_id === 'l3')?.total).toBe(1)
  })
})

describe('per-question answers stored on the attempt (3b-A)', () => {
  const inlineAttempt = (answers: { question_id: string; is_correct: boolean }[]) => ({
    id: 'a9', quiz_id: 'Z1', student_id: 'S', score: 1, total_questions: 4, percentage: 25,
    started_at: '2026-03-01T10:00:00Z', submitted_at: '2026-03-01T10:20:00Z',
    answers: answers.map((a) => ({ ...a, jawaban: a.is_correct ? 'a' : 'b', points: a.is_correct ? 1 : 0 })),
  })

  it('uses attempt.answers as exact data (no estimate), overriding the percentage', () => {
    const input = base({
      answers: [],
      attempts: [inlineAttempt([
        { question_id: 'q1', is_correct: true },
        { question_id: 'q2', is_correct: false },
        { question_id: 'q3', is_correct: false },
        { question_id: 'q4', is_correct: false },
      ])],
    })
    const { topics } = computeTopicStats(input, 'C')
    const byKey = Object.fromEntries(topics.map((t) => [t.key, t]))
    expect(byKey['lesson:L1']).toMatchObject({ score: 100, estimated: false, estimated_count: 0, weak: false })
    expect(byKey['lesson:L3']).toMatchObject({ score: 0, estimated: false, weak: true })
    const [path] = buildLearningPath(input)
    expect(path).toMatchObject({ exactResults: 4, estimatedResults: 0, overall: 25 })
  })

  it('prefers attempt.answers over older quiz_answers rows of the same question', () => {
    // base() has quiz_answers saying q1 correct; the new attempt says wrong.
    const input = base({ attempts: [inlineAttempt([{ question_id: 'q1', is_correct: false }])] })
    const { topics } = computeTopicStats(input, 'C')
    expect(topics.find((t) => t.key === 'lesson:L1')).toMatchObject({ score: 0, estimated: false })
  })

  it('marks topics as partially estimated when the attempt misses some questions', () => {
    // q1 + q4 exact; q2/q3 (added later, not in the attempt) estimated from 25%.
    const input = base({
      answers: [],
      questions: [...QUESTIONS, q('q7', 'Z1', 'Tipe data bilangan bulat adalah...', { pilihan_a: 'int' })],
      attempts: [inlineAttempt([
        { question_id: 'q1', is_correct: true },
        { question_id: 'q4', is_correct: true },
      ])],
    })
    const { topics } = computeTopicStats(input, 'C')
    const l1 = topics.find((t) => t.key === 'lesson:L1')!
    expect(l1).toMatchObject({ total: 2, estimated: true, estimated_count: 1 })
    expect(l1.correct).toBe(1.25) // 1 (exact) + 0.25 (estimate)
    expect(topics.find((t) => t.key === 'umum:C')).toMatchObject({ estimated: false, estimated_count: 0, score: 100 })
    const [path] = buildLearningPath(input)
    expect(path!.exactResults).toBe(2)
    expect(path!.estimatedResults).toBe(3)
  })

  it('falls back to the old behaviour for attempts without answers (null / missing)', () => {
    const legacy = computeTopicStats(base(), 'C').topics
    const withNull = computeTopicStats(
      base({ attempts: base().attempts.map((a) => ({ ...a, answers: null })) }),
      'C',
    ).topics
    expect(withNull).toEqual(legacy)
    const estimated = computeTopicStats(base({ answers: [], attempts: base().attempts.map((a) => ({ ...a, answers: null })) }), 'C').topics
    expect(estimated.every((t) => t.estimated && t.estimated_count === t.total && t.score === 50)).toBe(true)
  })
})
