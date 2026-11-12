/**
 * Global search — pure indexing + ranking (no Pinia, no Nuxt globals).
 * Shared by the GlobalSearch palette (client) and GET /api/search (server).
 *
 * Ranking is lexical: per query token, the best match over the item's fields
 * (exact word > word prefix > base word + suffix > substring > 1-typo fuzzy), weighted by field
 * (title > keywords > subtitle > body), times the share of tokens matched.
 * An optional per-item `semantic` score (cosine, 0..1) — from the local
 * embedding in server/utils/aiText.ts or from pgvector — is added as a boost
 * and can surface items that have no lexical match when it is high enough.
 */

export type SearchType = 'command' | 'course' | 'lesson' | 'quiz' | 'assignment' | 'thread'
export type SearchRole = 'student' | 'instructor' | 'admin'

export interface SearchItem {
  id: string
  type: SearchType
  title: string
  subtitle?: string
  keywords?: string
  body?: string
  /** Route to open. Commands with `action` may omit it. */
  to?: string
  icon?: string
  /** Client-side command id (e.g. 'toggle-theme'). */
  action?: string
  course_id?: string | null
}

export interface SearchHit extends SearchItem {
  score: number
}

export interface SearchGroup {
  type: SearchType
  label: string
  items: SearchHit[]
}

export const TYPE_ORDER: readonly SearchType[] = ['command', 'course', 'lesson', 'quiz', 'assignment', 'thread']

export const TYPE_LABELS: Record<SearchType, string> = {
  command: 'Perintah & Halaman',
  course: 'Mata Kuliah',
  lesson: 'Materi',
  quiz: 'Kuis',
  assignment: 'Tugas',
  thread: 'Forum',
}

export const TYPE_ICONS: Record<SearchType, string> = {
  command: '⚡',
  course: '📖',
  lesson: '📄',
  quiz: '✍️',
  assignment: '📝',
  thread: '💬',
}

const FIELD_WEIGHTS = { title: 3, keywords: 2, subtitle: 1.5, body: 0.5 } as const
const MAX_BODY_CHARS = 4000
export const MIN_COVERAGE = 0.6
export const SEMANTIC_WEIGHT = 3
/** Semantic-only hits (no lexical match) need at least this cosine. */
export const SEMANTIC_ONLY_MIN = 0.45

/** Lowercase, strip diacritics, keep letters/digits, collapse whitespace. */
export function normalizeSearch(text: unknown): string {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function tokenize(text: unknown): string[] {
  const n = normalizeSearch(text)
  return n ? n.split(' ') : []
}

/** True if a and b differ by at most one edit (insert/delete/substitute/adjacent swap). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  while (i < la && i < lb && a[i] === b[i]) i++
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2) // swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

interface PreparedField {
  weight: number
  text: string
  words: string[]
  fuzzy: boolean
}

function prepare(item: SearchItem): PreparedField[] {
  const out: PreparedField[] = []
  const add = (value: string | undefined, weight: number, fuzzy: boolean, max?: number) => {
    if (!value) return
    const text = normalizeSearch(max ? value.slice(0, max) : value)
    if (text) out.push({ weight, text, words: text.split(' '), fuzzy })
  }
  add(item.title, FIELD_WEIGHTS.title, true)
  add(item.keywords, FIELD_WEIGHTS.keywords, true)
  add(item.subtitle, FIELD_WEIGHTS.subtitle, false)
  add(item.body, FIELD_WEIGHTS.body, false, MAX_BODY_CHARS)
  return out
}

function tokenMatch(token: string, f: PreparedField): number {
  let best = 0
  for (const w of f.words) {
    if (w === token) return 1
    if (token.length >= 2 && w.startsWith(token)) best = Math.max(best, 0.8)
    else if (token.length >= 3 && w.includes(token)) best = Math.max(best, 0.5)
    // Indonesian suffixes: "variabelnya", "perulangannya", "hitungkan" → base word.
    else if (w.length >= 4 && token.startsWith(w) && token.length - w.length <= 4) best = Math.max(best, 0.6)
    else if (f.fuzzy && token.length >= 4 && w.length >= 4 && withinOneEdit(token, w)) best = Math.max(best, 0.4)
  }
  return best
}

/** Lexical score of one item (0 = no match / below coverage). */
export function lexicalScore(query: string, item: SearchItem): number {
  const tokens = [...new Set(tokenize(query))]
  if (tokens.length === 0) return 0
  const fields = prepare(item)
  if (fields.length === 0) return 0

  let sum = 0
  let matched = 0
  for (const t of tokens) {
    let best = 0
    for (const f of fields) best = Math.max(best, f.weight * tokenMatch(t, f))
    if (best > 0) matched++
    sum += best
  }
  const coverage = matched / tokens.length
  if (coverage < MIN_COVERAGE) return 0

  const q = tokens.join(' ')
  const title = fields[0]?.weight === FIELD_WEIGHTS.title ? fields[0].text : ''
  let bonus = 0
  if (title === q) bonus = 3
  else if (title.startsWith(q)) bonus = 2
  else if (tokens.length > 1 && title.includes(q)) bonus = 1.5
  return (sum / tokens.length + bonus) * coverage
}

export interface RankOptions {
  limit?: number
  /** Cosine similarity per item id (0..1), e.g. local embedding or pgvector. */
  semantic?: Map<string, number> | Record<string, number>
}

/** Rank items for a query; ties prefer the shorter title, then input order. */
export function rankItems(query: string, items: SearchItem[], opts: RankOptions = {}): SearchHit[] {
  const sem = opts.semantic instanceof Map ? opts.semantic : new Map(Object.entries(opts.semantic ?? {}))
  const scored: Array<SearchHit & { _i: number }> = []
  items.forEach((item, i) => {
    const lex = lexicalScore(query, item)
    const s = Math.max(0, Math.min(1, Number(sem.get(item.id) ?? 0)))
    if (lex <= 0 && s < SEMANTIC_ONLY_MIN) return
    scored.push({ ...item, score: Math.round((lex + SEMANTIC_WEIGHT * s) * 1000) / 1000, _i: i })
  })
  // Ties: shorter (more specific) title first, then input order.
  scored.sort((a, b) => b.score - a.score || a.title.length - b.title.length || a._i - b._i)
  const out = scored.map(({ _i, ...hit }) => hit)
  return opts.limit ? out.slice(0, opts.limit) : out
}

/** Group hits by type in TYPE_ORDER, at most `perGroup` each, preserving rank order. */
export function groupHits(hits: SearchHit[], perGroup = 5): SearchGroup[] {
  return TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: hits.filter((h) => h.type === type).slice(0, perGroup),
  })).filter((g) => g.items.length > 0)
}

// ────────────────────────────────────────────
// Index building (role-aware)
// ────────────────────────────────────────────

export interface IndexCourse { id: string; kode: string; nama: string; deskripsi?: string | null }
export interface IndexLesson { id: string; course_id: string; judul: string; konten?: string | null }
export interface IndexQuiz { id: string; course_id: string; judul: string; deskripsi?: string | null; is_active?: boolean }
export interface IndexAssignment { id: string; course_id: string; judul: string; deskripsi?: string | null }
export interface IndexThread { id: string; course_id: string; judul: string; konten?: string | null }

export interface IndexSource {
  role: SearchRole
  /** Courses the user may see (enrolled / taught / all for admin). Everything else is filtered by these. */
  courses: IndexCourse[]
  lessons?: IndexLesson[]
  quizzes?: IndexQuiz[]
  assignments?: IndexAssignment[]
  threads?: IndexThread[]
}

/** Routes per role; `null` = this role has no page for the type (item is skipped). */
export function routeFor(role: SearchRole, type: Exclude<SearchType, 'command'>, id: string, courseId: string): string | null {
  if (role === 'student') {
    switch (type) {
      case 'course': return `/courses/${courseId}`
      case 'lesson': return `/courses/${courseId}/lessons/${id}`
      case 'quiz': return `/quiz/${id}`
      case 'assignment': return `/assignments/${id}`
      case 'thread': return `/courses/${courseId}/forum/${id}`
    }
  }
  if (role === 'instructor') {
    switch (type) {
      case 'course': return `/instructor/courses/${courseId}`
      case 'lesson': return `/instructor/courses/${courseId}/lessons`
      case 'quiz': return `/instructor/courses/${courseId}/quiz`
      case 'assignment': return `/instructor/courses/${courseId}/assignments`
      case 'thread': return `/instructor/courses/${courseId}/forum/${id}`
    }
  }
  // admin
  switch (type) {
    case 'course': return '/admin/courses'
    case 'quiz': return '/admin/quiz'
    case 'assignment': return '/admin/assignments'
    case 'lesson': return `/instructor/courses/${courseId}/lessons`
    case 'thread': return `/instructor/courses/${courseId}/forum/${id}`
  }
  return null
}

/**
 * Build the searchable items a user may see. Lessons/quizzes/assignments/threads
 * outside `source.courses` are dropped; students only see active quizzes.
 */
export function buildSearchIndex(source: IndexSource): SearchItem[] {
  const role = source.role
  const courseById = new Map(source.courses.map((c) => [c.id, c]))
  const items: SearchItem[] = []
  const label = (cid: string) => {
    const c = courseById.get(cid)
    return c ? `${c.kode} · ${c.nama}` : ''
  }
  const push = (type: Exclude<SearchType, 'command'>, id: string, courseId: string, fields: Omit<SearchItem, 'id' | 'type' | 'to'>) => {
    if (!courseById.has(courseId)) return
    const to = routeFor(role, type, id, courseId)
    if (!to) return
    items.push({ id: `${type}:${id}`, type, to, icon: TYPE_ICONS[type], course_id: courseId, ...fields })
  }

  for (const c of source.courses) {
    push('course', c.id, c.id, { title: c.nama, subtitle: c.kode, keywords: c.kode, body: c.deskripsi ?? '' })
  }
  for (const l of source.lessons ?? []) {
    push('lesson', l.id, l.course_id, { title: l.judul, subtitle: label(l.course_id), body: l.konten ?? '' })
  }
  for (const q of source.quizzes ?? []) {
    if (role === 'student' && q.is_active === false) continue
    push('quiz', q.id, q.course_id, { title: q.judul, subtitle: label(q.course_id), body: q.deskripsi ?? '' })
  }
  for (const a of source.assignments ?? []) {
    push('assignment', a.id, a.course_id, { title: a.judul, subtitle: label(a.course_id), body: a.deskripsi ?? '' })
  }
  for (const t of source.threads ?? []) {
    push('thread', t.id, t.course_id, { title: t.judul, subtitle: label(t.course_id), body: t.konten ?? '' })
  }
  return items
}

/** Navigation commands of the palette, per role. */
export function commandItems(role: SearchRole): SearchItem[] {
  const cmd = (id: string, title: string, icon: string, to?: string, keywords = '', action?: string): SearchItem => ({
    id: `command:${id}`, type: 'command', title, icon, to, keywords, action,
  })
  const common = [cmd('theme', 'Ganti tema terang/gelap', '🌓', undefined, 'tema dark light gelap terang mode', 'toggle-theme')]
  if (role === 'student') {
    return [
      cmd('dashboard', 'Dashboard', '📊', '/dashboard', 'beranda home'),
      cmd('courses', 'Mata Kuliah', '📖', '/courses', 'kursus course'),
      cmd('assignments', 'Tugas', '📝', '/assignments', 'assignment'),
      cmd('quiz', 'Kuis & Ujian', '✍️', '/quiz', 'ujian exam'),
      cmd('grades', 'Nilai', '🏆', '/student/grades', 'grade transkrip'),
      cmd('progress', 'Progres & Badge', '🏅', '/student/progress', 'streak sertifikat lencana gamifikasi'),
      cmd('calendar', 'Kalender', '📅', '/calendar', 'jadwal'),
      cmd('ai', 'AI Tutor', '🤖', '/ai/chat', 'chat tanya'),
      cmd('profile', 'Profil', '👤', '/profile', 'akun'),
      ...common,
    ]
  }
  if (role === 'instructor') {
    return [
      cmd('dashboard', 'Dashboard Instruktur', '📊', '/instructor/dashboard', 'beranda home'),
      cmd('courses', 'Mata Kuliah Saya', '📖', '/instructor/courses', 'kursus course'),
      cmd('assignments', 'Tugas', '📝', '/instructor/assignments', 'penilaian'),
      cmd('quiz', 'Kuis', '✍️', '/instructor/quiz', 'ujian'),
      cmd('students', 'Mahasiswa', '🎓', '/instructor/students', 'roster'),
      cmd('ai', 'AI Assistant', '🤖', '/ai/chat', 'chat'),
      ...common,
    ]
  }
  return [
    cmd('dashboard', 'Dashboard Admin', '📊', '/admin/dashboard', 'beranda home'),
    cmd('courses', 'Kelola Mata Kuliah', '📖', '/admin/courses', 'kursus'),
    cmd('students', 'Kelola Mahasiswa', '🎓', '/admin/students', 'roster'),
    cmd('instructors', 'Kelola Instruktur', '👩‍🏫', '/admin/instructors', 'dosen'),
    ...common,
  ]
}
