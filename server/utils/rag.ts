/**
 * RAG — Retrieval for the AI tutor, grounded in lesson content (`lessons.konten`).
 *
 * Two retrieval backends (chosen per request in `server/api/ai/chat.post.ts`):
 *   1. Client-context (default, demo mode): the client sends the lessons of the
 *      user's courses (`context.lessons`). We chunk them, embed chunks + question
 *      in ONE embedding call (so they share a mode), and rank by cosine similarity.
 *      Chunk vectors are cached in memory (content hash + mode, bounded LRU).
 *   2. pgvector (production, needs the service role key): `match_lesson_chunks`
 *      RPC over `lesson_chunks`, restricted to the user's courses.
 *
 * Also: the extractive (no-LLM) grounded answer, prompt building, SSE framing,
 * and the core of POST /api/ai/index-lessons.
 *
 * Everything here is testable without Nitro: side effects (embedding, DB) are
 * injected. Only the `ai.ts` / `aiText.ts` helpers are imported.
 */
import { createError } from 'h3'
import {
  chunkText,
  cosineSimilarity,
  hashText,
  localEmbedding,
  normalizeForEmbedding,
  topKBySimilarity,
  wrapUntrusted,
  UNTRUSTED_NOTICE,
} from './aiText'
import { EMBEDDING_DIMS, MAX_EMBED_INPUT_CHARS, MAX_EMBED_TEXTS, type EmbedResult } from './ai'

// ────────────────────────────────────────────
// Limits & tuning
// ────────────────────────────────────────────

/** Requests with more lessons than this are rejected (400). */
export const MAX_CONTEXT_LESSONS = 100
/** Per-lesson text kept (longer text is truncated). */
export const MAX_LESSON_CHARS = 20_000
/** Total lesson text kept per request; lessons beyond this are dropped. */
export const MAX_CONTEXT_TOTAL_CHARS = 150_000
/** Raw payload guard: total characters of all lesson texts as received (before truncation). */
export const MAX_CONTEXT_RAW_CHARS = 1_000_000
/** Max chunks embedded per request (+1 for the question must fit one embedTexts call). */
export const MAX_CONTEXT_CHUNKS = MAX_EMBED_TEXTS - 1
export const MAX_TITLE_CHARS = 200
const MAX_ID_CHARS = 100

/** Chunking for API (semantic) embeddings and for the pgvector index. */
export const CHUNK_OPTIONS = { maxChars: 700, overlap: 80 } as const
/**
 * Chunking for the lexical local embedding (demo mode, client-context backend):
 * smaller chunks, because lexical cosine is diluted by long chunks and a short
 * question would otherwise score low even against the right paragraph.
 */
export const LOCAL_CHUNK_OPTIONS = { maxChars: 320, overlap: 0 } as const

/**
 * Minimum cosine similarity for a chunk to count as relevant, per embedding mode.
 * 'local' is the lexical feature-hashing embedding (calibrated on the demo lessons,
 * see app/test/server/rag.test.ts); 'api' is for text-embedding-3-* style models.
 */
export const MIN_SCORE: Record<'api' | 'local', number> = { api: 0.3, local: 0.2 }
/** Chunks scoring below `best * RELATIVE_CUTOFF` are dropped (keeps weak extra sources out). */
export const RELATIVE_CUTOFF = 0.55
/** Max chunks given to the model / extractive answer. */
export const MAX_CONTEXT_CHUNKS_RETURNED = 5
/** Max chunks from the same lesson in the context (local chunks are ~half the size). */
export const MAX_CHUNKS_PER_LESSON: Record<'api' | 'local', number> = { api: 2, local: 3 }
/** Max sources returned to the client (deduplicated per lesson). */
export const MAX_SOURCES = 3
const EXCERPT_CHARS = 220

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

/** A lesson sent by the client as retrieval context. */
export interface RagLesson {
  id: string
  course_id: string
  course_kode: string
  course_nama: string
  judul: string
  konten: string
}

/** A retrievable chunk of a lesson. */
export interface RagChunk {
  lesson_id: string
  course_id: string
  course_kode: string
  judul: string
  chunk_index: number
  content: string
}

export interface ScoredChunk extends RagChunk {
  score: number
}

/** Source shown under an answer (same shape in JSON and SSE). */
export interface RagSource {
  lesson_id: string
  course_id: string
  course_kode: string
  judul: string
  excerpt: string
  score: number
}

export interface RetrievalResult {
  chunks: ScoredChunk[]
  sources: RagSource[]
  mode: 'api' | 'local' | null
  backend: 'context' | 'pgvector' | 'none'
}

export type EmbedFn = (texts: string[]) => Promise<EmbedResult>

// ────────────────────────────────────────────
// Payload validation
// ────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Validate and cap `context.lessons` from a chat request.
 * - not an array / missing ⇒ `[]`
 * - more than {@link MAX_CONTEXT_LESSONS} entries or more than {@link MAX_CONTEXT_RAW_CHARS}
 *   characters of text ⇒ H3 400
 * - entries without id / course_id / text are dropped, duplicate ids keep the first
 * - each text truncated to {@link MAX_LESSON_CHARS}; lessons that would push the total
 *   over {@link MAX_CONTEXT_TOTAL_CHARS} are dropped
 */
export function sanitizeContextLessons(raw: unknown): { lessons: RagLesson[]; truncated: boolean } {
  if (!Array.isArray(raw)) return { lessons: [], truncated: false }
  if (raw.length > MAX_CONTEXT_LESSONS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Konteks materi terlalu banyak (${raw.length}). Maksimal ${MAX_CONTEXT_LESSONS} materi.`,
    })
  }
  let rawChars = 0
  for (const l of raw) rawChars += typeof l?.konten === 'string' ? l.konten.length : 0
  if (rawChars > MAX_CONTEXT_RAW_CHARS) {
    throw createError({ statusCode: 400, statusMessage: 'Konteks materi terlalu besar.' })
  }

  const lessons: RagLesson[] = []
  const seen = new Set<string>()
  let total = 0
  let truncated = false
  for (const l of raw) {
    if (!l || typeof l !== 'object') continue
    const id = str(l.id, MAX_ID_CHARS)
    const course_id = str(l.course_id, MAX_ID_CHARS)
    let konten = typeof l.konten === 'string' ? l.konten.trim() : ''
    if (!id || !course_id || !konten || seen.has(id)) continue
    if (konten.length > MAX_LESSON_CHARS) {
      konten = konten.slice(0, MAX_LESSON_CHARS)
      truncated = true
    }
    if (total + konten.length > MAX_CONTEXT_TOTAL_CHARS) {
      truncated = true
      continue
    }
    seen.add(id)
    total += konten.length
    lessons.push({
      id,
      course_id,
      course_kode: str(l.course_kode, 40),
      course_nama: str(l.course_nama, MAX_TITLE_CHARS),
      judul: str(l.judul, MAX_TITLE_CHARS) || 'Materi',
      konten,
    })
  }
  return { lessons, truncated }
}

/** Split lessons into retrieval chunks (capped at {@link MAX_CONTEXT_CHUNKS}). */
export function chunkLessons(
  lessons: RagLesson[],
  max = MAX_CONTEXT_CHUNKS,
  options: { maxChars: number; overlap: number } = CHUNK_OPTIONS,
): RagChunk[] {
  const out: RagChunk[] = []
  for (const l of lessons) {
    const pieces = chunkText(l.konten, options)
    for (let i = 0; i < pieces.length; i++) {
      if (out.length >= max) return out
      out.push({
        lesson_id: l.id,
        course_id: l.course_id,
        course_kode: l.course_kode,
        judul: l.judul,
        chunk_index: i,
        content: pieces[i]!,
      })
    }
  }
  return out
}

/**
 * Text that is embedded for a chunk: the lesson title plus the chunk, so a
 * question that names the topic also matches chunks that don't repeat it.
 */
export function chunkEmbeddingText(c: Pick<RagChunk, 'judul' | 'content'>): string {
  return `${c.judul}\n${c.content}`
}

/**
 * Question/function words that carry no topic. Only used with the *lexical*
 * local embedding (demo mode): there, words like "apa", "itu", "dan" otherwise
 * dominate the similarity and make unrelated questions match random lessons.
 * Not applied for API (semantic) embeddings.
 */
const STOPWORDS = new Set(
  (
    'apa apakah itu ini adalah ialah merupakan dan atau serta di ke dari yang untuk dengan dalam pada oleh ' +
    'bagaimana gimana cara jelaskan jelasin terangkan sebutkan siapa kapan mengapa kenapa berapa mana manakah dimana ' +
    'saja aja ada bisa dapat tolong mohon minta saya aku kamu anda kita kami tentang perbedaan beda bedanya contoh ' +
    'contohnya maksud maksudnya arti artinya pengertian tips dong ya yah sih kah jadi juga akan sebuah suatu tersebut ' +
    'para se nya lagi lebih paling sangat secara seperti agar supaya jika kalau bila tidak bukan belum sudah harus ' +
    'boleh mau ingin perlu the a an of to on is are what how why when who which explain please'
  ).split(/\s+/),
)

/** Remove {@link STOPWORDS} and bare numbers (for lexical matching only). */
export function stripStopwords(text: string): string {
  const kept = normalizeForEmbedding(text)
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  return kept.join(' ')
}

// ────────────────────────────────────────────
// Embedding cache (bounded LRU)
// ────────────────────────────────────────────

/** Bounded LRU of chunk vectors, keyed by mode + namespace + content hash. */
export class EmbeddingCache {
  private map = new Map<string, number[]>()
  hits = 0
  misses = 0
  constructor(readonly maxEntries = 2000) {}

  static key(mode: 'api' | 'local', namespace: string, text: string): string {
    return `${mode}|${namespace}|${hashText(text)}|${text.length}`
  }

  get(key: string): number[] | undefined {
    const v = this.map.get(key)
    if (v) {
      this.map.delete(key)
      this.map.set(key, v)
      this.hits++
    } else this.misses++
    return v
  }

  set(key: string, v: number[]): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, v)
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
    this.hits = 0
    this.misses = 0
  }
}

/** Process-wide cache used by the chat route. */
export const chunkEmbeddingCache = new EmbeddingCache(2000)

/** Same transform `embedTextsWith` applies for local vectors (keeps cached + fresh local vectors identical). */
function localVector(text: string): number[] {
  return localEmbedding(normalizeForEmbedding(text).slice(0, MAX_EMBED_INPUT_CHARS), EMBEDDING_DIMS)
}

export interface EmbedWithCacheOptions {
  embed: EmbedFn
  /** Mode we expect from `embed` (config.isDemo ? 'local' : 'api') — used for cache lookups. */
  expectedMode: 'api' | 'local'
  /** Distinguishes models: e.g. the embedding model name for 'api'. */
  namespace?: string
  cache?: EmbeddingCache
}

/**
 * Embed a question and chunk texts so that every returned vector has the SAME mode.
 *
 * Cached chunk vectors (for `expectedMode`) are reused; the question and all
 * uncached chunks go out in ONE `embed` call. If that call comes back in a
 * different mode (API failure ⇒ 'local'), cached vectors of the expected mode
 * are discarded and those chunks are embedded locally, so modes never mix.
 */
export async function embedQueryAndChunks(
  question: string,
  texts: string[],
  opts: EmbedWithCacheOptions,
): Promise<{ query: number[]; vectors: number[][]; mode: 'api' | 'local' }> {
  const cache = opts.cache ?? chunkEmbeddingCache
  const ns = opts.namespace ?? ''
  const keyFor = (mode: 'api' | 'local', t: string) => EmbeddingCache.key(mode, mode === 'local' ? 'local' : ns, t)

  const vectors: Array<number[] | undefined> = texts.map((t) => cache.get(keyFor(opts.expectedMode, t)))
  const missing = texts.map((_, i) => i).filter((i) => !vectors[i])

  const res = await opts.embed([question, ...missing.map((i) => texts[i]!)])
  const query = res.vectors[0] ?? []
  missing.forEach((i, pos) => {
    const v = res.vectors[pos + 1]
    if (v) {
      vectors[i] = v
      cache.set(keyFor(res.mode, texts[i]!), v)
    }
  })

  if (res.mode !== opts.expectedMode) {
    // Cached vectors are from another mode: not comparable with `query`.
    const missingSet = new Set(missing)
    texts.forEach((t, i) => {
      if (missingSet.has(i)) return
      const key = keyFor(res.mode, t)
      let v = res.mode === 'local' ? cache.get(key) : undefined
      if (!v) {
        v = localVector(t)
        cache.set(key, v)
      }
      vectors[i] = v
    })
  }

  return { query, vectors: vectors.map((v) => v ?? []), mode: res.mode }
}

// ────────────────────────────────────────────
// Ranking → chunks + sources
// ────────────────────────────────────────────

/** Collapse whitespace and cut to `max` chars on a word boundary (adds "…"). */
export function makeExcerpt(text: string, max = EXCERPT_CHARS): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const ws = cut.lastIndexOf(' ')
  return `${(ws > max * 0.6 ? cut.slice(0, ws) : cut).replace(/[\s,.;:]+$/, '')}…`
}

/**
 * Apply the relevance cutoffs to scored chunks (best first) and build the
 * context chunks (max {@link MAX_CHUNKS_PER_LESSON} per lesson) and sources
 * (one per lesson, best first, max {@link MAX_SOURCES}).
 */
export function selectChunksAndSources(
  scored: ScoredChunk[],
  mode: 'api' | 'local',
  opts: { minScore?: number; maxChunks?: number; maxSources?: number } = {},
): { chunks: ScoredChunk[]; sources: RagSource[] } {
  const minScore = opts.minScore ?? MIN_SCORE[mode]
  const sorted = [...scored].filter((c) => c.score >= minScore).sort((a, b) => b.score - a.score)
  if (sorted.length === 0) return { chunks: [], sources: [] }
  const floor = sorted[0]!.score * RELATIVE_CUTOFF
  const relevant = sorted.filter((c) => c.score >= floor)

  const perLesson = new Map<string, number>()
  const chunks: ScoredChunk[] = []
  for (const c of relevant) {
    const n = perLesson.get(c.lesson_id) ?? 0
    if (n >= MAX_CHUNKS_PER_LESSON[mode]) continue
    perLesson.set(c.lesson_id, n + 1)
    chunks.push(c)
    if (chunks.length >= (opts.maxChunks ?? MAX_CONTEXT_CHUNKS_RETURNED)) break
  }

  const sources: RagSource[] = []
  const seen = new Set<string>()
  for (const c of chunks) {
    if (seen.has(c.lesson_id)) continue
    seen.add(c.lesson_id)
    sources.push({
      lesson_id: c.lesson_id,
      course_id: c.course_id,
      course_kode: c.course_kode,
      judul: c.judul,
      excerpt: makeExcerpt(stripLeadingFragment(c.content, c.chunk_index)),
      score: Math.round(c.score * 1000) / 1000,
    })
    if (sources.length >= (opts.maxSources ?? MAX_SOURCES)) break
  }
  return { chunks, sources }
}

/** Local-only embed function (same vectors as `embedTextsWith` in demo mode). */
export const embedLocally: EmbedFn = async (texts) => ({ vectors: texts.map(localVector), mode: 'local', dims: EMBEDDING_DIMS })

export interface ContextRetrievalOptions {
  embed: EmbedFn
  expectedMode: 'api' | 'local'
  namespace?: string
  cache?: EmbeddingCache
  minScore?: number
}

/**
 * Backend 1 — retrieve from lessons sent by the client.
 * Returns no chunks/sources when nothing scores above the cutoff.
 */
export async function retrieveFromContext(
  question: string,
  lessons: RagLesson[],
  opts: ContextRetrievalOptions,
): Promise<RetrievalResult> {
  // Lexical (local) embeddings: smaller chunks, and function words dropped on
  // both sides so topic words decide the score.
  const lexical = opts.expectedMode === 'local'
  const chunks = chunkLessons(lessons, MAX_CONTEXT_CHUNKS, lexical ? LOCAL_CHUNK_OPTIONS : CHUNK_OPTIONS)
  if (!question.trim() || chunks.length === 0) return { chunks: [], sources: [], mode: null, backend: 'none' }

  const prep = (t: string) => (lexical ? stripStopwords(t) : t)
  const q = prep(question)
  if (!q) return { chunks: [], sources: [], mode: null, backend: 'none' }
  const { query, vectors, mode } = await embedQueryAndChunks(q, chunks.map((c) => prep(chunkEmbeddingText(c))), opts)
  if (mode !== opts.expectedMode && mode === 'local') {
    // The API failed and the batch came back lexical: redo with the local
    // settings (small chunks, stopwords) so the fallback is as good as demo mode.
    return retrieveFromContext(question, lessons, { ...opts, expectedMode: 'local', embed: embedLocally })
  }
  const ranked = topKBySimilarity(
    query,
    chunks.map((c, i) => ({ vector: vectors[i]!, item: c })),
    chunks.length,
  ).map(({ item, score }) => ({ ...item, score }))

  const { chunks: top, sources } = selectChunksAndSources(ranked, mode, { minScore: opts.minScore })
  return { chunks: top, sources, mode, backend: 'context' }
}

// ────────────────────────────────────────────
// Backend 2 — pgvector
// ────────────────────────────────────────────

/** Row returned by `match_lesson_chunks`. */
export interface MatchRow {
  lesson_id: string
  course_id: string
  chunk_index: number
  content: string
  similarity: number
}

export interface LessonMeta {
  judul: string
  course_id: string
  course_kode: string
}

export interface PgvectorRetrievalOptions {
  embed: EmbedFn
  /** Calls `match_lesson_chunks`; should throw (or return an error) on failure. */
  matchChunks: (args: {
    query_embedding: number[]
    p_course_ids: string[]
    p_match_count: number
    p_embedding_mode: 'api' | 'local'
  }) => Promise<MatchRow[]>
  /** Titles/codes for lesson ids not present in `knownLessons`. */
  lookupLessons?: (lessonIds: string[]) => Promise<Record<string, LessonMeta>>
  /** Lesson metadata the client already sent (avoids a DB lookup). */
  knownLessons?: Record<string, LessonMeta>
  courseIds: string[]
  matchCount?: number
  minScore?: number
}

/**
 * Backend 2 — retrieve via the `match_lesson_chunks` RPC, restricted to `courseIds`
 * and to rows with the query embedding's mode. Errors propagate (caller falls back).
 */
export async function retrieveFromPgvector(question: string, opts: PgvectorRetrievalOptions): Promise<RetrievalResult> {
  const courseIds = [...new Set(opts.courseIds.filter(Boolean))]
  if (!question.trim() || courseIds.length === 0) return { chunks: [], sources: [], mode: null, backend: 'none' }

  const res = await opts.embed([question])
  const query = res.vectors[0]
  if (!query || query.every((v) => v === 0)) return { chunks: [], sources: [], mode: res.mode, backend: 'pgvector' }

  const rows = await opts.matchChunks({
    query_embedding: query,
    p_course_ids: courseIds,
    p_match_count: opts.matchCount ?? 12,
    p_embedding_mode: res.mode,
  })
  const allowed = new Set(courseIds)
  const valid = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && allowed.has(r.course_id) && typeof r.content === 'string' && Number.isFinite(Number(r.similarity)),
  )
  if (valid.length === 0) return { chunks: [], sources: [], mode: res.mode, backend: 'pgvector' }

  const meta: Record<string, LessonMeta> = { ...(opts.knownLessons ?? {}) }
  const unknown = [...new Set(valid.map((r) => r.lesson_id))].filter((id) => !meta[id])
  if (unknown.length && opts.lookupLessons) {
    try {
      Object.assign(meta, await opts.lookupLessons(unknown))
    } catch (err) {
      console.warn('[RAG] lesson title lookup failed:', (err as Error)?.message ?? err)
    }
  }

  const scored: ScoredChunk[] = valid.map((r) => ({
    lesson_id: r.lesson_id,
    course_id: r.course_id,
    course_kode: meta[r.lesson_id]?.course_kode ?? '',
    judul: meta[r.lesson_id]?.judul ?? 'Materi',
    chunk_index: Number(r.chunk_index) || 0,
    content: r.content,
    score: Number(r.similarity),
  }))
  const { chunks, sources } = selectChunksAndSources(scored, res.mode, { minScore: opts.minScore })
  return { chunks, sources, mode: res.mode, backend: 'pgvector' }
}

// ────────────────────────────────────────────
// Answering
// ────────────────────────────────────────────

/** Tutor persona (kept from the original chat route). */
export const TUTOR_PERSONA =
  'Kamu adalah asisten AI untuk LMS Mahasiswa, sebuah Learning Management System untuk mahasiswa Indonesia. ' +
  'Kamu membantu mahasiswa memahami materi perkuliahan, mengerjakan tugas, dan menggunakan fitur LMS. ' +
  'Gunakan bahasa Indonesia yang ramah dan mudah dipahami. ' +
  'Jawab dengan jelas, berikan contoh jika memungkinkan. ' +
  'Jika ditanya di luar konteks LMS, arahkan kembali ke materi perkuliahan.'

const MAX_PROMPT_CHUNK_CHARS = 1500

/**
 * System prompt: persona + course list + retrieved material (wrapped as untrusted data).
 * With no chunks the model is told no matching material was found.
 */
export function buildSystemPrompt(opts: {
  chunks: ScoredChunk[]
  courses?: Array<{ kode?: string; nama?: string; deskripsi?: string }>
}): string {
  let prompt = TUTOR_PERSONA
  const courses = (opts.courses ?? []).slice(0, 30)
  if (courses.length) {
    const list = courses
      .map((c) => `- ${String(c.kode ?? '').slice(0, 40)}: ${String(c.nama ?? '').slice(0, 200)}`)
      .join('\n')
    prompt += `\n\nMahasiswa ini sedang mengambil mata kuliah berikut:\n${list}`
  }

  if (opts.chunks.length === 0) {
    prompt +=
      '\n\nTidak ditemukan materi kuliah yang relevan dengan pertanyaan ini. Katakan dengan jujur bahwa materi ' +
      'mata kuliah belum membahasnya; boleh memberi penjelasan umum singkat, tetapi tandai jelas bahwa itu ' +
      'bukan dari materi kuliah.'
    return prompt
  }

  const blocks = opts.chunks
    .map((c, i) => `[${i + 1}] Materi "${c.judul}" (${c.course_kode || c.course_id})\n${wrapUntrusted('MATERI', c.content, MAX_PROMPT_CHUNK_CHARS)}`)
    .join('\n\n')
  prompt +=
    '\n\nJawab BERDASARKAN potongan materi kuliah di bawah ini. Sebutkan judul materi yang kamu pakai. ' +
    'Jika materi tidak cukup untuk menjawab, katakan bahwa materi belum membahasnya, lalu (opsional) beri ' +
    'penjelasan umum singkat yang ditandai jelas sebagai di luar materi. Jangan mengarang isi materi.\n\n' +
    UNTRUSTED_NOTICE +
    '\n\nPotongan materi:\n\n' +
    blocks
  return prompt
}

/** Overlap prefixes start mid-sentence: drop text before the first sentence start of a non-first chunk. */
function stripLeadingFragment(content: string, chunkIndex: number): string {
  const s = content.trim()
  if (chunkIndex === 0) return s
  if (/^[\p{Lu}\d"'(]/u.test(s)) return s
  const m = s.match(/[.!?…]\s+(?=[\p{Lu}\d"'(])/u)
  if (m && m.index !== undefined && m.index < s.length * 0.6) return s.slice(m.index + m[0].length)
  return s
}

/** Split text into sentences (keeps terminal punctuation). */
export function splitSentences(text: string): string[] {
  return String(text ?? '')
    .split(/\n\s*\n|(?<=[.!?…])\s+(?=[\p{Lu}\d"'(])/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
}

const MAX_EXTRACT_CHARS = 700

/**
 * Deterministic grounded answer (no LLM): names the best lesson, quotes its
 * most relevant sentences (in original order, whole sentences only), and
 * mentions other matching lessons. Returns `null` when there are no chunks.
 */
export function buildExtractiveAnswer(question: string, chunks: ScoredChunk[]): string | null {
  if (chunks.length === 0) return null
  const best = chunks[0]!
  const fromBest = chunks.filter((c) => c.lesson_id === best.lesson_id).sort((a, b) => a.chunk_index - b.chunk_index)

  const q = localEmbedding(stripStopwords(question) || question, 512)
  const sentences: Array<{ text: string; order: number; score: number }> = []
  let order = 0
  const seen = new Set<string>()
  for (const c of fromBest) {
    for (const s of splitSentences(stripLeadingFragment(c.content, c.chunk_index))) {
      const key = s.toLowerCase()
      if (seen.has(key)) continue // overlap between chunks repeats sentences
      seen.add(key)
      sentences.push({ text: s, order: order++, score: cosineSimilarity(q, localEmbedding(stripStopwords(s), 512)) })
    }
  }
  if (sentences.length === 0) return null

  // Greedy pick (max 3): prefer sentences that cover question terms not yet
  // covered (so "for dan while" quotes both), then by lexical similarity.
  const terms = stripStopwords(question).split(' ').filter((t) => t.length >= 2)
  const wordsOf = (t: string) => stripStopwords(t).split(' ')
  const covers = (text: string) => {
    const ws = wordsOf(text)
    return new Set(terms.filter((t) => ws.some((w) => w === t || (t.length >= 4 && w.startsWith(t)))))
  }
  const candidates = sentences.map((s) => ({ ...s, terms: covers(s.text) }))
  // Rarer question terms (within this lesson) weigh more: "irisan" beats "himpunan".
  const weight = new Map(
    terms.map((t) => {
      const df = candidates.filter((c) => c.terms.has(t)).length
      return [t, df > 0 ? 1 + Math.log(candidates.length / df) : 0]
    }),
  )
  // Sentences that define a question term ("X adalah …", "X berisi …") are preferred.
  const DEFINES = /^(adalah|ialah|merupakan|berisi|yaitu|disebut|dipakai|digunakan)$/
  const defines = (text: string, ts: Set<string>) => {
    const ws = normalizeForEmbedding(text).split(/[^\p{L}\p{N}_]+/u).filter(Boolean)
    return ws.some((w, i) => [...ts].some((t) => w.startsWith(t)) && ws.slice(i + 1, i + 6).some((x) => DEFINES.test(x)))
  }
  const valueOf = (c: (typeof candidates)[number], covered: Set<string>) => {
    let v = c.score
    let defBoost = 0
    for (const t of c.terms) {
      const w = weight.get(t) ?? 0
      v += covered.has(t) ? w * 0.35 : w
      if (w * 0.25 > defBoost && defines(c.text, new Set([t]))) defBoost = w * 0.25
    }
    return v + defBoost
  }
  const covered = new Set<string>()
  const picked: typeof candidates = []
  let len = 0
  let firstValue = 0
  while (picked.length < 3) {
    let best: (typeof candidates)[number] | null = null
    let bestValue = -Infinity
    for (const c of candidates) {
      if (picked.includes(c)) continue
      if (picked.length > 0 && len + c.text.length > MAX_EXTRACT_CHARS) continue
      const value = valueOf(c, covered)
      if (value > bestValue || (value === bestValue && best && c.order < best.order)) {
        best = c
        bestValue = value
      }
    }
    if (!best) break
    // Later sentences must still be clearly about the question.
    if (picked.length > 0 && (best.terms.size === 0 || bestValue < firstValue * 0.3)) break
    if (picked.length === 0) firstValue = bestValue
    picked.push(best)
    best.terms.forEach((t) => covered.add(t))
    len += best.text.length
  }
  picked.sort((a, b) => a.order - b.order)
  let passage = picked.map((s) => s.text).join(' ')
  if (passage.length > MAX_EXTRACT_CHARS + 200) passage = makeExcerpt(passage, MAX_EXTRACT_CHARS)

  const label = best.course_kode ? `${best.judul}** (${best.course_kode})` : `${best.judul}**`
  let reply = `Berdasarkan materi **${label}:\n\n${passage}`

  const others: string[] = []
  for (const c of chunks) {
    if (c.lesson_id === best.lesson_id || others.includes(c.judul)) continue
    others.push(c.judul)
  }
  if (others.length) reply += `\n\nMateri terkait lainnya: ${others.map((t) => `**${t}**`).join(', ')}.`
  reply += '\n\nBuka sumber di bawah untuk membaca materi lengkapnya.'
  return reply
}

// ────────────────────────────────────────────
// SSE framing
// ────────────────────────────────────────────

/** One SSE `data:` event. */
export function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

/** Split a reply into the word pieces streamed as `{ word }` events (whitespace kept). */
export function splitForStreaming(reply: string): string[] {
  return reply.split(/(?<=\s)/).filter((w) => w.length > 0)
}

/**
 * Incremental parser for an OpenAI-compatible streaming response
 * (`data: {...choices[0].delta.content...}` lines, `data: [DONE]`).
 * Handles lines split across network reads.
 */
export function createUpstreamSseParser() {
  let buffer = ''
  let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null
  const handle = (line: string, out: string[]) => {
    const l = line.trim()
    if (!l.startsWith('data:')) return
    const data = l.slice(5).trim()
    if (!data || data === '[DONE]') return
    try {
      const parsed = JSON.parse(data)
      const content = parsed?.choices?.[0]?.delta?.content
      if (typeof content === 'string' && content) out.push(content)
      if (parsed?.usage && typeof parsed.usage === 'object') usage = parsed.usage
    } catch {
      // ignore malformed lines
    }
  }
  return {
    /** Feed decoded text; returns content deltas completed by this text. */
    push(text: string): string[] {
      buffer += text
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      const out: string[] = []
      for (const line of lines) handle(line, out)
      return out
    },
    /** Flush the trailing partial line. */
    end(): string[] {
      const out: string[] = []
      if (buffer) handle(buffer, out)
      buffer = ''
      return out
    },
    get usage() {
      return usage
    },
  }
}

// ────────────────────────────────────────────
// Indexing (POST /api/ai/index-lessons)
// ────────────────────────────────────────────

export const MAX_INDEX_LESSONS = 100

export interface IndexLessonInput {
  id: string
  judul: string
  konten: string
}

export interface ExistingChunkRow {
  lesson_id: string
  chunk_index: number
  content_hash: string
  embedding_mode: string
}

export interface ChunkUpsertRow {
  lesson_id: string
  course_id: string
  chunk_index: number
  content: string
  content_hash: string
  embedding: number[]
  embedding_mode: 'api' | 'local'
}

export interface IndexStore {
  /** Existing chunk rows for these lessons. */
  existing(lessonIds: string[]): Promise<ExistingChunkRow[]>
  upsert(rows: ChunkUpsertRow[]): Promise<void>
  /** Delete chunks of `lessonId` with chunk_index >= fromIndex. */
  deleteFrom(lessonId: string, fromIndex: number): Promise<void>
}

export interface IndexResult {
  course_id: string
  lessons: number
  chunks: number
  embedded: number
  unchanged: number
  deleted_lessons: number
  mode: 'api' | 'local' | null
  warning?: string
}

/**
 * Core of index-lessons: chunk each lesson, embed only new/changed chunks
 * (by `content_hash` and expected mode), upsert them, and delete chunk indexes
 * that no longer exist. Lesson ids must already be verified to belong to `courseId`.
 */
export async function indexLessonsWith(
  courseId: string,
  lessons: IndexLessonInput[],
  deps: { embed: EmbedFn; expectedMode: 'api' | 'local'; store: IndexStore },
): Promise<IndexResult> {
  const plan = lessons.map((l) => ({
    lesson: l,
    pieces: chunkText(String(l.konten ?? ''), CHUNK_OPTIONS).map((content, chunk_index) => ({
      chunk_index,
      content,
      hash: hashText(chunkEmbeddingText({ judul: l.judul, content })),
    })),
  }))
  const totalChunks = plan.reduce((n, p) => n + p.pieces.length, 0)
  if (totalChunks > MAX_EMBED_TEXTS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Materi terlalu panjang untuk diindeks sekaligus (${totalChunks} potongan, maksimal ${MAX_EMBED_TEXTS}). Indeks per beberapa materi.`,
    })
  }

  const existing = lessons.length ? await deps.store.existing(lessons.map((l) => l.id)) : []
  const have = new Map(existing.map((r) => [`${r.lesson_id}#${r.chunk_index}`, r]))

  const todo: Array<{ lesson_id: string; chunk_index: number; content: string; hash: string; text: string }> = []
  let unchanged = 0
  for (const { lesson, pieces } of plan) {
    for (const p of pieces) {
      const row = have.get(`${lesson.id}#${p.chunk_index}`)
      if (row && row.content_hash === p.hash && row.embedding_mode === deps.expectedMode) {
        unchanged++
        continue
      }
      todo.push({
        lesson_id: lesson.id,
        chunk_index: p.chunk_index,
        content: p.content,
        hash: p.hash,
        text: chunkEmbeddingText({ judul: lesson.judul, content: p.content }),
      })
    }
  }

  let mode: 'api' | 'local' | null = null
  if (todo.length) {
    const res = await deps.embed(todo.map((t) => t.text))
    mode = res.mode
    await deps.store.upsert(
      todo.map((t, i) => ({
        lesson_id: t.lesson_id,
        course_id: courseId,
        chunk_index: t.chunk_index,
        content: t.content,
        content_hash: t.hash,
        embedding: res.vectors[i]!,
        embedding_mode: res.mode,
      })),
    )
  }

  let deletedLessons = 0
  for (const { lesson, pieces } of plan) {
    const maxExisting = existing.filter((r) => r.lesson_id === lesson.id).reduce((m, r) => Math.max(m, r.chunk_index), -1)
    if (maxExisting >= pieces.length) {
      await deps.store.deleteFrom(lesson.id, pieces.length)
      deletedLessons++
    }
  }

  const result: IndexResult = {
    course_id: courseId,
    lessons: lessons.length,
    chunks: totalChunks,
    embedded: todo.length,
    unchanged,
    deleted_lessons: deletedLessons,
    mode,
  }
  if (mode && mode !== deps.expectedMode) {
    result.warning =
      'API embedding tidak tersedia; potongan disimpan dengan embedding lokal dan akan diindeks ulang pada percobaan berikutnya.'
  }
  return result
}

// ────────────────────────────────────────────
// Supabase adapters (service-role client injected; no Nitro globals)
// ────────────────────────────────────────────

/** Minimal shape of the supabase-js client used here (lets tests pass a mock). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** `lesson_chunks` / RPC use UUIDs; demo ids ('c1', 'l1') never go to the DB. */
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

/** Service-role config from env/runtimeConfig values; `null` when not configured. */
export function resolveServiceConfig(raw: { serviceKey?: unknown; url?: unknown }): { url: string; serviceKey: string } | null {
  const serviceKey = typeof raw.serviceKey === 'string' ? raw.serviceKey.trim() : ''
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  return serviceKey && url ? { url, serviceKey } : null
}

/**
 * Of `requested` course ids, those the user may read: admin ⇒ all, instructor ⇒
 * courses they teach, student ⇒ courses they are enrolled in. The service role
 * bypasses RLS, so this check is what keeps retrieval inside the user's courses.
 */
export async function allowedCourseIds(
  db: SupabaseLike,
  session: { userId: string; role: 'student' | 'instructor' | 'admin' },
  requested: string[],
): Promise<string[]> {
  const ids = [...new Set(requested.filter(isUuid))]
  if (ids.length === 0) return []
  if (session.role === 'admin') return ids
  if (session.role === 'instructor') {
    const { data, error } = await db.from('courses').select('id').eq('instructor_id', session.userId).in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r: { id: string }) => r.id)
  }
  const { data, error } = await db.from('enrollments').select('course_id').eq('student_id', session.userId).in('course_id', ids)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r: { course_id: string }) => r.course_id))] as string[]
}

/** `match_lesson_chunks` via the service-role client. */
export function rpcMatchChunks(db: SupabaseLike): PgvectorRetrievalOptions['matchChunks'] {
  return async (args) => {
    const { data, error } = await db.rpc('match_lesson_chunks', args)
    if (error) throw new Error(error.message)
    return (data ?? []) as MatchRow[]
  }
}

/** Lesson titles + course codes for ids returned by the RPC. */
export function dbLookupLessons(db: SupabaseLike): NonNullable<PgvectorRetrievalOptions['lookupLessons']> {
  return async (lessonIds) => {
    const { data, error } = await db.from('lessons').select('id, judul, course_id, courses(kode)').in('id', lessonIds)
    if (error) throw new Error(error.message)
    const out: Record<string, LessonMeta> = {}
    for (const r of data ?? []) {
      const kode = Array.isArray(r.courses) ? r.courses[0]?.kode : r.courses?.kode
      out[r.id] = { judul: r.judul, course_id: r.course_id, course_kode: kode ?? '' }
    }
    return out
  }
}

/** {@link IndexStore} over `lesson_chunks` with the service-role client. */
export function supabaseIndexStore(db: SupabaseLike): IndexStore {
  return {
    async existing(lessonIds) {
      const { data, error } = await db
        .from('lesson_chunks')
        .select('lesson_id, chunk_index, content_hash, embedding_mode')
        .in('lesson_id', lessonIds)
      if (error) throw new Error(error.message)
      return (data ?? []) as ExistingChunkRow[]
    },
    async upsert(rows) {
      // Keep each request modest (1536 floats per row).
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await db.from('lesson_chunks').upsert(rows.slice(i, i + 50), { onConflict: 'lesson_id,chunk_index' })
        if (error) throw new Error(error.message)
      }
    },
    async deleteFrom(lessonId, fromIndex) {
      const { error } = await db.from('lesson_chunks').delete().eq('lesson_id', lessonId).gte('chunk_index', fromIndex)
      if (error) throw new Error(error.message)
    },
  }
}

/**
 * Lessons of `courseId` to index, read from the DB (source of truth — the
 * client's copy is never written into the index). If `onlyIds` is given, only
 * those; ids that are not lessons of this course are returned in `rejected`.
 */
export async function loadCourseLessons(
  db: SupabaseLike,
  courseId: string,
  onlyIds?: string[],
): Promise<{ lessons: IndexLessonInput[]; rejected: string[] }> {
  const { data, error } = await db.from('lessons').select('id, judul, konten, course_id').eq('course_id', courseId)
  if (error) throw new Error(error.message)
  const rows: Array<{ id: string; judul: string; konten: string | null }> = data ?? []
  if (!onlyIds) return { lessons: rows.map((r) => ({ id: r.id, judul: r.judul, konten: r.konten ?? '' })), rejected: [] }
  const want = new Set(onlyIds)
  const found = rows.filter((r) => want.has(r.id))
  const foundIds = new Set(found.map((r) => r.id))
  return {
    lessons: found.map((r) => ({ id: r.id, judul: r.judul, konten: r.konten ?? '' })),
    rejected: onlyIds.filter((id) => !foundIds.has(id)),
  }
}
