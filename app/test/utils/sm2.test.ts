/**
 * SM-2 — Unit Tests (pure scheduling logic in app/utils/sm2.ts).
 */
import { describe, it, expect } from 'vitest'
import {
  SM2_BUTTONS,
  SM2_MIN_EASE,
  addDaysToDateKey,
  diffDateKeys,
  formatInterval,
  initialSm2State,
  isDue,
  nextEaseFactor,
  previewIntervals,
  reviewSm2,
  toLocalDateKey,
  type Sm2State,
} from '~/utils/sm2'

const TODAY = '2026-03-10'
const fresh = (): Sm2State => initialSm2State(TODAY)

describe('date keys', () => {
  it('formats local dates and adds days across month/year boundaries', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(addDaysToDateKey('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysToDateKey('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDaysToDateKey('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysToDateKey('2026-03-10', -10)).toBe('2026-02-28')
    expect(diffDateKeys('2026-03-10', '2026-03-16')).toBe(6)
    expect(diffDateKeys('2026-03-10', '2026-03-09')).toBe(-1)
  })

  it('isDue is true on and after the due date', () => {
    expect(isDue({ due_date: TODAY }, TODAY)).toBe(true)
    expect(isDue({ due_date: '2026-03-09' }, TODAY)).toBe(true)
    expect(isDue({ due_date: '2026-03-11' }, TODAY)).toBe(false)
  })
})

describe('ease factor', () => {
  it('follows EF + (0.1 − (5−q)(0.08 + (5−q)·0.02))', () => {
    expect(nextEaseFactor(2.5, 5)).toBe(2.6)
    expect(nextEaseFactor(2.5, 4)).toBe(2.5)
    expect(nextEaseFactor(2.5, 3)).toBe(2.36)
    expect(nextEaseFactor(2.5, 2)).toBe(2.18)
    expect(nextEaseFactor(2.5, 1)).toBe(1.96)
    expect(nextEaseFactor(2.5, 0)).toBe(1.7)
  })

  it('never drops below 1.3', () => {
    let ef = 2.5
    for (let i = 0; i < 20; i++) ef = nextEaseFactor(ef, 0)
    expect(ef).toBe(SM2_MIN_EASE)
  })
})

describe('reviewSm2', () => {
  it('new card: correct answers give intervals 1 → 6 → round(6·EF)', () => {
    const s1 = reviewSm2(fresh(), 4, TODAY)
    expect(s1).toMatchObject({ repetitions: 1, interval_days: 1, ease_factor: 2.5, due_date: '2026-03-11', lapses: 0 })
    const s2 = reviewSm2(s1, 4, '2026-03-11')
    expect(s2).toMatchObject({ repetitions: 2, interval_days: 6, due_date: '2026-03-17' })
    const s3 = reviewSm2(s2, 5, '2026-03-17')
    // interval uses the EF before this review (2.5): round(6 × 2.5) = 15
    expect(s3).toMatchObject({ repetitions: 3, interval_days: 15, ease_factor: 2.6, due_date: '2026-04-01' })
  })

  it('a lapse (q < 3) resets repetitions, schedules tomorrow and counts the lapse', () => {
    const learned: Sm2State = { ease_factor: 2.5, interval_days: 15, repetitions: 3, due_date: TODAY, lapses: 0 }
    const s = reviewSm2(learned, 1, TODAY)
    expect(s).toMatchObject({ repetitions: 0, interval_days: 1, due_date: '2026-03-11', lapses: 1, ease_factor: 1.96 })
    // After a lapse the ladder restarts at 1 → 6.
    const s2 = reviewSm2(s, 4, '2026-03-11')
    expect(s2.interval_days).toBe(1)
    expect(reviewSm2(s2, 4, '2026-03-12').interval_days).toBe(6)
  })

  it('q = 3 still counts as correct but lowers EF', () => {
    const s = reviewSm2(fresh(), 3, TODAY)
    expect(s.repetitions).toBe(1)
    expect(s.ease_factor).toBe(2.36)
  })

  it('is pure and rejects invalid qualities', () => {
    const st = fresh()
    const copy = { ...st }
    reviewSm2(st, 5, TODAY)
    expect(st).toEqual(copy)
    expect(() => reviewSm2(st, 6, TODAY)).toThrow(RangeError)
    expect(() => reviewSm2(st, -1, TODAY)).toThrow(RangeError)
    expect(() => reviewSm2(st, 2.5, TODAY)).toThrow(RangeError)
  })

  it('repairs corrupt state (EF below min / NaN) and caps the interval', () => {
    const s = reviewSm2({ ease_factor: NaN, interval_days: 3000, repetitions: 9, due_date: TODAY, lapses: 0 }, 5, TODAY)
    expect(s.interval_days).toBe(3650)
    expect(s.ease_factor).toBe(2.6)
  })
})

describe('buttons, preview and labels', () => {
  it('maps Lagi/Sulit/Bagus/Mudah to 1/3/4/5', () => {
    expect(SM2_BUTTONS.map((b) => [b.label, b.quality])).toEqual([['Lagi', 1], ['Sulit', 3], ['Bagus', 4], ['Mudah', 5]])
  })

  it('previews the next interval for every quality', () => {
    const p = previewIntervals({ ease_factor: 2.5, interval_days: 6, repetitions: 2, due_date: TODAY, lapses: 0 }, TODAY)
    expect(p).toEqual({ 0: 1, 1: 1, 2: 1, 3: 15, 4: 15, 5: 15 })
  })

  it('formats intervals in Indonesian', () => {
    expect(formatInterval(0)).toBe('hari ini')
    expect(formatInterval(1)).toBe('1 hari')
    expect(formatInterval(21)).toBe('3 minggu')
    expect(formatInterval(90)).toBe('3 bulan')
    expect(formatInterval(548)).toBe('1,5 tahun')
  })
})
