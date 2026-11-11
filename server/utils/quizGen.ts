/**
 * Quiz Generator — Pure logic for "Generate soal kuis dari materi".
 *
 * No Nitro globals here (no createError / useRuntimeConfig) so everything is
 * unit-testable from Vitest. The API route `server/api/ai/generate-quiz.post.ts`
 * wires this to the shared AI client (`chatJson`) and maps errors to HTTP.
 *
 * Contents:
 *   - parseQuizGenRequest      — validate + normalise the request body
 *   - buildQuizGenPrompt       — system/user prompt (lesson text wrapped as untrusted data)
 *   - normalizeAnswerLetter    — 'A', 'a.', '(b)', 'pilihan_c' → 'a'..'d'
 *   - validateQuizGenQuestion  — strict check of one question
 *   - validateQuizGenOutput    — check a whole model reply (dedupe, truncate)
 *   - quizGenRng / shuffleQuizOptions — seedable option shuffle with answer remap
 *   - generateDemoQuiz         — deterministic offline (no-LLM) cloze questions
 *   - runQuizGeneration        — orchestration: model → validate → fallback → shuffle
 *
 * Nothing produced here is ever persisted: the instructor reviews the drafts
 * in the UI and explicitly adds the chosen ones to a quiz.
 */
import { hashText, UNTRUSTED_NOTICE, wrapUntrusted } from './aiText'

// ────────────────────────────────────────────
// Types & limits
// ────────────────────────────────────────────

export type QuizGenDifficulty = 'mudah' | 'sedang' | 'sulit'
export type QuizGenLetter = 'a' | 'b' | 'c' | 'd'

/** One generated multiple-choice question (shape of the API response). */
export interface GeneratedQuizQuestion {
  pertanyaan: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  jawaban_benar: QuizGenLetter
  /** Explanation for the instructor's review. Not persisted (no DB column). */
  penjelasan: string
}

/** Normalised request. */
export interface QuizGenRequest {
  lesson: { judul: string; konten: string }
  count: number
  difficulty: QuizGenDifficulty
  existing: string[]
  /** Optional seed (option shuffle + demo variation). Defaults to a hash of the input. */
  seed?: number
}

/** API response body. */
export interface QuizGenResponse {
  questions: GeneratedQuizQuestion[]
  source: 'ai' | 'demo'
  requested: number
  generated: number
}

export const QUIZGEN_LIMITS = {
  COUNT_MIN: 1,
  COUNT_MAX: 10,
  COUNT_DEFAULT: 5,
  /** Lesson content shorter than this (after trim) is rejected with 400. */
  LESSON_MIN_CHARS: 120,
  /** Lesson content longer than this is rejected with 400. */
  LESSON_MAX_CHARS: 50_000,
  /** At most this much lesson content is put into the prompt. */
  PROMPT_LESSON_CHARS: 12_000,
  JUDUL_MAX_CHARS: 200,
  /** `existing` arrays longer than this are rejected with 400. */
  EXISTING_MAX_ITEMS: 200,
  /** Each `existing` item is truncated to this length. */
  EXISTING_ITEM_MAX_CHARS: 1000,
  /** At most this many `existing` items are listed in the prompt (all are used for dedupe). */
  EXISTING_IN_PROMPT: 50,
  /** Field length limits for a generated question (inclusive). */
  PERTANYAAN_MAX_CHARS: 600,
  PILIHAN_MAX_CHARS: 250,
  PENJELASAN_MAX_CHARS: 1000,
  /** Raw request bodies above this are rejected (413) before parsing. */
  BODY_MAX_BYTES: 256 * 1024,
} as const

export const QUIZGEN_DIFFICULTIES: readonly QuizGenDifficulty[] = ['mudah', 'sedang', 'sulit']
const LETTERS: readonly QuizGenLetter[] = ['a', 'b', 'c', 'd']
const OPTION_KEYS = ['pilihan_a', 'pilihan_b', 'pilihan_c', 'pilihan_d'] as const

// ────────────────────────────────────────────
// Request parsing
// ────────────────────────────────────────────

/** Parse `count`: integer in [1, 10]; missing/invalid ⇒ 5; out of range ⇒ clamped. */
export function clampQuizGenCount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(n)) return QUIZGEN_LIMITS.COUNT_DEFAULT
  return Math.min(QUIZGEN_LIMITS.COUNT_MAX, Math.max(QUIZGEN_LIMITS.COUNT_MIN, Math.round(n)))
}

export type ParseResult = { ok: true; value: QuizGenRequest } | { ok: false; message: string }

/**
 * Validate and normalise a raw request body. Never throws.
 * Failure messages are Indonesian and meant for a 400 response.
 */
export function parseQuizGenRequest(body: unknown): ParseResult {
  const L = QUIZGEN_LIMITS
  const fail = (message: string): ParseResult => ({ ok: false, message })
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Body permintaan tidak valid.')
  const b = body as Record<string, unknown>

  const lesson = b.lesson
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return fail('Materi (lesson) wajib dikirim.')
  const l = lesson as Record<string, unknown>
  if (l.judul !== undefined && l.judul !== null && typeof l.judul !== 'string') return fail('Judul materi harus berupa teks.')
  const judul = typeof l.judul === 'string' ? l.judul.trim() : ''
  if (judul.length > L.JUDUL_MAX_CHARS) return fail(`Judul materi terlalu panjang (maksimal ${L.JUDUL_MAX_CHARS} karakter).`)
  if (typeof l.konten !== 'string' || !l.konten.trim()) return fail('Isi materi kosong. Tambahkan isi materi terlebih dahulu.')
  const konten = l.konten.trim()
  if (konten.length < L.LESSON_MIN_CHARS) {
    return fail(
      `Isi materi terlalu pendek (${konten.length} karakter). Minimal ${L.LESSON_MIN_CHARS} karakter agar soal dapat dibuat.`,
    )
  }
  if (konten.length > L.LESSON_MAX_CHARS) {
    return fail(`Isi materi terlalu panjang (${konten.length} karakter). Maksimal ${L.LESSON_MAX_CHARS} karakter.`)
  }

  let difficulty: QuizGenDifficulty = 'sedang'
  if (b.difficulty !== undefined && b.difficulty !== null && b.difficulty !== '') {
    const d = typeof b.difficulty === 'string' ? b.difficulty.trim().toLowerCase() : ''
    if (!(QUIZGEN_DIFFICULTIES as readonly string[]).includes(d)) {
      return fail('Tingkat kesulitan harus salah satu dari: mudah, sedang, sulit.')
    }
    difficulty = d as QuizGenDifficulty
  }

  let existing: string[] = []
  if (b.existing !== undefined && b.existing !== null) {
    if (!Array.isArray(b.existing)) return fail('Daftar soal yang sudah ada (existing) harus berupa array teks.')
    if (b.existing.length > L.EXISTING_MAX_ITEMS) {
      return fail(`Terlalu banyak soal yang sudah ada (maksimal ${L.EXISTING_MAX_ITEMS}).`)
    }
    existing = b.existing
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim().slice(0, L.EXISTING_ITEM_MAX_CHARS))
      .filter(Boolean)
  }

  let seed: number | undefined
  if (typeof b.seed === 'number' && Number.isFinite(b.seed)) seed = Math.abs(Math.floor(b.seed)) >>> 0

  return { ok: true, value: { lesson: { judul, konten }, count: clampQuizGenCount(b.count), difficulty, existing, seed } }
}

// ────────────────────────────────────────────
// Prompt
// ────────────────────────────────────────────

const DIFFICULTY_HINT: Record<QuizGenDifficulty, string> = {
  mudah: 'mudah — menguji ingatan dan pemahaman dasar (definisi, istilah, fakta yang tertulis jelas di materi)',
  sedang: 'sedang — menguji pemahaman dan penerapan sederhana (membedakan konsep, memilih contoh yang tepat)',
  sulit: 'sulit — menguji analisis dan penerapan (kasus, perbandingan, konsekuensi), tetapi tetap dapat dijawab dari materi',
}

/** How many questions to ask the model for (a small surplus absorbs ones dropped by validation). */
export function quizGenAskCount(count: number): number {
  return Math.min(count + 2, QUIZGEN_LIMITS.COUNT_MAX + 2)
}

/** Build the chat prompt. The lesson text and existing questions are wrapped as untrusted data. */
export function buildQuizGenPrompt(req: QuizGenRequest): { system: string; user: string } {
  const ask = quizGenAskCount(req.count)
  const system = [
    'Kamu adalah asisten dosen yang menyusun soal pilihan ganda berbahasa Indonesia untuk kuis mahasiswa.',
    'Buat soal HANYA berdasarkan isi materi yang diberikan; jangan menambahkan fakta dari luar materi.',
    'Aturan setiap soal:',
    '- tepat empat pilihan jawaban yang berbeda satu sama lain, hanya SATU yang benar;',
    '- pengecoh masuk akal dan sejenis dengan jawaban benar (bukan lelucon, bukan "semua benar"/"semua salah");',
    '- pertanyaan jelas, berdiri sendiri, tidak saling menyontek jawaban soal lain;',
    `- pertanyaan maksimal ${QUIZGEN_LIMITS.PERTANYAAN_MAX_CHARS} karakter, tiap pilihan maksimal ${QUIZGEN_LIMITS.PILIHAN_MAX_CHARS} karakter;`,
    '- "penjelasan" singkat (1–2 kalimat) mengapa jawaban itu benar menurut materi.',
    'Jangan mengulang atau memparafrasekan soal yang sudah ada di kuis.',
    UNTRUSTED_NOTICE,
    'Balas HANYA dengan satu objek JSON dengan bentuk persis:',
    '{"questions":[{"pertanyaan":"...","pilihan_a":"...","pilihan_b":"...","pilihan_c":"...","pilihan_d":"...","jawaban_benar":"a","penjelasan":"..."}]}',
    'dengan "jawaban_benar" salah satu dari "a", "b", "c", "d".',
  ].join('\n')

  const parts = [
    `Buat ${ask} soal pilihan ganda dengan tingkat kesulitan ${DIFFICULTY_HINT[req.difficulty]}.`,
    '',
    wrapUntrusted('JUDUL_MATERI', req.lesson.judul || '(tanpa judul)', QUIZGEN_LIMITS.JUDUL_MAX_CHARS),
    '',
    wrapUntrusted('MATERI', req.lesson.konten, QUIZGEN_LIMITS.PROMPT_LESSON_CHARS),
  ]
  const shown = req.existing.slice(0, QUIZGEN_LIMITS.EXISTING_IN_PROMPT)
  if (shown.length > 0) {
    parts.push(
      '',
      'Soal yang SUDAH ADA di kuis (jangan dibuat ulang):',
      wrapUntrusted('SOAL_YANG_ADA', shown.map((q, i) => `${i + 1}. ${q.slice(0, 300)}`).join('\n'), 20_000),
    )
  }
  return { system, user: parts.join('\n') }
}

// ────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────

/** Comparison key: case-, whitespace- and trailing-punctuation-insensitive. */
export function quizGenKey(s: string): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'“”‘’(]+|[\s"'“”‘’).,;:!?…]+$/g, '')
}

/** Normalise an answer letter: 'A', 'a.', '(b)', 'c)', ' D ', 'pilihan_c', 'Opsi B' → 'a'..'d'. Else null. */
export function normalizeAnswerLetter(raw: unknown): QuizGenLetter | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  const m = s.match(/^(?:(?:pilihan|opsi|jawaban)[\s_:-]*)?\(?([a-d])\s*[).:]?$/)
  return m ? (m[1] as QuizGenLetter) : null
}

/** Coerce a field to trimmed text (strings and finite numbers only). */
function text(v: unknown): string | null {
  if (typeof v === 'string') return v.replace(/\r\n?/g, '\n').trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

/** Why a question was rejected (for tests / logging). */
export type QuizGenRejectReason =
  | 'not_object'
  | 'missing_field'
  | 'too_long'
  | 'duplicate_options'
  | 'bad_answer'
  | 'duplicate'

/**
 * Strictly validate one question. Returns the cleaned question or a reason.
 * Rules: pertanyaan + 4 options non-empty after trim and within limits; the 4
 * options distinct (case/whitespace-insensitive); jawaban_benar normalisable
 * to a–d; penjelasan optional (defaults to '') but bounded.
 */
export function checkQuizGenQuestion(
  raw: unknown,
): { ok: true; question: GeneratedQuizQuestion } | { ok: false; reason: QuizGenRejectReason } {
  const L = QUIZGEN_LIMITS
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not_object' }
  const r = raw as Record<string, unknown>
  const pertanyaan = text(r.pertanyaan)
  const options = OPTION_KEYS.map((k) => text(r[k]))
  if (!pertanyaan || options.some((o) => !o)) return { ok: false, reason: 'missing_field' }
  const penjelasan = r.penjelasan === undefined || r.penjelasan === null ? '' : text(r.penjelasan)
  if (penjelasan === null) return { ok: false, reason: 'missing_field' }
  if (
    pertanyaan.length > L.PERTANYAAN_MAX_CHARS ||
    options.some((o) => o!.length > L.PILIHAN_MAX_CHARS) ||
    penjelasan.length > L.PENJELASAN_MAX_CHARS
  ) {
    return { ok: false, reason: 'too_long' }
  }
  const keys = new Set(options.map((o) => quizGenKey(o!)))
  if (keys.size !== 4 || keys.has('')) return { ok: false, reason: 'duplicate_options' }
  const jawaban = normalizeAnswerLetter(r.jawaban_benar)
  if (!jawaban) return { ok: false, reason: 'bad_answer' }
  return {
    ok: true,
    question: {
      pertanyaan,
      pilihan_a: options[0]!,
      pilihan_b: options[1]!,
      pilihan_c: options[2]!,
      pilihan_d: options[3]!,
      jawaban_benar: jawaban,
      penjelasan,
    },
  }
}

/** Convenience wrapper of {@link checkQuizGenQuestion}: the cleaned question or null. */
export function validateQuizGenQuestion(raw: unknown): GeneratedQuizQuestion | null {
  const r = checkQuizGenQuestion(raw)
  return r.ok ? r.question : null
}

/** Result of {@link validateQuizGenOutput}. */
export interface QuizGenValidation {
  questions: GeneratedQuizQuestion[]
  dropped: Array<{ index: number; reason: QuizGenRejectReason }>
}

/**
 * Validate a parsed model reply `{ "questions": [...] }` (a bare array is also
 * tolerated). Malformed questions and duplicates (of each other or of
 * `existing`) are dropped, not fatal; the rest is truncated to `count`.
 * A non-object / garbage reply yields zero questions.
 */
export function validateQuizGenOutput(
  raw: unknown,
  opts: { count: number; existing?: readonly string[] },
): QuizGenValidation {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { questions?: unknown }).questions)
      ? ((raw as { questions: unknown[] }).questions)
      : null
  const out: QuizGenValidation = { questions: [], dropped: [] }
  if (!list) return out
  const seen = new Set((opts.existing ?? []).map(quizGenKey).filter(Boolean))
  const limit = Math.max(0, Math.floor(opts.count))
  list.forEach((item, index) => {
    const r = checkQuizGenQuestion(item)
    if (!r.ok) {
      out.dropped.push({ index, reason: r.reason })
      return
    }
    const key = quizGenKey(r.question.pertanyaan)
    if (seen.has(key)) {
      out.dropped.push({ index, reason: 'duplicate' })
      return
    }
    seen.add(key)
    if (out.questions.length < limit) out.questions.push(r.question)
  })
  return out
}

// ────────────────────────────────────────────
// Seeded RNG & option shuffle
// ────────────────────────────────────────────

/** Random source: returns a float in [0, 1). */
export type QuizGenRng = () => number

/** Small seedable PRNG (mulberry32). Same seed ⇒ same sequence. */
export function quizGenRng(seed: number): QuizGenRng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Default seed for a request: stable hash of the input. */
export function quizGenSeed(req: Pick<QuizGenRequest, 'lesson' | 'count' | 'difficulty'>): number {
  return parseInt(hashText(`${req.lesson.judul}\n${req.lesson.konten}\n${req.count}\n${req.difficulty}`).slice(0, 8), 16) >>> 0
}

/**
 * Shuffle a question's options (Fisher–Yates with `rng`) and remap
 * `jawaban_benar` so it still points at the same option text. Pure.
 */
export function shuffleQuizOptions(q: GeneratedQuizQuestion, rng: QuizGenRng): GeneratedQuizQuestion {
  const opts = OPTION_KEYS.map((k, i) => ({ text: q[k], correct: LETTERS[i] === q.jawaban_benar }))
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[opts[i], opts[j]] = [opts[j]!, opts[i]!]
  }
  return {
    ...q,
    pilihan_a: opts[0]!.text,
    pilihan_b: opts[1]!.text,
    pilihan_c: opts[2]!.text,
    pilihan_d: opts[3]!.text,
    jawaban_benar: LETTERS[opts.findIndex((o) => o.correct)]!,
  }
}

// ────────────────────────────────────────────
// Deterministic fallback (demo mode / AI unavailable)
// ────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    'yang dan di ke dari untuk dengan pada adalah ini itu atau juga dalam akan tidak dapat bisa oleh sebagai karena ' +
    'sehingga maka jika kita kami anda kamu mereka dia ia ada lebih sangat sudah telah setiap semua bahwa tersebut ' +
    'seperti antara hanya harus agar saat ketika merupakan yaitu yakni suatu sebuah para secara digunakan menggunakan ' +
    'banyak beberapa serta namun tetapi bagi hal cara contoh misalnya biasanya lain sama baik satu dua tiga empat lima ' +
    'apa bagaimana mengapa kapan dimana mana berikut lalu kemudian setelah sebelum selama hingga sampai masih belum ' +
    'perlu boleh mungkin sering selalu pernah tentang terhadap melalui menjadi membuat dibuat memiliki punya berupa ' +
    'bentuk jenis bagian dimana sedangkan apabila bila kalau karenanya pula saja lagi nya pun tiap sendiri disebut ' +
    'yaitu adanya antaranya tanpa begitu demikian umumnya tertentu misal artinya berarti ' +
    'the and for with that this from are was were has have not but you your can will into than then also such use used'
  ).split(/\s+/),
)

/** Light Markdown/HTML stripping that keeps the original casing; code blocks are removed (poor cloze material). */
function plainLessonText(src: string): string {
  let s = String(src ?? '').replace(/\r\n?/g, '\n')
  s = s.replace(/(```|~~~)[\s\S]*?(\1|$)/g, '\n')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<\/?[a-zA-Z][^<>]*>/g, ' ')
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/`+/g, '').replace(/(\*\*|__|\*|~~)/g, '').replace(/\|/g, ' ')
  return s
}

/** Split into candidate sentences (headings and list items become their own lines). */
function sentencesOf(plain: string): string[] {
  const lines = plain
    .split('\n')
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/^\s*>\s?/, '').trim())
    .filter(Boolean)
  const out: string[] = []
  for (const line of lines) {
    for (const s of line.split(/(?<=[.!?…])\s+(?=[A-Z0-9"“(])/)) {
      const t = s.replace(/\s+/g, ' ').trim()
      if (t) out.push(t)
    }
  }
  return out
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}_-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu

/** A candidate key term of the lesson. */
interface Term {
  key: string
  display: string
  count: number
  score: number
  /** Rough Indonesian verb heuristic (me-/ber-/ter-/di- forms), used to keep options of a similar kind. */
  verbish: boolean
}

/** Very rough: affixed Indonesian verb forms like menghasilkan, bernilai, dipakai, terpenuhi. */
function isVerbish(key: string): boolean {
  return key.length >= 7 && /^(?:me(?:ng|ny|m|n)?|ber|ter|di)\p{L}{3,}$/u.test(key) && (!key.endsWith('an') || key.endsWith('kan'))
}

function isTermToken(w: string): boolean {
  const k = w.toLowerCase()
  return k.length >= 4 && !STOPWORDS.has(k) && !/^\d+$/.test(k) && /\p{L}/u.test(k)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word, case-insensitive matcher for a term (Unicode-aware boundaries). */
function termRegex(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(term)}(?![\\p{L}\\p{N}_])`, 'giu')
}

const CLOZE_LEAD = 'Lengkapi pernyataan berikut sesuai materi'

/** Shared message when the fallback cannot build any question (use with a 422). */
export const QUIZGEN_TOO_SHORT_MESSAGE =
  'Materi terlalu pendek atau kurang bervariasi untuk membuat soal contoh (mode demo). ' +
  'Tambahkan beberapa kalimat penjelasan yang memuat istilah-istilah kunci, lalu coba lagi.'

/**
 * Deterministic, offline question generator (no LLM).
 *
 * Builds cloze ("isian rumpang") questions: an informative sentence from the
 * lesson with one key term blanked out; the three distractors are other key
 * terms from the same lesson that do not appear in that sentence. Quality is
 * placeholder-grade — enough to demonstrate the review flow offline — and the
 * API labels the result `source: 'demo'`.
 *
 * Guarantees: every question passes {@link validateQuizGenQuestion}; no
 * duplicates of each other or of `existing`; at most `count` questions; same
 * input + seed ⇒ same output. Returns `[]` when the lesson is too short /
 * has too few distinct terms (the route turns that into a 422).
 * Options are NOT shuffled here (callers shuffle, see {@link runQuizGeneration}).
 */
export function generateDemoQuiz(req: QuizGenRequest, rng: QuizGenRng): GeneratedQuizQuestion[] {
  const judul = req.lesson.judul.trim() || 'materi ini'
  const sentences = sentencesOf(plainLessonText(req.lesson.konten))

  // Key terms: frequency over the whole lesson, mild bonus for length. The display form is the
  // most frequent spelling outside sentence-initial position (so "Variabel" at a sentence start
  // doesn't make the answer look different from lowercase distractors).
  const terms = new Map<string, Term>()
  const surface = new Map<string, Map<string, number>>()
  for (const s of sentences) {
    ;(s.match(WORD_RE) ?? []).forEach((w, i) => {
      if (!isTermToken(w)) return
      const key = w.toLowerCase()
      const t = terms.get(key) ?? { key, display: key, count: 0, score: 0, verbish: isVerbish(key) }
      t.count++
      terms.set(key, t)
      if (i === 0) return
      const forms = surface.get(key) ?? new Map<string, number>()
      forms.set(w, (forms.get(w) ?? 0) + 1)
      surface.set(key, forms)
    })
  }
  for (const t of terms.values()) {
    const forms = [...(surface.get(t.key)?.entries() ?? [])].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    t.display = forms[0]?.[0] ?? t.key
    const capital = /^\p{Lu}/u.test(t.display) ? 0.5 : 0
    t.score = Math.log(1 + t.count) + Math.min(t.key.length, 12) / 12 + capital - (t.verbish ? 0.75 : 0)
  }
  const pool = [...terms.values()].sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1))
  if (pool.length < 4) return []

  // Informative sentences: 6–45 words, 30–300 chars, with at least one key term.
  type Cand = { sentence: string; order: number; weight: number }
  const cands: Cand[] = []
  sentences.forEach((sentence, order) => {
    const words = sentence.match(WORD_RE) ?? []
    if (words.length < 6 || words.length > 45 || sentence.length < 30 || sentence.length > 300) return
    const termScores = words.filter(isTermToken).map((w) => terms.get(w.toLowerCase())?.score ?? 0)
    if (termScores.length === 0) return
    const weight = termScores.reduce((x, y) => x + y, 0) / Math.sqrt(words.length) + rng() * 0.75
    cands.push({ sentence, order, weight })
  })
  cands.sort((a, b) => b.weight - a.weight || a.order - b.order)

  const seen = new Set(req.existing.map(quizGenKey).filter(Boolean))
  // Words of the title and of the fixed lead-in are shown in every question, so they must never be the blanked answer.
  const titleWords = new Set(`${CLOZE_LEAD} ${judul}`.match(WORD_RE)!.map((w) => w.toLowerCase()))
  const usedAnswers = new Set<string>()
  const out: GeneratedQuizQuestion[] = []

  for (const c of cands) {
    if (out.length >= req.count) break
    const inSentence = new Set((c.sentence.match(WORD_RE) ?? []).map((w) => w.toLowerCase()))
    // Answer: best-scoring key term in this sentence, not in the title, not used as an answer yet
    // (noun-like terms rank above verb-like ones via the score).
    const answer = pool.find((t) => inSentence.has(t.key) && !usedAnswers.has(t.key) && !titleWords.has(t.key))
    if (!answer) continue
    const blanked = c.sentence.replace(termRegex(answer.key), '_____')
    if (!blanked.includes('_____')) continue

    // Distractors: other key terms NOT in the sentence (so the blanked text can't give them away),
    // preferring the same rough word kind as the answer, drawn with seeded variation.
    const others = pool.filter((t) => t.key !== answer.key && !inSentence.has(t.key))
    if (others.length < 3) continue
    const sameKind = others.filter((t) => t.verbish === answer.verbish)
    const ranked = [...sameKind, ...others.filter((t) => t.verbish !== answer.verbish)]
    const bag = ranked.slice(0, Math.max(6, Math.min(sameKind.length, 12)))
    const picked: Term[] = []
    while (picked.length < 3 && bag.length > 0) {
      const idx = Math.floor(rng() * bag.length)
      picked.push(bag.splice(idx, 1)[0]!)
    }
    if (picked.length < 3) continue

    const atStart = blanked.startsWith('_____')
    const show = (t: Term) => (atStart ? t.display.charAt(0).toLocaleUpperCase('id') + t.display.slice(1) : t.display)
    const candidate = {
      pertanyaan: `${CLOZE_LEAD} "${judul}":\n"${blanked}"`,
      pilihan_a: show(answer),
      pilihan_b: show(picked[0]!),
      pilihan_c: show(picked[1]!),
      pilihan_d: show(picked[2]!),
      jawaban_benar: 'a',
      penjelasan: `Kalimat asli pada materi: "${c.sentence}"`,
    }
    const q = validateQuizGenQuestion(candidate)
    if (!q) continue
    const key = quizGenKey(q.pertanyaan)
    if (seen.has(key)) continue
    seen.add(key)
    usedAnswers.add(answer.key)
    out.push(q)
  }
  return out
}

// ────────────────────────────────────────────
// Orchestration
// ────────────────────────────────────────────

/**
 * Model caller: send the prompt in JSON mode and validate with `validate`.
 * In the route this is `(o, v) => chatJson(event, o, v)`; tests pass
 * `chatJsonWith(config, o, v, { fetch: mock })`. Must throw an
 * `AiUnavailableError` (name 'AiUnavailableError') when no usable answer exists.
 */
export type QuizGenModelCall = (
  opts: { system: string; user: string; temperature?: number; maxTokens?: number },
  validate: (raw: unknown) => GeneratedQuizQuestion[] | null,
) => Promise<GeneratedQuizQuestion[]>

/** Thrown when neither the model nor the fallback produced any valid question (route ⇒ 422). */
export class QuizGenEmptyError extends Error {
  constructor(message = QUIZGEN_TOO_SHORT_MESSAGE) {
    super(message)
    this.name = 'QuizGenEmptyError'
  }
}

const isUnavailable = (err: unknown) => (err as { name?: unknown } | null)?.name === 'AiUnavailableError'

/**
 * Full generation pipeline:
 *   1. ask the model (unless `callModel` is null ⇒ demo) and validate strictly;
 *      zero valid questions counts as "unavailable";
 *   2. on AiUnavailableError ⇒ deterministic fallback (`source: 'demo'`);
 *      any other error (e.g. H3 429 budget) propagates;
 *   3. shuffle options with a seeded RNG and remap the answer.
 *
 * @throws QuizGenEmptyError when nothing valid could be produced
 */
export async function runQuizGeneration(
  req: QuizGenRequest,
  callModel: QuizGenModelCall | null,
  opts: { rng?: QuizGenRng; onFallback?: (err: unknown) => void } = {},
): Promise<QuizGenResponse> {
  const rng = opts.rng ?? quizGenRng(req.seed ?? quizGenSeed(req))
  let questions: GeneratedQuizQuestion[] = []
  let source: 'ai' | 'demo' = 'ai'

  if (callModel) {
    try {
      const prompt = buildQuizGenPrompt(req)
      questions = await callModel(
        { ...prompt, temperature: 0.4, maxTokens: Math.min(4000, 300 + quizGenAskCount(req.count) * 280) },
        (raw) => {
          const v = validateQuizGenOutput(raw, { count: req.count, existing: req.existing })
          return v.questions.length > 0 ? v.questions : null
        },
      )
      // Defensive: re-check whatever the caller returned.
      questions = validateQuizGenOutput(questions, { count: req.count, existing: req.existing }).questions
    } catch (err) {
      if (!isUnavailable(err)) throw err
      opts.onFallback?.(err)
      questions = []
    }
  }

  if (questions.length === 0) {
    source = 'demo'
    questions = generateDemoQuiz(req, rng)
  }
  if (questions.length === 0) throw new QuizGenEmptyError()

  const shuffled = questions.map((q) => shuffleQuizOptions(q, rng))
  return { questions: shuffled, source, requested: req.count, generated: shuffled.length }
}
