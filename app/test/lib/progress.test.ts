/**
 * Progress & gamification — pure functions (streak, stats, badge evaluation).
 */
import { describe, it, expect } from 'vitest'
import {
  activityHeatmap,
  badgeProgress,
  computeStats,
  computeStreak,
  dayKey,
  evaluateBadges,
  qualifyingBadges,
  type Activity,
} from '~/lib/progress'
import { BADGES, badgeById, type BadgeDefinition } from '~/data/badges'

const DAY = 86_400_000
// 2026-11-12 10:00 WIB
const NOW = Date.parse('2026-11-12T03:00:00Z')
const daysAgo = (n: number, hourUtc = 3) => new Date(Date.parse('2026-11-12T00:00:00Z') - n * DAY + hourUtc * 3_600_000).toISOString()

let seq = 0
function act(tipe: Activity['tipe'], created_at: string, ref_id: string | null = `r${++seq}`, meta: Activity['meta'] = null): Activity {
  return { id: `a${++seq}`, user_id: 'u', tipe, ref_id, course_id: null, meta, created_at }
}

describe('dayKey', () => {
  it('uses WIB (UTC+7) by default', () => {
    // 2026-11-11 18:30 UTC = 2026-11-12 01:30 WIB
    expect(dayKey('2026-11-11T18:30:00Z')).toBe('2026-11-12')
    expect(dayKey('2026-11-11T16:59:59Z')).toBe('2026-11-11')
    expect(dayKey('2026-11-11T18:30:00Z', 0)).toBe('2026-11-11')
  })
  it('returns null for invalid input', () => {
    expect(dayKey('bukan tanggal')).toBeNull()
  })
})

describe('computeStreak', () => {
  it('is zero without activity', () => {
    expect(computeStreak([], NOW)).toEqual({ current: 0, longest: 0, activeToday: false, lastActiveDay: null, activeDays: 0 })
  })

  it('counts consecutive days ending today; several activities on one day count once', () => {
    const r = computeStreak([daysAgo(0), daysAgo(0, 5), daysAgo(1), daysAgo(2)], NOW)
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
    expect(r.activeToday).toBe(true)
    expect(r.activeDays).toBe(3)
    expect(r.lastActiveDay).toBe('2026-11-12')
  })

  it('stays alive when the last activity was yesterday', () => {
    const r = computeStreak([daysAgo(1), daysAgo(2)], NOW)
    expect(r.current).toBe(2)
    expect(r.activeToday).toBe(false)
  })

  it('breaks after a missed day but keeps the longest run', () => {
    const r = computeStreak([daysAgo(2), daysAgo(5), daysAgo(6), daysAgo(7), daysAgo(8)], NOW)
    expect(r.current).toBe(0)
    expect(r.longest).toBe(4)
  })

  it('respects the WIB day boundary', () => {
    // 23:30 WIB on the 11th and 00:30 WIB on the 12th are two days.
    const r = computeStreak(['2026-11-11T16:30:00Z', '2026-11-11T17:30:00Z'], NOW)
    expect(r.current).toBe(2)
  })

  it('treats future timestamps (clock skew) as today and ignores invalid ones', () => {
    const r = computeStreak([new Date(NOW + 3 * DAY).toISOString(), 'x'], NOW)
    expect(r).toMatchObject({ current: 1, activeToday: true, activeDays: 1 })
  })
})

describe('computeStats', () => {
  it('deduplicates by type + ref and counts every flashcard session by meta.count', () => {
    const s = computeStats(
      [
        act('lesson_completed', daysAgo(0), 'l1'),
        act('lesson_completed', daysAgo(1), 'l1'),
        act('lesson_completed', daysAgo(1), 'l2'),
        act('flashcard_reviewed', daysAgo(0), null, { count: 12 }),
        act('flashcard_reviewed', daysAgo(0), null),
        act('forum_post', daysAgo(3), 't1'),
      ],
      { now: NOW, coursesCompleted: 2 },
    )
    expect(s.lessonsCompleted).toBe(2)
    expect(s.flashcardReviews).toBe(13)
    expect(s.forumPosts).toBe(1)
    expect(s.totalActivities).toBe(5)
    expect(s.currentStreak).toBe(2)
    expect(s.coursesCompleted).toBe(2)
  })

  it('counts a quiz as perfect if any attempt scored 100', () => {
    const s = computeStats(
      [
        act('quiz_submitted', daysAgo(2), 'q1', { percentage: 60 }),
        act('quiz_submitted', daysAgo(1), 'q1', { percentage: 100 }),
        act('quiz_submitted', daysAgo(1), 'q2', { percentage: 99 }),
      ],
      { now: NOW },
    )
    expect(s.quizzesSubmitted).toBe(2)
    expect(s.perfectQuizzes).toBe(1)
  })

  it('ignores unknown activity types', () => {
    const bogus = { ...act('lesson_completed', daysAgo(0)), tipe: 'hack' } as unknown as Activity
    expect(computeStats([bogus], { now: NOW }).totalActivities).toBe(0)
  })
})

describe('badge evaluation', () => {
  const base = computeStats([], { now: NOW })

  it('badge ids are unique and every rule reads a known metric', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
    for (const b of BADGES) {
      expect(b.metric in base).toBe(true)
      expect(b.min).toBeGreaterThan(0)
    }
  })

  it('awards nothing without activity', () => {
    expect(evaluateBadges(BADGES, base)).toEqual([])
  })

  it('awards Pemula for the first activity and streak badges by longest streak', () => {
    const acts = [0, 1, 2, 3, 4, 5, 6].map((n) => act('lesson_completed', daysAgo(n)))
    const ids = evaluateBadges(BADGES, computeStats(acts, { now: NOW })).map((b) => b.id)
    expect(ids).toEqual(expect.arrayContaining(['pemula', 'streak-3', 'streak-7']))
    expect(ids).not.toContain('streak-30')
  })

  it('keeps streak badges after the streak breaks (longest streak)', () => {
    const acts = [10, 11, 12].map((n) => act('lesson_completed', daysAgo(n)))
    const stats = computeStats(acts, { now: NOW })
    expect(stats.currentStreak).toBe(0)
    expect(qualifyingBadges(BADGES, stats).map((b) => b.id)).toContain('streak-3')
  })

  it('only returns badges not yet earned', () => {
    const stats = { ...base, totalActivities: 3, perfectQuizzes: 1, forumPosts: 5 }
    expect(evaluateBadges(BADGES, stats, ['pemula']).map((b) => b.id).sort()).toEqual(['nilai-sempurna', 'rajin-forum'])
    expect(evaluateBadges(BADGES, stats, ['pemula', 'nilai-sempurna', 'rajin-forum'])).toEqual([])
  })

  it('works with custom definitions (data-driven)', () => {
    const defs: BadgeDefinition[] = [{ id: 'x', nama: 'X', deskripsi: '', icon: '⭐', tier: 'perak', metric: 'assignmentsSubmitted', min: 2 }]
    expect(evaluateBadges(defs, { ...base, assignmentsSubmitted: 1 })).toEqual([])
    expect(evaluateBadges(defs, { ...base, assignmentsSubmitted: 2 })).toHaveLength(1)
  })

  it('badgeProgress caps at the target', () => {
    const def = badgeById('kutu-buku')!
    expect(badgeProgress(def, { ...base, lessonsCompleted: 4 })).toEqual({ value: 4, target: 10, percent: 40 })
    expect(badgeProgress(def, { ...base, lessonsCompleted: 25 })).toEqual({ value: 10, target: 10, percent: 100 })
  })
})

describe('activityHeatmap', () => {
  it('returns one bucket per day, oldest first, ending today', () => {
    const map = activityHeatmap([{ created_at: daysAgo(0) }, { created_at: daysAgo(0) }, { created_at: daysAgo(3) }, { created_at: daysAgo(40) }], 7, NOW)
    expect(map).toHaveLength(7)
    expect(map[6]).toEqual({ day: '2026-11-12', count: 2 })
    expect(map[3]).toEqual({ day: '2026-11-09', count: 1 })
    expect(map.reduce((s, d) => s + d.count, 0)).toBe(3)
  })
})
