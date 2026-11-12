/**
 * Rubrics Store — Unit Tests (demo mode)
 *
 * Rubric CRUD + validation, rubric grading into submissions.nilai, peer review
 * flow (config, assignment, notifications, anonymous review, override) and the
 * peer-blended score in the gradebook.
 *
 * Demo data is module-level and shared between tests in this file, so the
 * tests run in order and build on each other.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useRubricsStore } from '~/stores/rubrics'
import { useAssignmentsStore } from '~/stores/assignments'
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'
import { useGradebookStore } from '~/stores/gradebook'
import { computeRubricScore, defaultLevels, type RubricCriterion } from '../../../shared/rubric'

async function loginInstructor() {
  expect(await useAuthStore().loginAsInstructor('Dr. Andi Wijaya', 'instruktur123')).toBe(true)
}
async function loginStudent(nama: string, npm: string) {
  expect(await useAuthStore().loginAsStudent(nama, npm, 'mahasiswa123')).toBe(true)
}

async function setup() {
  await useAssignmentsStore().init()
  await useRubricsStore().init()
  await useNotificationsStore().init()
}

describe('rubrics store (demo)', () => {
  beforeEach(setup)

  it('ships a demo rubric for a1 with weights totalling 100', () => {
    const r = useRubricsStore().rubricFor('a1')!
    expect(r).toBeTruthy()
    expect(r.criteria.reduce((s, c) => s + c.bobot, 0)).toBe(100)
    expect(r.peer.enabled).toBe(false)
    expect(useRubricsStore().rubricFor('a2')).toBeNull()
  })

  it('rejects an invalid rubric and saves a valid one', async () => {
    const store = useRubricsStore()
    const bad: RubricCriterion[] = [{ id: 'x1', nama: 'A', bobot: 60, levels: defaultLevels() }]
    expect(await store.saveRubric('a2', bad)).toBe(false)
    expect(store.error).toContain('100')

    const good: RubricCriterion[] = [
      { id: 'x1', nama: 'Fungsi', bobot: 70, levels: defaultLevels() },
      { id: 'x2', nama: 'Kerapian', bobot: 30, levels: defaultLevels() },
    ]
    expect(await store.saveRubric('a2', good)).toBe(true)
    expect(store.rubricFor('a2')!.criteria.map((c) => c.nama)).toEqual(['Fungsi', 'Kerapian'])
    expect(await store.deleteRubric('a2')).toBe(true)
    expect(store.rubricFor('a2')).toBeNull()
  })

  it('grades with the rubric: stores levels and writes the total to submissions.nilai', async () => {
    await loginInstructor()
    const store = useRubricsStore()
    const criteria = store.rubricFor('a1')!.criteria
    const selection = { [criteria[0]!.id]: criteria[0]!.levels[1]!.id, [criteria[1]!.id]: criteria[1]!.levels[0]!.id, [criteria[2]!.id]: criteria[2]!.levels[2]!.id }
    const expected = computeRubricScore(criteria, selection).total // 37.5 + 30 + 0 → 68

    expect(await store.gradeWithRubric('sub2', 'a1', { [criteria[0]!.id]: criteria[0]!.levels[0]!.id }, 'x')).toBeNull()
    expect(store.error).toContain('setiap kriteria')

    expect(await store.gradeWithRubric('sub2', 'a1', selection, 'Rapi, tambah penjelasan.')).toBe(expected)
    expect(expected).toBe(68)
    const sub = useAssignmentsStore().submissions.find((s) => s.id === 'sub2')!
    expect(sub.nilai).toBe(68)
    expect(sub.feedback).toBe('Rapi, tambah penjelasan.')
    expect(store.selectionFor('sub2')).toEqual(selection)

    // Manual adjustment keeps the levels but saves the adjusted score.
    expect(await store.gradeWithRubric('sub2', 'a1', selection, 'ok', 72)).toBe(72)
    expect(useAssignmentsStore().submissions.find((s) => s.id === 'sub2')!.nilai).toBe(72)
  })

  it('peer review needs a valid config, then assigns balanced reviewers and notifies them', async () => {
    await loginInstructor()
    const store = useRubricsStore()
    expect(await store.assignPeerReviews('a1')).toBeNull()
    expect(store.error).toContain('Aktifkan')

    expect(await store.savePeerConfig('a1', { enabled: true, reviewers_per_submission: 2, deadline: null, weight: 20 })).toBe(false)
    expect(store.error).toContain('Tenggat')
    expect(await store.savePeerConfig('a1', { enabled: true, reviewers_per_submission: 2, deadline: '2099-01-01T00:00:00Z', weight: 40 })).toBe(false)

    expect(await store.savePeerConfig('a1', { enabled: true, reviewers_per_submission: 2, deadline: '2099-01-01T00:00:00Z', weight: 20 })).toBe(true)
    const res = (await store.assignPeerReviews('a1'))!
    // a1 has two submitters (s1, s2) → k clamped to 1.
    expect(res).toMatchObject({ created: 2, effectiveK: 1 })
    expect(res.note).toContain('2 mahasiswa')
    const reviews = store.reviewsForAssignment('a1')
    expect(reviews.map((r) => [r.reviewer_id, r.submission_id]).sort()).toEqual([['s1', 'sub2'], ['s2', 'sub1']])

    await loginStudent('Ahmad Fauzi', '20241001')
    await useNotificationsStore().init()
    expect(useNotificationsStore().mine.some((n) => n.judul.startsWith('Peer review:') && n.link === '/assignments/a1')).toBe(true)
  })

  it('student reviews anonymously; the owner sees an anonymous review; final score blends in', async () => {
    const store = useRubricsStore()
    await loginStudent('Ahmad Fauzi', '20241001')
    const tasks = store.myReviewTasks('a1')
    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.label).toBe('Jawaban 1')
    expect(tasks[0]!.jawaban).toBe('print("Hello World")')

    const criteria = store.rubricFor('a1')!.criteria
    const top = Object.fromEntries(criteria.map((c) => [c.id, c.levels[0]!.id]))
    expect(await store.submitPeerReview(tasks[0]!.id, top, 'ok')).toBe(false) // comment too short
    expect(await store.submitPeerReview(tasks[0]!.id, top, 'Programnya benar dan rapi, mantap.')).toBe(true)
    expect(store.myReviewTasks('a1')[0]!.status).toBe('submitted')

    // Re-assigning is blocked once a review was submitted.
    await loginInstructor()
    expect(await store.assignPeerReviews('a1')).toBeNull()

    // Owner (s2) sees it without reviewer identity.
    await loginStudent('Budi Santoso', '20241002')
    const received = store.myReceivedReviews('sub2')
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ label: 'Reviewer 1', skor: 100 })
    expect(received[0]).not.toHaveProperty('reviewer_id')

    // Instructor score 72, peer 100, weight 20% → 72·0.8 + 100·0.2 = 77.6 → 78
    const sub2 = useAssignmentsStore().submissions.find((s) => s.id === 'sub2')!
    expect(store.finalScoreFor(sub2)).toBe(78)
    // The peer avg of sub1 has no submitted review yet → instructor score unchanged.
    const sub1 = useAssignmentsStore().submissions.find((s) => s.id === 'sub1')!
    expect(store.finalScoreFor(sub1)).toBe(90)
  })

  it('instructor override / exclusion changes the counted peer score', async () => {
    await loginInstructor()
    const store = useRubricsStore()
    const r = store.reviewsForSubmission('sub2')[0]!
    expect(await store.overridePeerReview(r.id, { override_skor: 101 })).toBe(false)
    expect(await store.overridePeerReview(r.id, { override_skor: 50 })).toBe(true)
    const sub2 = useAssignmentsStore().submissions.find((s) => s.id === 'sub2')!
    expect(store.peerSummaryFor('sub2')!.average).toBe(50)
    expect(store.finalScoreFor(sub2)).toBe(68) // 57.6 + 10
    expect(await store.overridePeerReview(r.id, { excluded: true })).toBe(true)
    expect(store.finalScoreFor(sub2)).toBe(72)
    expect(await store.overridePeerReview(r.id, { excluded: false, override_skor: null })).toBe(true)
    expect(store.finalScoreFor(sub2)).toBe(78)
  })

  it('the gradebook uses the peer-blended assignment score', async () => {
    await loginInstructor()
    const gb = useGradebookStore()
    await gb.init()
    const s2 = gb.courseGradebook('c1').find((r) => r.student_id === 's2')!
    // c1 assignments: a1 (s2 → 78 blended) and a2 (s2 did not submit, past deadline → 0).
    expect(s2.tugas).toBe(39)
  })

  it('reminds a reviewer of a pending review shortly before the deadline', async () => {
    await loginInstructor()
    const store = useRubricsStore()
    const now = Date.parse('2098-12-31T12:00:00Z') // 12h before the deadline
    await loginStudent('Budi Santoso', '20241002')
    await useNotificationsStore().init()
    expect(store.syncPeerDeadlineReminders(now)).toBe(1)
    expect(store.syncPeerDeadlineReminders(now)).toBe(0) // de-duplicated
    expect(useNotificationsStore().mine.some((n) => n.tipe === 'deadline' && n.judul.startsWith('Tenggat peer review'))).toBe(true)
    // Far from the deadline → nothing.
    expect(store.syncPeerDeadlineReminders(Date.parse('2098-01-01T00:00:00Z'))).toBe(0)
  })
})
