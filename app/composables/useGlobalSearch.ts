/**
 * useGlobalSearch — data + ranking for the GlobalSearch command palette.
 *
 * Demo (and fallback): searches the data already in the Pinia stores, which
 * only contain what the user may see; `buildSearchIndex` additionally limits
 * everything to the user's courses. Ranking = lexical (app/lib/search.ts) plus
 * a boost from the local embedding of server/utils/aiText.ts (catches word
 * inflections / small typos).
 * Supabase mode: GET /api/search (pgvector boost for lessons when indexed);
 * on any error (e.g. 503 without service role key) it falls back to local.
 */
import { cosineSimilarity, localEmbedding } from '../../server/utils/aiText'
import {
  buildSearchIndex,
  commandItems,
  groupHits,
  rankItems,
  type SearchGroup,
  type SearchHit,
  type SearchItem,
  type SearchRole,
} from '~/lib/search'

const vectorCache = new Map<string, number[]>()

function itemVector(item: SearchItem): number[] {
  const text = [item.title, item.keywords, item.subtitle].filter(Boolean).join(' ')
  const key = `${item.id}|${text}`
  let v = vectorCache.get(key)
  if (!v) {
    v = localEmbedding(text)
    if (vectorCache.size > 3000) vectorCache.clear()
    vectorCache.set(key, v)
  }
  return v
}

/** Local ranking (pure apart from the vector cache). Exported for tests. */
export function rankLocally(query: string, items: SearchItem[], limit = 40): SearchHit[] {
  const qv = localEmbedding(query)
  const semantic = new Map<string, number>()
  if (qv.some((x) => x !== 0)) {
    for (const it of items) {
      const s = cosineSimilarity(qv, itemVector(it))
      if (s > 0) semantic.set(it.id, s)
    }
  }
  return rankItems(query, items, { semantic, limit })
}

export function useGlobalSearch() {
  const auth = useAuthStore()
  const courses = useCoursesStore()
  const quiz = useQuizStore()
  const assignments = useAssignmentsStore()
  const forum = useForumStore()
  const ui = useUiStore()

  const role = computed<SearchRole>(() => (auth.role as SearchRole) || 'student')
  const loading = ref(false)
  const mode = ref<'local' | 'semantic' | 'lexical'>('local')
  let loaded = false

  async function ensureLoaded() {
    if (loaded || !auth.user) return
    loaded = true
    await courses.init()
    await Promise.all([quiz.init(), assignments.init(), forum.init()])
  }

  const index = computed<SearchItem[]>(() => {
    if (!auth.user) return []
    const r = role.value
    const visible = r === 'admin' ? courses.allCourses : courses.myCourses
    const lessons = r === 'admin' ? [] : visible.flatMap((c) => courses.lessonsByCourse(c.id))
    const allAssignments = assignments.isDemoMode ? assignments.assignments : assignments.sbAssignments
    return buildSearchIndex({
      role: r,
      courses: visible,
      lessons,
      quizzes: quiz.quizzes,
      assignments: r === 'admin' ? allAssignments : assignments.myAssignments,
      threads: forum.threads,
    })
  })

  const commands = computed(() => commandItems(role.value))

  let seq = 0
  /** Grouped results for a query (empty query → commands only). */
  async function search(query: string): Promise<SearchGroup[]> {
    const q = query.trim()
    if (!q) {
      mode.value = 'local'
      return groupHits(commands.value.map((c) => ({ ...c, score: 0 })), 12)
    }
    const my = ++seq
    const cmdHits = rankItems(q, commands.value)
    let hits: SearchHit[] | null = null

    if (!ui.isDemoMode) {
      loading.value = true
      try {
        const res = await $fetch<{ mode: 'semantic' | 'lexical'; results: SearchHit[] }>('/api/search', { query: { q } })
        if (my !== seq) return []
        hits = res.results
        mode.value = res.mode
      } catch {
        hits = null
      } finally {
        if (my === seq) loading.value = false
      }
    }
    if (!hits) {
      await ensureLoaded()
      hits = rankLocally(q, index.value)
      mode.value = 'local'
    }
    return groupHits([...cmdHits, ...hits], 5)
  }

  return { search, ensureLoaded, loading, mode, index }
}
