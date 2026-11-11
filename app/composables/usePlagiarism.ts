/**
 * usePlagiarism — Composable for calling the plagiarism-check server API.
 * Wraps $fetch against POST /api/plagiarism/check with a simple state.
 *
 * The server returns two signals per flagged pair: a lexical score (word
 * 3-gram Jaccard, catches copy-paste) and a semantic score (embedding cosine,
 * catches paraphrase only when an AI API key is configured — otherwise it is
 * a lexical approximation, see `semantic.mode`). Demo mode uses the same
 * server route (there is no separate client-side check), so the shape is
 * identical; without an API key the server reports `semantic.mode: 'local'`.
 */
import type {
  MatchType,
  PlagiarismPair,
  PlagiarismResultV2,
  SemanticSummary,
} from '../../server/utils/plagiarism'

export type { PlagiarismPair }

export interface PlagiarismReport {
  checked: PlagiarismResultV2[]
  flagged: PlagiarismResultV2[]
  /** Lexical threshold applied (percent). */
  threshold: number
  total: number
  /** Flagged pairs with both scores (absent from very old servers). */
  pairs?: PlagiarismPair[]
  semantic?: SemanticSummary
}

interface CheckableSubmission {
  id: string
  student_id: string
  student_name?: string
  jawaban?: string | null
}

/** Optional per-request threshold overrides (percent; the server clamps them). */
export interface PlagiarismThresholds {
  lexical?: number
  semantic?: number
}

/**
 * Indonesian badge label for a match type. In 'local' mode the semantic score
 * is lexical too, so a semantic-only hit means "near-identical with edits",
 * not paraphrase — the label says so instead of over-claiming.
 */
export function plagiarismMatchLabel(t: MatchType, mode?: SemanticSummary['mode']): string {
  if (t === 'both') return 'keduanya'
  if (t === 'semantic') return mode === 'local' ? 'hampir sama' : 'parafrase'
  return 'salin-tempel'
}

/** The higher of the two scores (semantic null ⇒ lexical). */
export function plagiarismPairMax(p: Pick<PlagiarismPair, 'similarity' | 'semantic_similarity'>): number {
  return Math.max(p.similarity, p.semantic_similarity ?? 0)
}

/** Pairs sorted highest-of-two-scores first (ties: lexical desc, then names). Does not mutate. */
export function plagiarismSortPairs(pairs: PlagiarismPair[]): PlagiarismPair[] {
  return [...pairs].sort(
    (x, y) =>
      plagiarismPairMax(y) - plagiarismPairMax(x) ||
      y.similarity - x.similarity ||
      `${x.a_name}${x.b_name}`.localeCompare(`${y.a_name}${y.b_name}`),
  )
}

export function usePlagiarism() {
  const checking = ref(false)
  const error = ref<string | null>(null)

  /**
   * Run a plagiarism check on a batch of submissions.
   * Returns the report (empty lists when there are fewer than 2 text answers), or null on error.
   */
  async function check(
    submissions: CheckableSubmission[],
    thresholds?: PlagiarismThresholds,
  ): Promise<PlagiarismReport | null> {
    error.value = null
    const withText = submissions.filter((s) => (s.jawaban || '').trim().length > 0)
    if (withText.length < 2) {
      return { checked: [], flagged: [], threshold: 75, total: withText.length, pairs: [] }
    }

    checking.value = true
    try {
      const report = await $fetch<PlagiarismReport>('/api/plagiarism/check', {
        method: 'POST',
        body: thresholds ? { submissions: withText, thresholds } : { submissions: withText },
      })
      return { ...report, pairs: plagiarismSortPairs(report.pairs ?? []) }
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Gagal menjalankan pemeriksaan kemiripan.'
      return null
    } finally {
      checking.value = false
    }
  }

  return {
    checking,
    error,
    check,
  }
}
