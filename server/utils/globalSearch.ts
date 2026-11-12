/**
 * Global search (server side) — Supabase mode of the GlobalSearch palette.
 *
 * Loads only what the user may see (student: enrolled courses, instructor:
 * taught courses, admin: all) with the service-role client, ranks it with the
 * shared lexical ranker (app/lib/search.ts) and, when lesson chunks are
 * indexed, boosts lessons with pgvector similarity (same RPC and fallback
 * pattern as the RAG tutor in rag.ts). Without pgvector the boost comes from
 * the local (lexical) embedding of aiText.ts.
 *
 * No Nitro globals here: the DB client and embed function are injected so the
 * whole flow is unit-testable.
 */
import { buildSearchIndex, rankItems, type IndexSource, type SearchHit, type SearchRole } from '../../app/lib/search'
import { cosineSimilarity, localEmbedding } from './aiText'
import { retrieveFromPgvector, rpcMatchChunks, type EmbedFn, type SupabaseLike } from './rag'

export const SEARCH_MAX_QUERY = 200
export const SEARCH_MAX_RESULTS = 40
const ROW_LIMIT = 500

export interface GlobalSearchSession {
  userId: string
  role: SearchRole
}

export interface GlobalSearchResult {
  q: string
  mode: 'semantic' | 'lexical'
  results: Omit<SearchHit, 'body'>[]
}

/** Course ids + rows the session may see. */
export async function loadSearchSource(db: SupabaseLike, session: GlobalSearchSession): Promise<IndexSource> {
  const sel = 'id, kode, nama, deskripsi'
  let courses: IndexSource['courses'] = []
  if (session.role === 'admin') {
    const { data, error } = await db.from('courses').select(sel).limit(ROW_LIMIT)
    if (error) throw new Error(error.message)
    courses = data ?? []
  } else if (session.role === 'instructor') {
    const { data, error } = await db.from('courses').select(sel).eq('instructor_id', session.userId).limit(ROW_LIMIT)
    if (error) throw new Error(error.message)
    courses = data ?? []
  } else {
    const { data: enr, error: eErr } = await db.from('enrollments').select('course_id').eq('student_id', session.userId)
    if (eErr) throw new Error(eErr.message)
    const ids = [...new Set((enr ?? []).map((r: { course_id: string }) => r.course_id))]
    if (ids.length) {
      const { data, error } = await db.from('courses').select(sel).in('id', ids)
      if (error) throw new Error(error.message)
      courses = data ?? []
    }
  }
  const ids = courses.map((c) => c.id)
  if (ids.length === 0) return { role: session.role, courses: [] }

  const q = (table: string, cols: string) => db.from(table).select(cols).in('course_id', ids).limit(ROW_LIMIT)
  const [lessons, quizzes, assignments, threads] = await Promise.all([
    q('lessons', 'id, course_id, judul, konten'),
    q('quizzes', 'id, course_id, judul, deskripsi, is_active'),
    q('assignments', 'id, course_id, judul, deskripsi'),
    q('forum_threads', 'id, course_id, judul, konten'),
  ])
  for (const r of [lessons, quizzes, assignments, threads]) if (r.error) throw new Error(r.error.message)
  return {
    role: session.role,
    courses,
    lessons: lessons.data ?? [],
    quizzes: quizzes.data ?? [],
    assignments: assignments.data ?? [],
    threads: threads.data ?? [],
  }
}

/** Cosine of the local embedding of `query` vs. each item's title/keywords/subtitle. */
export function localSemanticScores(query: string, items: { id: string; title: string; keywords?: string; subtitle?: string }[]): Map<string, number> {
  const qv = localEmbedding(query)
  const out = new Map<string, number>()
  if (qv.every((v) => v === 0)) return out
  for (const it of items) {
    const s = cosineSimilarity(qv, localEmbedding([it.title, it.keywords, it.subtitle].filter(Boolean).join(' ')))
    if (s > 0) out.set(it.id, s)
  }
  return out
}

export interface RunSearchOptions {
  /** Embed function for pgvector; omit to skip pgvector. */
  embed?: EmbedFn
  limit?: number
}

export async function runGlobalSearch(
  db: SupabaseLike,
  session: GlobalSearchSession,
  query: string,
  opts: RunSearchOptions = {},
): Promise<GlobalSearchResult> {
  const q = query.trim().slice(0, SEARCH_MAX_QUERY)
  const source = await loadSearchSource(db, session)
  const items = buildSearchIndex(source)
  const semantic = localSemanticScores(q, items)
  let mode: GlobalSearchResult['mode'] = 'lexical'

  if (opts.embed && (source.lessons?.length ?? 0) > 0) {
    try {
      const r = await retrieveFromPgvector(q, {
        embed: opts.embed,
        matchChunks: rpcMatchChunks(db),
        courseIds: source.courses.map((c) => c.id),
        matchCount: 12,
      })
      for (const c of r.chunks) {
        const key = `lesson:${c.lesson_id}`
        semantic.set(key, Math.max(semantic.get(key) ?? 0, c.score))
      }
      if (r.mode === 'api' && r.chunks.length) mode = 'semantic'
    } catch (err) {
      console.warn('[Search] pgvector unavailable, lexical only:', (err as Error)?.message ?? err)
    }
  }

  const hits = rankItems(q, items, { semantic, limit: opts.limit ?? SEARCH_MAX_RESULTS })
  return { q, mode, results: hits.map(({ body: _body, ...h }) => h) }
}
