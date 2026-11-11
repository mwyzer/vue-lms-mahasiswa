/**
 * Plagiarism — Pure text-similarity detection utilities.
 *
 * Compares submissions using a token-based Jaccard similarity on shingles
 * (overlapping n-grams). Pure (only depends on the pure ./aiText) so it can be unit
 * tested and reused on both server and client.
 *
 * A second, embedding-based score (cosine similarity) is merged in by
 * `buildPlagiarismReport` — see the "Semantic" section below.
 */
import { cosineSimilarity, normalizeForEmbedding } from './aiText'

/** Normalize a text for comparison: strip code/punct noise, lowercase, and split into tokens. */
export function tokenize(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Build overlapping n-gram shingles from a token list. */
export function shingles(tokens: string[], n: number): string[] {
  if (tokens.length === 0) return []
  if (tokens.length < n) return [tokens.join(' ')]
  const out: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(' '))
  }
  return out
}

/** Jaccard similarity (0..1) between two sets represented as arrays, using unique shingles. */
export function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Similarity score (0..100) between two raw text strings.
 * Uses word-level shingles with n=3 as a robust default.
 */
export function textSimilarity(a: string, b: string, n = 3): number {
  const setA = new Set(shingles(tokenize(a), n))
  const setB = new Set(shingles(tokenize(b), n))
  return Math.round(jaccard([...setA], [...setB]) * 100)
}

/** Convenience severity thresholds used for display. */
export function severityLabel(score: number): 'rendah' | 'sedang' | 'tinggi' {
  if (score >= 75) return 'tinggi'
  if (score >= 40) return 'sedang'
  return 'rendah'
}

/** Compare a target submission against a list of others, returning ranked matches. */
export interface PlagiarismMatch {
  withId: string
  withName: string
  score: number
  label: string
  excerpt: string
}

export interface PlagiarismResult {
  submissionId: string
  authorName: string
  highestScore: number
  matches: PlagiarismMatch[]
}

export interface SubmissionLike {
  id: string
  student_id: string
  student_name?: string
  jawaban?: string | null
}

/**
 * Check one submission against a collection of peer submissions.
 * Returns the matches sorted by similarity score descending.
 */
export function checkSubmissionAgainst(
  targetId: string,
  targetAuthor: string,
  targetText: string,
  peers: SubmissionLike[]
): PlagiarismResult {
  const matches: PlagiarismMatch[] = peers
    .filter((p) => p.id !== targetId && (p.jawaban || '').trim().length > 0)
    .map((p) => {
      const score = textSimilarity(targetText, p.jawaban || '')
      const peerText = (p.jawaban || '').trim()
      return {
        withId: p.id,
        withName: p.student_name || p.student_id,
        score,
        label: severityLabel(score),
        excerpt:
          peerText.length > 120 ? `${peerText.slice(0, 117)}...` : peerText,
      } as PlagiarismMatch
    })
    .filter((m) => m.score > 0)
    .sort((x, y) => y.score - x.score)

  return {
    submissionId: targetId,
    authorName: targetAuthor,
    highestScore: matches[0]?.score ?? 0,
    matches,
  }
}

// ════════════════════════════════════════════
// Semantic (embedding-based) second score
// ════════════════════════════════════════════
//
// Everything below is additive: the lexical API above is unchanged.
// The caller embeds the eligible submissions (one batch ⇒ one mode) and
// passes the vectors in; this module only does the maths and the merge,
// so it stays pure and runs on both server and client.

/** Where the semantic vectors came from. */
export type SemanticMode = 'api' | 'local'
/** Semantic mode as reported to clients ('unavailable' = no semantic score this run). */
export type SemanticReportMode = SemanticMode | 'unavailable'
/** Why a pair was flagged. */
export type MatchType = 'lexical' | 'semantic' | 'both'

/** Default lexical threshold (unchanged from the original endpoint). */
export const LEXICAL_THRESHOLD = 75
/** Allowed range for a per-request lexical threshold override. */
export const LEXICAL_THRESHOLD_BOUNDS: readonly [number, number] = [20, 100]

/**
 * Default semantic thresholds (cosine × 100), per mode.
 *
 * - `api` (e.g. text-embedding-3-small): answers to the SAME question share
 *   topic and vocabulary, so independent answers commonly land around
 *   0.55–0.75 cosine; genuine paraphrases/translations of one text are
 *   typically ≥ 0.85. Hence 85, and no override below 70.
 * - `local` (hashed n-grams, lexical): on the Indonesian test fixture,
 *   independent same-topic answers score 37–46, a lightly edited copy 96,
 *   a real paraphrase 37 (NOT detectable). 70 sits well clear of the
 *   same-topic band; overrides below 50 would flag ordinary answers.
 */
export const SEMANTIC_THRESHOLDS: Readonly<Record<SemanticMode, number>> = { api: 85, local: 70 }
/** Allowed range for a per-request semantic threshold override, per mode. */
export const SEMANTIC_THRESHOLD_BOUNDS: Readonly<Record<SemanticMode, readonly [number, number]>> = {
  api: [70, 99],
  local: [50, 99],
}

/**
 * Answers with fewer words than this are left out of the semantic comparison:
 * short answers ("print('Hello World')") are similar by nature and their
 * embeddings are dominated by the topic. They still get the lexical score.
 */
export const SEMANTIC_MIN_WORDS = 20

/**
 * Class-baseline adjustment: the effective semantic threshold is
 * `max(threshold, median(all eligible pair scores) + BASELINE_MARGIN)`, capped at 99.
 * If a whole class writes very alike (a narrow question), only pairs clearly
 * above the class norm are flagged. Needs at least {@link BASELINE_MIN_PAIRS} pairs.
 */
export const BASELINE_MARGIN = 10
export const BASELINE_MIN_PAIRS = 6

/** Max submissions per check (pairwise is O(n²): 200 ⇒ 19 900 pairs, a few ms per 1 536-dim pair batch). */
export const MAX_CHECK_SUBMISSIONS = 200
/** Mirrors `MAX_EMBED_INPUT_CHARS` in ai.ts (the route passes the real value). Longer answers are embedded truncated. */
export const DEFAULT_MAX_EMBED_CHARS = 8000

/** A flagged pair, carrying both scores. */
export interface PlagiarismPair {
  a_id: string
  a_name: string
  b_id: string
  b_name: string
  /** Lexical Jaccard score 0..100 (same meaning as `PlagiarismMatch.score`). */
  similarity: number
  /** Cosine × 100 (0..100, negatives clamped to 0); null when skipped or unavailable. */
  semantic_similarity: number | null
  /** Why the pair was flagged. */
  match_type: MatchType
  /** Why `semantic_similarity` is null. */
  semantic_skipped?: 'short' | 'unavailable'
  /** At least one of the two answers was truncated before embedding. */
  semantic_truncated?: boolean
}

/** Extra fields on each per-submission match (existing fields keep their meaning). */
export interface PlagiarismMatchV2 extends PlagiarismMatch {
  semantic_similarity: number | null
  match_type: MatchType | null
}

export interface PlagiarismResultV2 extends PlagiarismResult {
  matches: PlagiarismMatchV2[]
  /** Highest semantic score of this submission vs any peer (null if none). */
  highestSemantic: number | null
}

/** The `semantic` block of the response. */
export interface SemanticSummary {
  mode: SemanticReportMode
  /** Base threshold applied for this mode (after override/clamp); null when unavailable. */
  threshold: number | null
  /** Threshold actually used after the class-baseline adjustment; null when unavailable. */
  effective_threshold: number | null
  /** Median semantic score over all eligible pairs; null if too few pairs. */
  baseline: number | null
  min_words: number
  /** Submissions included in the semantic comparison. */
  compared: number
  skipped_short: number
  truncated: number
  /** Machine-readable reason when mode is 'unavailable'. */
  reason?: 'budget' | 'error' | 'disabled'
  /** Human-readable note (Indonesian) — always shown to the instructor when present. */
  note?: string
}

export interface PlagiarismReportV2 {
  checked: PlagiarismResultV2[]
  /** Submissions with at least one flagged match (lexical OR semantic). */
  flagged: PlagiarismResultV2[]
  /** Lexical threshold applied. */
  threshold: number
  total: number
  /** Flagged pairs, each once, sorted by max(lexical, semantic) desc. */
  pairs: PlagiarismPair[]
  semantic: SemanticSummary
}

/** Embedding input for {@link buildPlagiarismReport}. */
export type SemanticInput =
  | { mode: SemanticMode; vectorsById: Record<string, number[]> }
  | { mode: 'unavailable'; reason: 'budget' | 'error' | 'disabled'; message?: string }

export interface ReportOptions {
  lexicalThreshold?: number
  semanticThreshold?: number
  maxEmbedChars?: number
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v))

/** Resolve a lexical threshold override (non-finite ⇒ default; otherwise clamped). */
export function resolveLexicalThreshold(v?: unknown): number {
  const n = typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.round(clamp(n, LEXICAL_THRESHOLD_BOUNDS)) : LEXICAL_THRESHOLD
}

/** Resolve a semantic threshold override for a mode (non-finite ⇒ mode default; otherwise clamped to the mode's bounds). */
export function resolveSemanticThreshold(mode: SemanticMode, v?: unknown): number {
  const n = typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.round(clamp(n, SEMANTIC_THRESHOLD_BOUNDS[mode])) : SEMANTIC_THRESHOLDS[mode]
}

/** Word count used for the semantic minimum (Unicode-aware, after normalisation). */
export function wordCount(text: string): number {
  return (normalizeForEmbedding(String(text ?? '')).match(/[\p{L}\p{N}_]+/gu) ?? []).length
}

/** Whether an answer is long enough for the semantic comparison. */
export function isSemanticEligible(text: string | null | undefined): boolean {
  return wordCount(text ?? '') >= SEMANTIC_MIN_WORDS
}

/** Cosine similarity as a 0..100 integer (negatives ⇒ 0). */
export function semanticScore(a: number[], b: number[]): number {
  return Math.max(0, Math.round(cosineSimilarity(a, b) * 100))
}

/** Classify a pair. Returns null when neither score reaches its threshold. */
export function classifyMatch(
  lexical: number,
  semantic: number | null,
  lexicalThreshold: number,
  semanticThreshold: number | null,
): MatchType | null {
  const lex = lexical >= lexicalThreshold
  const sem = semantic !== null && semanticThreshold !== null && semantic >= semanticThreshold
  if (lex && sem) return 'both'
  if (lex) return 'lexical'
  if (sem) return 'semantic'
  return null
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Texts to embed for a check: the eligible submissions, in input order. */
export function semanticCandidates(submissions: SubmissionLike[]): SubmissionLike[] {
  return submissions.filter((s) => isSemanticEligible(s.jawaban))
}

/**
 * Full report: lexical check per submission (existing algorithm, unchanged)
 * merged with pairwise cosine similarity of the provided vectors.
 *
 * `submissions` should already be the non-empty text answers. Vectors must
 * come from ONE embedding batch (one mode); submissions without a vector
 * (short, or missing) get `semantic_similarity: null`.
 */
export function buildPlagiarismReport(
  submissions: SubmissionLike[],
  semantic: SemanticInput,
  opts: ReportOptions = {},
): PlagiarismReportV2 {
  const lexThreshold = resolveLexicalThreshold(opts.lexicalThreshold)
  const maxChars = opts.maxEmbedChars ?? DEFAULT_MAX_EMBED_CHARS
  const subs = submissions.filter((s) => (s.jawaban || '').trim().length > 0)
  const nameOf = (s: SubmissionLike) => s.student_name || s.student_id

  const available = semantic.mode !== 'unavailable'
  const vectors: Record<string, number[]> = available ? semantic.vectorsById : {}
  const eligible = subs.filter((s) => isSemanticEligible(s.jawaban) && Array.isArray(vectors[s.id]))
  const eligibleIds = new Set(eligible.map((s) => s.id))
  const truncatedIds = new Set(
    eligible.filter((s) => normalizeForEmbedding(s.jawaban || '').length > maxChars).map((s) => s.id),
  )

  // Pairwise semantic scores (i < j), keyed "idA\u0000idB" in input order.
  const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)
  const sem = new Map<string, number>()
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i]!
      const b = eligible[j]!
      sem.set(pairKey(a.id, b.id), semanticScore(vectors[a.id]!, vectors[b.id]!))
    }
  }

  let semThreshold: number | null = null
  let effective: number | null = null
  let baseline: number | null = null
  if (semantic.mode !== 'unavailable') {
    semThreshold = resolveSemanticThreshold(semantic.mode, opts.semanticThreshold)
    effective = semThreshold
    if (sem.size >= BASELINE_MIN_PAIRS) {
      baseline = Math.round(median([...sem.values()]))
      effective = Math.min(99, Math.max(semThreshold, baseline + BASELINE_MARGIN))
    }
  }

  const semFor = (a: string, b: string): number | null =>
    eligibleIds.has(a) && eligibleIds.has(b) ? (sem.get(pairKey(a, b)) ?? null) : null
  const skippedFor = (a: string, b: string): PlagiarismPair['semantic_skipped'] => {
    if (!available) return 'unavailable'
    return eligibleIds.has(a) && eligibleIds.has(b) ? undefined : 'short'
  }

  // Per-submission view: existing lexical matches, plus peers that only match semantically.
  const lexScores = new Map<string, number>()
  const checked: PlagiarismResultV2[] = subs.map((s) => {
    const lexical = checkSubmissionAgainst(s.id, nameOf(s), s.jawaban || '', subs)
    const byId = new Map(lexical.matches.map((m) => [m.withId, m]))
    const matches: PlagiarismMatchV2[] = []
    let highestSemantic: number | null = null
    for (const p of subs) {
      if (p.id === s.id) continue
      const lm = byId.get(p.id)
      const semantic_similarity = semFor(s.id, p.id)
      if (semantic_similarity !== null) highestSemantic = Math.max(highestSemantic ?? 0, semantic_similarity)
      const score = lm?.score ?? 0
      lexScores.set(pairKey(s.id, p.id), score)
      const match_type = classifyMatch(score, semantic_similarity, lexThreshold, effective)
      // Same membership as before (lexical score > 0), plus peers flagged only semantically.
      if (!lm && match_type === null) continue
      const peerText = (p.jawaban || '').trim()
      matches.push({
        withId: p.id,
        withName: lm?.withName ?? nameOf(p),
        score,
        label: lm?.label ?? severityLabel(score),
        excerpt: lm?.excerpt ?? (peerText.length > 120 ? `${peerText.slice(0, 117)}...` : peerText),
        semantic_similarity,
        match_type,
      })
    }
    matches.sort(
      (x, y) =>
        Math.max(y.score, y.semantic_similarity ?? 0) - Math.max(x.score, x.semantic_similarity ?? 0) ||
        y.score - x.score,
    )
    return {
      submissionId: s.id,
      authorName: nameOf(s),
      highestScore: lexical.highestScore,
      highestSemantic,
      matches,
    }
  })

  const flagged = checked.filter((r) => r.matches.some((m) => m.match_type !== null))

  const pairs: PlagiarismPair[] = []
  for (let i = 0; i < subs.length; i++) {
    for (let j = i + 1; j < subs.length; j++) {
      const a = subs[i]!
      const b = subs[j]!
      // Reuse the lexical score computed above (Jaccard is symmetric).
      const similarity = lexScores.get(pairKey(a.id, b.id)) ?? 0
      const semantic_similarity = semFor(a.id, b.id)
      const match_type = classifyMatch(similarity, semantic_similarity, lexThreshold, effective)
      if (!match_type) continue
      const pair: PlagiarismPair = {
        a_id: a.id,
        a_name: nameOf(a),
        b_id: b.id,
        b_name: nameOf(b),
        similarity,
        semantic_similarity,
        match_type,
      }
      const skipped = skippedFor(a.id, b.id)
      if (skipped) pair.semantic_skipped = skipped
      if (truncatedIds.has(a.id) || truncatedIds.has(b.id)) pair.semantic_truncated = true
      pairs.push(pair)
    }
  }
  pairs.sort(
    (x, y) =>
      Math.max(y.similarity, y.semantic_similarity ?? 0) - Math.max(x.similarity, x.semantic_similarity ?? 0) ||
      y.similarity - x.similarity,
  )

  const skippedShort = subs.filter((s) => !isSemanticEligible(s.jawaban)).length
  const notes: string[] = []
  if (semantic.mode === 'local') {
    notes.push(
      'Skor semantik berjalan dalam mode aproksimasi offline (leksikal): hanya mengenali teks yang hampir sama, ' +
        'tidak dapat mendeteksi parafrase. Atur kunci API AI (NUXT_AI_API_KEY) untuk deteksi semantik sebenarnya.',
    )
  } else if (semantic.mode === 'unavailable') {
    const why =
      semantic.reason === 'budget'
        ? 'batas harian penggunaan AI telah tercapai'
        : semantic.reason === 'disabled'
          ? 'pemeriksaan semantik tidak dijalankan'
          : 'layanan embedding gagal'
    notes.push(
      `Skor semantik tidak tersedia (${why}${semantic.message ? `: ${semantic.message}` : ''}). Hanya skor leksikal yang dihitung.`,
    )
  }
  if (skippedShort > 0) {
    notes.push(`${skippedShort} jawaban di bawah ${SEMANTIC_MIN_WORDS} kata tidak dibandingkan secara semantik.`)
  }
  if (truncatedIds.size > 0) {
    notes.push(`${truncatedIds.size} jawaban terlalu panjang; hanya ${maxChars} karakter pertama yang dibandingkan secara semantik.`)
  }
  if (baseline !== null && effective !== null && semThreshold !== null && effective > semThreshold) {
    notes.push(
      `Jawaban kelas ini rata-rata sangat mirip (median ${baseline}%), sehingga ambang semantik dinaikkan menjadi ${effective}%.`,
    )
  }

  const summary: SemanticSummary = {
    mode: semantic.mode,
    threshold: semThreshold,
    effective_threshold: effective,
    baseline,
    min_words: SEMANTIC_MIN_WORDS,
    compared: eligible.length,
    skipped_short: skippedShort,
    truncated: truncatedIds.size,
  }
  if (semantic.mode === 'unavailable') summary.reason = semantic.reason
  if (notes.length) summary.note = notes.join(' ')

  return { checked, flagged, threshold: lexThreshold, total: subs.length, pairs, semantic: summary }
}
