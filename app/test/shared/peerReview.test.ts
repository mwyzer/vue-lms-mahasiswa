/**
 * Peer review — Unit Tests (shared/peerReview.ts)
 *
 * Reviewer assignment (no self review, balanced, deterministic), aggregation
 * with overrides/exclusions, and blending into the final score.
 */
import { describe, it, expect } from 'vitest'
import {
  aggregatePeerScores,
  anonymousLabels,
  assignReviewers,
  combineScores,
  effectiveReviewScore,
  isReviewOpen,
  reviewerLoad,
  type PeerReview,
  type SubmissionRef,
} from '../../../shared/peerReview'

const subs = (n: number): SubmissionRef[] =>
  Array.from({ length: n }, (_, i) => ({ submission_id: `sub${i + 1}`, student_id: `s${i + 1}` }))

const ownerOf = (list: SubmissionRef[], subId: string) => list.find((s) => s.submission_id === subId)!.student_id

describe('assignReviewers', () => {
  for (const [n, k] of [[2, 1], [3, 2], [5, 2], [7, 3], [12, 5]] as const) {
    it(`n=${n}, k=${k}: no self review, k distinct reviewers per submission, k reviews per reviewer`, () => {
      const list = subs(n)
      const { pairs, effectiveK, note } = assignReviewers(list, k, 'seed-1')
      expect(effectiveK).toBe(k)
      expect(note).toBeNull()
      expect(pairs).toHaveLength(n * k)
      for (const p of pairs) expect(ownerOf(list, p.submission_id)).not.toBe(p.reviewer_id)
      for (const s of list) {
        const reviewers = pairs.filter((p) => p.submission_id === s.submission_id).map((p) => p.reviewer_id)
        expect(reviewers).toHaveLength(k)
        expect(new Set(reviewers).size).toBe(k)
      }
      expect(Object.values(reviewerLoad(pairs))).toEqual(Array(n).fill(k))
      // No duplicated (reviewer, submission) pair.
      expect(new Set(pairs.map((p) => `${p.reviewer_id}>${p.submission_id}`)).size).toBe(pairs.length)
    })
  }

  it('clamps k to n − 1 and explains why', () => {
    const r = assignReviewers(subs(3), 5, 1)
    expect(r.effectiveK).toBe(2)
    expect(r.pairs).toHaveLength(6)
    expect(r.note).toContain('3 mahasiswa')
  })

  it('needs at least two authors', () => {
    expect(assignReviewers(subs(1), 2, 1)).toMatchObject({ pairs: [], effectiveK: 0 })
    expect(assignReviewers([], 2, 1).pairs).toEqual([])
    expect(assignReviewers(subs(4), 0, 1).pairs).toEqual([])
  })

  it('is deterministic for a seed and independent of input order', () => {
    const list = subs(6)
    const a = assignReviewers(list, 2, 'abc').pairs
    const b = assignReviewers([...list].reverse(), 2, 'abc').pairs
    expect(b).toEqual(a)
    const others = ['x', 'y', 'z', 'w'].map((seed) => JSON.stringify(assignReviewers(list, 2, seed).pairs))
    expect(others.some((o) => o !== JSON.stringify(a))).toBe(true)
  })

  it('keeps one submission per student', () => {
    const list = [...subs(3), { submission_id: 'dup', student_id: 's1' }]
    const { pairs } = assignReviewers(list, 1, 7)
    expect(pairs).toHaveLength(3)
    expect(pairs.some((p) => p.submission_id === 'dup')).toBe(false)
  })
})

const review = (over: Partial<PeerReview>): PeerReview => ({
  id: 'r', assignment_id: 'a', submission_id: 'sub1', reviewer_id: 's2', status: 'submitted',
  selections: {}, komentar: '', skor: 80, override_skor: null, excluded: false, submitted_at: '', created_at: '',
  ...over,
})

describe('aggregatePeerScores', () => {
  it('averages submitted reviews per submission', () => {
    const res = aggregatePeerScores([
      review({ id: 'r1', skor: 80 }),
      review({ id: 'r2', skor: 65 }),
      review({ id: 'r3', status: 'assigned', skor: null }),
      review({ id: 'r4', submission_id: 'sub2', skor: 90 }),
    ])
    expect(res.sub1).toEqual({ average: 72.5, counted: 2, submitted: 2, assigned: 3 })
    expect(res.sub2.average).toBe(90)
  })

  it('applies instructor overrides and exclusions', () => {
    const res = aggregatePeerScores([
      review({ id: 'r1', skor: 20, override_skor: 70 }),
      review({ id: 'r2', skor: 100, excluded: true }),
      review({ id: 'r3', skor: 90 }),
    ])
    expect(res.sub1).toMatchObject({ average: 80, counted: 2 })
  })

  it('has a null average when nothing counts', () => {
    expect(aggregatePeerScores([review({ status: 'assigned', skor: null })]).sub1.average).toBeNull()
    expect(effectiveReviewScore(review({ status: 'assigned', skor: null, override_skor: 50 }))).toBe(50)
  })
})

describe('combineScores', () => {
  it('blends instructor and peer by weight', () => {
    expect(combineScores(80, 60, 20)).toBe(76) // 64 + 12
    expect(combineScores(90, 70, 30)).toBe(84)
  })

  it('falls back to the instructor score without a peer average or weight', () => {
    expect(combineScores(80, null, 20)).toBe(80)
    expect(combineScores(80, 50, 0)).toBe(80)
  })

  it('returns null until the instructor graded', () => {
    expect(combineScores(null, 90, 20)).toBeNull()
  })
})

describe('misc', () => {
  it('isReviewOpen compares with the deadline', () => {
    const now = Date.parse('2026-01-10T00:00:00Z')
    expect(isReviewOpen('2026-01-11T00:00:00Z', now)).toBe(true)
    expect(isReviewOpen('2026-01-09T00:00:00Z', now)).toBe(false)
    expect(isReviewOpen(null, now)).toBe(true)
  })

  it('anonymousLabels orders by review id, not by reviewer', () => {
    const labelled = anonymousLabels([{ id: 'b', reviewer_id: 's1' }, { id: 'a', reviewer_id: 's9' }])
    expect(labelled.map((r) => [r.id, r.label])).toEqual([['a', 'Reviewer 1'], ['b', 'Reviewer 2']])
  })
})
