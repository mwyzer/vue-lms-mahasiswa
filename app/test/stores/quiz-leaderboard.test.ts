/**
 * Unit tests for quiz leaderboard ranking.
 */
import { describe, it, expect } from 'vitest'
import { useQuizStore } from '../../stores/quiz'

describe('quiz store leaderboardForQuiz', () => {
  it('ranks attempts by percentage descending', async () => {
    const store = useQuizStore()
    await store.init()

    const lb = store.leaderboardForQuiz('qz2')
    expect(lb).toHaveLength(2)
    expect(lb[0].student_id).toBe('s1')
    expect(lb[0].percentage).toBe(100)
    expect(lb[1].student_id).toBe('s2')
    expect(lb[1].percentage).toBe(67)
    expect(lb[0].rank).toBe(1)
    expect(lb[1].rank).toBe(2)
  })

  it('breaks percentage ties by shortest duration', async () => {
    const store = useQuizStore()
    await store.init()

    store.attempts.push({
      id: 't1', quiz_id: 'qz9', student_id: 's1',
      score: 1, total_questions: 1, percentage: 50,
      started_at: '2025-01-01T10:00:00Z', submitted_at: '2025-01-01T10:05:00Z',
    })
    store.attempts.push({
      id: 't2', quiz_id: 'qz9', student_id: 's2',
      score: 1, total_questions: 1, percentage: 50,
      started_at: '2025-01-01T10:00:00Z', submitted_at: '2025-01-01T10:10:00Z',
    })

    const lb = store.leaderboardForQuiz('qz9')
    expect(lb[0].id).toBe('t1')
    expect(lb[1].id).toBe('t2')
  })

  it('only includes attempts for the requested quiz', async () => {
    const store = useQuizStore()
    await store.init()

    const lb = store.leaderboardForQuiz('qz1')
    expect(lb.every(a => a.quiz_id === 'qz1')).toBe(true)
    expect(lb).toHaveLength(1)
  })

  it('returns empty list when a quiz has no attempts', async () => {
    const store = useQuizStore()
    await store.init()

    expect(store.leaderboardForQuiz('qz5')).toEqual([])
  })
})