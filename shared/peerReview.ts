/**
 * Peer review — pure logic (reviewer assignment, aggregation, final score).
 * No Nuxt/Pinia globals so it can be unit tested directly.
 */

export type PeerReviewStatus = 'assigned' | 'submitted'

export interface PeerReview {
  id: string
  assignment_id: string
  submission_id: string
  reviewer_id: string
  status: PeerReviewStatus
  /** criterion_id → level_id chosen by the reviewer. */
  selections: Record<string, string>
  komentar: string
  /** Rubric score 0–100 computed from `selections` when submitted. */
  skor: number | null
  /** Instructor override of this review's score (takes precedence over `skor`). */
  override_skor: number | null
  override_note?: string | null
  /** Instructor excluded this review from the average. */
  excluded: boolean
  submitted_at: string | null
  created_at: string
}

export interface ReviewerPair {
  submission_id: string
  reviewer_id: string
}

export interface SubmissionRef {
  submission_id: string
  student_id: string
}

/** Small deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of a string → 32-bit seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export interface AssignmentResult {
  pairs: ReviewerPair[]
  /** Reviewers per submission actually used (clamped to n − 1). */
  effectiveK: number
  /** Why fewer than requested were assigned, if so. */
  note: string | null
}

/**
 * Assign reviewers among the students who submitted.
 *
 * Shuffle the authors with a seeded PRNG into a ring, then author at position i
 * reviews the submissions at positions i+1 … i+k (mod n). This guarantees:
 *   - nobody reviews their own work;
 *   - every submission gets exactly k distinct reviewers;
 *   - every reviewer gets exactly k reviews (perfectly balanced).
 * k is clamped to n − 1. With fewer than 2 authors no pairs are produced.
 * Duplicate submissions by the same student keep only the first.
 */
export function assignReviewers(submissions: SubmissionRef[], k: number, seed: number | string): AssignmentResult {
  const seen = new Set<string>()
  const authors: SubmissionRef[] = []
  for (const s of submissions) {
    if (!s.student_id || !s.submission_id || seen.has(s.student_id)) continue
    seen.add(s.student_id)
    authors.push(s)
  }
  const n = authors.length
  const requested = Math.max(0, Math.floor(k))
  if (n < 2 || requested < 1) {
    return { pairs: [], effectiveK: 0, note: n < 2 ? 'Peer review butuh minimal 2 mahasiswa yang sudah mengumpulkan.' : null }
  }
  const effectiveK = Math.min(requested, n - 1)
  // Sort first so the result depends only on the set of authors + seed, not input order.
  const sorted = [...authors].sort((a, b) => (a.student_id < b.student_id ? -1 : a.student_id > b.student_id ? 1 : 0))
  const rand = mulberry32(typeof seed === 'number' ? seed : hashSeed(seed))
  const ring = shuffle(sorted, rand)

  const pairs: ReviewerPair[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 1; j <= effectiveK; j++) {
      pairs.push({ reviewer_id: ring[i]!.student_id, submission_id: ring[(i + j) % n]!.submission_id })
    }
  }
  return {
    pairs,
    effectiveK,
    note: effectiveK < requested ? `Hanya ${n} mahasiswa yang mengumpulkan, jadi tiap jawaban mendapat ${effectiveK} reviewer.` : null,
  }
}

/** Score that counts for one review (override wins), or null if it does not count. */
export function effectiveReviewScore(r: Pick<PeerReview, 'status' | 'skor' | 'override_skor' | 'excluded'>): number | null {
  if (r.excluded) return null
  if (typeof r.override_skor === 'number') return r.override_skor
  if (r.status !== 'submitted') return null
  return typeof r.skor === 'number' ? r.skor : null
}

export interface PeerSummary {
  /** Mean of counted reviews, one decimal; null when none count. */
  average: number | null
  /** Reviews that count toward the average. */
  counted: number
  submitted: number
  assigned: number
}

/** Aggregate reviews per submission. */
export function aggregatePeerScores(reviews: PeerReview[]): Record<string, PeerSummary> {
  const out: Record<string, PeerSummary & { sum: number }> = {}
  for (const r of reviews) {
    const s = (out[r.submission_id] ??= { average: null, counted: 0, submitted: 0, assigned: 0, sum: 0 })
    s.assigned++
    if (r.status === 'submitted') s.submitted++
    const v = effectiveReviewScore(r)
    if (v !== null) {
      s.sum += Math.max(0, Math.min(100, v))
      s.counted++
    }
  }
  const result: Record<string, PeerSummary> = {}
  for (const [id, s] of Object.entries(out)) {
    result[id] = {
      average: s.counted ? Math.round((s.sum / s.counted) * 10) / 10 : null,
      counted: s.counted,
      submitted: s.submitted,
      assigned: s.assigned,
    }
  }
  return result
}

/**
 * Final assignment score combining the instructor's score with the peer
 * average: round(instr × (100 − w)/100 + peer × w/100).
 * - No instructor score yet → null (the instructor still decides the grade).
 * - No peer average or weight 0 → the instructor score unchanged.
 */
export function combineScores(instructor: number | null | undefined, peerAverage: number | null | undefined, weightPct: number): number | null {
  if (typeof instructor !== 'number' || !Number.isFinite(instructor)) return null
  const w = Math.max(0, Math.min(100, Number(weightPct) || 0))
  if (w === 0 || typeof peerAverage !== 'number' || !Number.isFinite(peerAverage)) return Math.round(instructor)
  return Math.round((instructor * (100 - w)) / 100 + (peerAverage * w) / 100)
}

/** Reviews per reviewer (for balance checks / UI). */
export function reviewerLoad(pairs: ReviewerPair[]): Record<string, number> {
  const load: Record<string, number> = {}
  for (const p of pairs) load[p.reviewer_id] = (load[p.reviewer_id] ?? 0) + 1
  return load
}

/** True when the review window is still open. */
export function isReviewOpen(deadline: string | null | undefined, now: number = Date.now()): boolean {
  if (!deadline) return true
  const t = new Date(deadline).getTime()
  return Number.isNaN(t) || now <= t
}

/** Stable anonymous labels: "Reviewer 1…n" ordered by review id (never by reviewer identity). */
export function anonymousLabels<T extends { id: string }>(reviews: T[]): Array<T & { label: string }> {
  return [...reviews]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r, i) => ({ ...r, label: `Reviewer ${i + 1}` }))
}
