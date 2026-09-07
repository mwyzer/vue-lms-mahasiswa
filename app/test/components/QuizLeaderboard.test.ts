/**
 * QuizLeaderboard — Unit Tests
 *
 * Tests ranking display, empty state, and limit.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuizLeaderboard from '~/components/common/QuizLeaderboard.vue'
import { useQuizStore } from '~/stores/quiz'
import { useAuthStore } from '~/stores/auth'

function seedRoster() {
  const auth = useAuthStore()
  auth.students = [
    { id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' },
    { id: 's2', nama: 'Budi Santoso', npm: '20241002', kelas: '1A', level: 1, session_time: 'morning' },
  ]
}

describe('QuizLeaderboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedRoster()
  })

  it('renders empty state when there are no attempts', async () => {
    const store = useQuizStore()
    await store.init()

    const wrapper = mount(QuizLeaderboard, { props: { quizId: 'qz5' } })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('renders ranked rows with names, npm, and scores', async () => {
    const store = useQuizStore()
    await store.init()

    const wrapper = mount(QuizLeaderboard, { props: { quizId: 'qz2' } })
    const rows = wrapper.findAll('.rank-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Ahmad Fauzi')
    expect(rows[0].text()).toContain('20241001')
    expect(rows[0].text()).toContain('100%')
    expect(rows[1].text()).toContain('67%')
  })

  it('respects the limit prop', async () => {
    const store = useQuizStore()
    await store.init()

    store.attempts.push({
      id: 'x1', quiz_id: 'qzlimit', student_id: 's1', score: 1, total_questions: 1,
      percentage: 60, started_at: '2025-01-01T10:00:00Z', submitted_at: '2025-01-01T10:05:00Z',
    })
    store.attempts.push({
      id: 'x2', quiz_id: 'qzlimit', student_id: 's2', score: 1, total_questions: 1,
      percentage: 70, started_at: '2025-01-01T10:00:00Z', submitted_at: '2025-01-01T10:05:00Z',
    })

    const wrapper = mount(QuizLeaderboard, { props: { quizId: 'qzlimit', limit: 1 } })
    expect(wrapper.findAll('.rank-row')).toHaveLength(1)
  })
})