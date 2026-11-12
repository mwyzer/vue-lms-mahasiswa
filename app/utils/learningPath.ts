/**
 * Adaptive learning path — pure logic (no Pinia/Nuxt), unit-tested in
 * app/test/utils/learningPath.test.ts. The page /student/learning-path wires
 * it to the quiz + courses stores via app/composables/useLearningPath.ts.
 *
 * 1. Topic of a question
 *    - explicit `topik` / `tags` on the question (forward compatible: the
 *      current schema has no such column), else
 *    - the best-matching lesson of the same course: TF-IDF-like token overlap
 *      of the question + correct option against the lesson title (×3) and
 *      lesson text (×1). Below {@link LP_MIN_MATCH_SCORE} the question goes to
 *      the course's "Umum" topic.
 * 2. Correctness per question, in order of preference
 *    - exact, from the attempt's own per-question answers (`attempt.answers`,
 *      stored by quizStore.submitQuiz since 3b-A; jsonb `quiz_attempts.answers`);
 *    - exact, from separate per-question rows (`quiz_answers` / demo answers);
 *    - otherwise ESTIMATED: the attempt's percentage is spread evenly over the
 *      quiz's questions (legacy attempts without answers). Topics that rely on
 *      estimates are flagged `estimated: true` (`estimated_count` says how many
 *      of their results are estimates, so the UI can mark "sebagian estimasi").
 *    Only the latest attempt per quiz counts (re-taking a quiz replaces it).
 * 3. Weak topic: score < threshold (default 70) with at least one question.
 * 4. Recommendations per weak topic: the topic's lesson (re-read) and active
 *    quizzes of the same course that contain questions of that topic, not-yet
 *    attempted first, then by lowest previous score.
 */

export interface LpLesson {
  id: string
  course_id: string
  judul: string
  konten?: string | null
  urutan?: number
}

export interface LpQuiz {
  id: string
  course_id: string
  judul: string
  is_active: boolean
  passing_score?: number
}

export interface LpQuestion {
  id: string
  quiz_id: string
  pertanyaan: string
  pilihan_a?: string
  pilihan_b?: string
  pilihan_c?: string
  pilihan_d?: string
  jawaban_benar?: 'a' | 'b' | 'c' | 'd'
  /** Optional explicit topic (not in the current schema). */
  topik?: string | null
  /** Optional explicit tags (not in the current schema); the first one is used as topic. */
  tags?: string[] | null
}

export interface LpAttempt {
  id: string
  quiz_id: string
  student_id: string
  score: number
  total_questions: number
  percentage: number
  started_at?: string
  submitted_at: string
  /** Per-question answers stored with the attempt (exact data), when present. */
  answers?: readonly LpAttemptAnswer[] | null
}

export interface LpAttemptAnswer {
  question_id: string
  is_correct: boolean
  jawaban?: string | null
  points?: number
}

export interface LpAnswer {
  quiz_id: string
  student_id: string
  question_id: string
  is_correct: boolean
  submitted_at?: string
}

export interface LpCourse {
  id: string
  kode?: string
  nama?: string
}

export interface TopicStat {
  /** `lesson:<id>`, `tag:<name>` or `umum:<courseId>`. */
  key: string
  course_id: string
  label: string
  lesson_id: string | null
  /** Sum of (estimated) correctness over counted questions. */
  correct: number
  /** Number of counted question results. */
  total: number
  /** 0–100, rounded. */
  score: number
  /** True when at least one counted result is an estimate (no per-question answer). */
  estimated: boolean
  /** How many of the `total` results are estimates (0 = all exact, total = all estimated). */
  estimated_count: number
  /** Distinct quizzes that contributed. */
  quiz_ids: string[]
  weak: boolean
}

export interface PracticeQuizRec {
  quiz_id: string
  judul: string
  /** Questions of the weak topic in this quiz. */
  topic_questions: number
  attempted: boolean
  last_percentage: number | null
}

export interface TopicRecommendation {
  topic: TopicStat
  lesson: { id: string; course_id: string; judul: string } | null
  quizzes: PracticeQuizRec[]
}

export interface CourseLearningPath {
  course_id: string
  course_kode: string
  course_nama: string
  topics: TopicStat[]
  weakTopics: TopicStat[]
  recommendations: TopicRecommendation[]
  /** Lessons of the course with no quiz data yet (nothing to judge). */
  untestedLessons: LpLesson[]
  /** Weighted course score over all counted questions, or null when nothing was attempted. */
  overall: number | null
  attemptsCounted: number
  /** Counted question results that are exact vs estimated (over all topics). */
  exactResults: number
  estimatedResults: number
}

export const LP_WEAK_THRESHOLD = 70
/** Minimum lesson match score for a question to be assigned to a lesson. */
export const LP_MIN_MATCH_SCORE = 1.2
/** Per-question answers up to this long before the attempt's start still count as part of it. */
const LP_ANSWER_TOLERANCE_MS = 5 * 60 * 1000

const LP_STOPWORDS = new Set(
  (
    'yang dan di ke dari untuk dengan pada adalah ini itu atau juga dalam akan tidak dapat bisa oleh sebagai karena ' +
    'sehingga maka jika kita kami anda kamu mereka dia ia ada lebih sangat sudah telah setiap semua bahwa tersebut ' +
    'seperti antara hanya harus agar saat ketika merupakan yaitu yakni suatu sebuah para secara digunakan menggunakan ' +
    'banyak beberapa serta namun tetapi bagi hal cara contoh misalnya biasanya lain sama baik satu dua tiga empat lima ' +
    'apa apakah bagaimana mengapa kapan dimana mana manakah berikut lalu kemudian setelah sebelum selama hingga sampai ' +
    'masih belum perlu boleh mungkin sering selalu pernah tentang terhadap melalui menjadi membuat dibuat memiliki punya ' +
    'berupa bentuk jenis bagian sedangkan apabila bila kalau pula saja lagi nya pun tiap sendiri disebut adanya tanpa ' +
    'begitu demikian umumnya tertentu artinya berarti benar salah dipakai fungsi kode program minimal kali akan dihasilkan ' +
    'menghasilkan dari the and for with that this from are was were has have not but you can will into than then also'
  ).split(/\s+/),
)

/** Lower-cased content tokens (≥ 3 chars, no stopwords). Exported for tests. */
export function lpTokens(text: string): string[] {
  const words = String(text ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu)
  if (!words) return []
  return words.filter((w) => w.length >= 3 && !LP_STOPWORDS.has(w) && !/^\d+$/.test(w))
}

/** Token equality with a light prefix rule for Indonesian affixes ("perulangan" ~ "perulangannya"). */
function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 5 && b.length >= 5) return a.startsWith(b) || b.startsWith(a)
  return false
}

function hasToken(set: Set<string>, tok: string): boolean {
  if (set.has(tok)) return true
  if (tok.length < 5) return false
  for (const t of set) if (tokenMatches(t, tok)) return true
  return false
}

function correctOptionText(q: LpQuestion): string {
  const letter = q.jawaban_benar
  if (!letter) return ''
  return String((q as unknown as Record<string, unknown>)[`pilihan_${letter}`] ?? '')
}

/** Normalise an explicit topic/tag name; empty ⇒ null. */
function explicitTopic(q: LpQuestion): string | null {
  const raw = (typeof q.topik === 'string' && q.topik) || (Array.isArray(q.tags) ? q.tags.find((t) => typeof t === 'string' && t.trim()) : '')
  const t = String(raw ?? '').trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, 80) : null
}

/**
 * Best-matching lesson for a question among `lessons` (same course), or null.
 * Score = Σ over distinct question tokens of idf × (3 if in title + 1 if in text).
 * Tokens in `ignore` (e.g. words of the course name, like "pemrograman" in
 * "Pemrograman Dasar") say nothing about the topic and are skipped.
 */
export function matchQuestionToLesson(
  q: LpQuestion,
  lessons: readonly LpLesson[],
  minScore = LP_MIN_MATCH_SCORE,
  ignore: ReadonlySet<string> = new Set(),
): { lesson: LpLesson; score: number } | null {
  if (lessons.length === 0) return null
  const qTokens = [...new Set(lpTokens(`${q.pertanyaan} ${correctOptionText(q)}`))].filter((t) => !ignore.has(t))
  if (qTokens.length === 0) return null
  const docs = lessons.map((l) => ({
    lesson: l,
    title: new Set(lpTokens(l.judul)),
    body: new Set(lpTokens(l.konten ?? '')),
  }))
  const n = docs.length
  let best: { lesson: LpLesson; score: number } | null = null
  for (const d of docs) {
    let score = 0
    for (const tok of qTokens) {
      const inTitle = hasToken(d.title, tok)
      const inBody = hasToken(d.body, tok)
      if (!inTitle && !inBody) continue
      const df = docs.filter((x) => hasToken(x.title, tok) || hasToken(x.body, tok)).length
      const idf = Math.log(1 + n / df)
      score += idf * ((inTitle ? 3 : 0) + (inBody ? 1 : 0))
    }
    if (score > (best?.score ?? 0) || (best && score === best.score && (d.lesson.urutan ?? 0) < (best.lesson.urutan ?? 0))) {
      if (score > 0) best = { lesson: d.lesson, score: Math.round(score * 1000) / 1000 }
    }
  }
  return best && best.score >= minScore ? best : null
}

/** Topic key + label of a question within its course. */
export function topicOfQuestion(
  q: LpQuestion,
  courseId: string,
  lessons: readonly LpLesson[],
  ignore: ReadonlySet<string> = new Set(),
): { key: string; label: string; lesson_id: string | null } {
  const tag = explicitTopic(q)
  if (tag) {
    const sameLesson = lessons.find((l) => l.judul.trim().toLowerCase() === tag.toLowerCase())
    if (sameLesson) return { key: `lesson:${sameLesson.id}`, label: sameLesson.judul, lesson_id: sameLesson.id }
    return { key: `tag:${tag.toLowerCase()}`, label: tag, lesson_id: null }
  }
  const m = matchQuestionToLesson(q, lessons, LP_MIN_MATCH_SCORE, ignore)
  if (m) return { key: `lesson:${m.lesson.id}`, label: m.lesson.judul, lesson_id: m.lesson.id }
  return { key: `umum:${courseId}`, label: 'Umum (belum terpetakan ke materi)', lesson_id: null }
}

/** Latest attempt per quiz of one student. */
export function latestAttempts(attempts: readonly LpAttempt[], studentId: string): Map<string, LpAttempt> {
  const out = new Map<string, LpAttempt>()
  for (const a of attempts) {
    if (a.student_id !== studentId) continue
    const prev = out.get(a.quiz_id)
    if (!prev || new Date(a.submitted_at).getTime() >= new Date(prev.submitted_at).getTime()) out.set(a.quiz_id, a)
  }
  return out
}

/** Tokens of the course name (uninformative for telling its lessons apart). */
function courseNameTokens(input: Pick<LpInput, 'courses'>, courseId: string): Set<string> {
  return new Set(lpTokens(input.courses.find((c) => c.id === courseId)?.nama ?? ''))
}

export interface LpInput {
  studentId: string
  courses: readonly LpCourse[]
  quizzes: readonly LpQuiz[]
  questions: readonly LpQuestion[]
  attempts: readonly LpAttempt[]
  answers?: readonly LpAnswer[]
  lessons: readonly LpLesson[]
  threshold?: number
}

/** Per-topic scores of one course for one student (sorted weakest first, untested topics omitted). */
export function computeTopicStats(input: LpInput, courseId: string): { topics: TopicStat[]; attemptsCounted: number } {
  const threshold = input.threshold ?? LP_WEAK_THRESHOLD
  const lessons = input.lessons.filter((l) => l.course_id === courseId)
  const ignore = courseNameTokens(input, courseId)
  const quizIds = new Set(input.quizzes.filter((q) => q.course_id === courseId).map((q) => q.id))
  const latest = latestAttempts(input.attempts, input.studentId)

  // Latest per-question answer for this student (exact data, when present).
  const answerByQuestion = new Map<string, LpAnswer>()
  for (const a of input.answers ?? []) {
    if (a.student_id !== input.studentId || !quizIds.has(a.quiz_id)) continue
    const prev = answerByQuestion.get(a.question_id)
    if (!prev || new Date(a.submitted_at ?? 0).getTime() >= new Date(prev.submitted_at ?? 0).getTime()) {
      answerByQuestion.set(a.question_id, a)
    }
  }

  const stats = new Map<string, TopicStat>()
  let attemptsCounted = 0
  for (const quizId of quizIds) {
    const attempt = latest.get(quizId)
    if (!attempt) continue
    const qs = input.questions.filter((q) => q.quiz_id === quizId)
    if (qs.length === 0) continue
    attemptsCounted++
    const pct = Math.min(100, Math.max(0, Number(attempt.percentage) || 0)) / 100
    // Answers older than the latest attempt belong to an earlier attempt and are ignored.
    const attemptStart = new Date(attempt.started_at ?? attempt.submitted_at).getTime() - LP_ANSWER_TOLERANCE_MS
    // Answers stored on the attempt itself always belong to it (no time check).
    const inline = new Map<string, LpAttemptAnswer>()
    if (Array.isArray(attempt.answers)) {
      for (const a of attempt.answers) if (a && typeof a.question_id === 'string') inline.set(a.question_id, a)
    }
    for (const q of qs) {
      const topic = topicOfQuestion(q, courseId, lessons, ignore)
      const candidate = answerByQuestion.get(q.id)
      const exact =
        inline.get(q.id) ??
        (candidate && (!candidate.submitted_at || new Date(candidate.submitted_at).getTime() >= attemptStart)
          ? candidate
          : undefined)
      const value = exact ? (exact.is_correct ? 1 : 0) : pct
      const s =
        stats.get(topic.key) ??
        ({ ...topic, course_id: courseId, correct: 0, total: 0, score: 0, estimated: false, estimated_count: 0, quiz_ids: [], weak: false } as TopicStat)
      s.correct += value
      s.total += 1
      if (!exact) {
        s.estimated = true
        s.estimated_count += 1
      }
      if (!s.quiz_ids.includes(quizId)) s.quiz_ids.push(quizId)
      stats.set(topic.key, s)
    }
  }

  const topics = [...stats.values()].map((s) => {
    const score = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
    return { ...s, correct: Math.round(s.correct * 100) / 100, score, weak: s.total > 0 && score < threshold }
  })
  topics.sort((a, b) => a.score - b.score || b.total - a.total || a.label.localeCompare(b.label))
  return { topics, attemptsCounted }
}

/** Practice quizzes + lesson for each weak topic. */
export function recommendForTopics(input: LpInput, courseId: string, weak: readonly TopicStat[]): TopicRecommendation[] {
  const lessons = input.lessons.filter((l) => l.course_id === courseId)
  const ignore = courseNameTokens(input, courseId)
  const latest = latestAttempts(input.attempts, input.studentId)
  const activeQuizzes = input.quizzes.filter((q) => q.course_id === courseId && q.is_active)

  return weak.map((topic) => {
    const lesson = topic.lesson_id ? lessons.find((l) => l.id === topic.lesson_id) ?? null : null
    const quizzes: PracticeQuizRec[] = []
    for (const quiz of activeQuizzes) {
      const n = input.questions.filter((q) => q.quiz_id === quiz.id && topicOfQuestion(q, courseId, lessons, ignore).key === topic.key).length
      if (n === 0) continue
      const last = latest.get(quiz.id)
      quizzes.push({ quiz_id: quiz.id, judul: quiz.judul, topic_questions: n, attempted: !!last, last_percentage: last ? last.percentage : null })
    }
    quizzes.sort(
      (a, b) =>
        Number(a.attempted) - Number(b.attempted) ||
        (a.last_percentage ?? 0) - (b.last_percentage ?? 0) ||
        b.topic_questions - a.topic_questions ||
        a.judul.localeCompare(b.judul),
    )
    return { topic, lesson: lesson ? { id: lesson.id, course_id: lesson.course_id, judul: lesson.judul } : null, quizzes }
  })
}

/** Full learning path for every course in `input.courses`. */
export function buildLearningPath(input: LpInput): CourseLearningPath[] {
  return input.courses.map((course) => {
    const { topics, attemptsCounted } = computeTopicStats(input, course.id)
    const weakTopics = topics.filter((t) => t.weak)
    const tested = new Set(topics.map((t) => t.lesson_id).filter(Boolean))
    const untestedLessons = input.lessons
      .filter((l) => l.course_id === course.id && !tested.has(l.id))
      .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
    const totals = topics.reduce(
      (acc, t) => ({ c: acc.c + t.correct, n: acc.n + t.total, e: acc.e + t.estimated_count }),
      { c: 0, n: 0, e: 0 },
    )
    return {
      course_id: course.id,
      course_kode: course.kode ?? '',
      course_nama: course.nama ?? course.id,
      topics,
      weakTopics,
      recommendations: recommendForTopics(input, course.id, weakTopics),
      untestedLessons,
      overall: totals.n > 0 ? Math.round((totals.c / totals.n) * 100) : null,
      attemptsCounted,
      exactResults: totals.n - totals.e,
      estimatedResults: totals.e,
    }
  })
}
