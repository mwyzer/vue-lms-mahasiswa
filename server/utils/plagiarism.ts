/**
 * Plagiarism — Pure text-similarity detection utilities.
 *
 * Compares submissions using a token-based Jaccard similarity on shingles
 * (overlapping n-grams). Kept dependency-free and pure so it can be unit
 * tested and reused on both server and client.
 */

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