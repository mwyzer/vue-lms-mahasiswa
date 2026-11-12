import { describe, it, expect } from 'vitest'
import {
  computeRiskScore,
  collectRiskSignals,
  attendanceRate,
  scoreTrend,
  riskLevelFor,
  validateRiskWeights,
  normalizeRiskWeights,
  latestActivityTimestamp,
  DEFAULT_RISK_WEIGHTS,
  type RiskSignals,
  type RiskSource,
} from '~/utils/riskScore'

const NOW = new Date('2025-10-01T00:00:00Z').getTime()
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString()

function signals(over: Partial<RiskSignals> = {}): RiskSignals {
  return {
    attendance: { total: 10, hadir: 10, izin: 0, sakit: 0, alpha: 0 },
    assignments: { due: 4, missing: 0, submitted: 4, late: 0 },
    scores: [
      { value: 85, at: daysAgo(40) },
      { value: 88, at: daysAgo(20) },
      { value: 86, at: daysAgo(5) },
    ],
    lastActivityAt: daysAgo(2),
    ...over,
  }
}

describe('computeRiskScore', () => {
  it('gives a healthy student a low score and no reasons', () => {
    const r = computeRiskScore(signals(), { now: NOW })
    expect(r.score).toBe(0)
    expect(r.level).toBe('rendah')
    expect(r.reasons).toEqual([])
    expect(r.coverage).toBe(1)
  })

  it('flags a struggling student as high risk with readable reasons sorted by contribution', () => {
    const r = computeRiskScore(
      signals({
        attendance: { total: 10, hadir: 5, izin: 0, sakit: 0, alpha: 5 },
        assignments: { due: 4, missing: 3, submitted: 1, late: 1 },
        scores: [
          { value: 80, at: daysAgo(40) },
          { value: 75, at: daysAgo(30) },
          { value: 50, at: daysAgo(20) },
          { value: 40, at: daysAgo(10) },
        ],
        lastActivityAt: daysAgo(30),
      }),
      { now: NOW },
    )
    expect(r.level).toBe('tinggi')
    expect(r.score).toBeGreaterThanOrEqual(60)
    const keys = r.reasons.map((x) => x.key)
    expect(keys).toContain('attendance')
    expect(keys).toContain('missing')
    expect(keys).toContain('trend')
    expect(keys).toContain('inactivity')
    // Sorted by contribution, largest first
    for (let i = 1; i < r.reasons.length; i++) {
      expect(r.reasons[i - 1].contribution).toBeGreaterThanOrEqual(r.reasons[i].contribution)
    }
    expect(r.reasons.find((x) => x.key === 'attendance')?.text).toMatch(/Kehadiran 50%.*di bawah batas 75%/)
    expect(r.reasons.find((x) => x.key === 'missing')?.text).toBe('3 dari 4 tugas yang sudah lewat tenggat tidak dikumpulkan')
    expect(r.reasons.find((x) => x.key === 'trend')?.text).toMatch(/Nilai turun 32\.5 poin/)
    expect(r.reasons.find((x) => x.key === 'inactivity')?.text).toBe('Tidak ada aktivitas selama 30 hari')
  })

  it('respects custom weights (only attendance counts)', () => {
    const s = signals({ attendance: { total: 4, hadir: 2, izin: 0, sakit: 0, alpha: 2 } })
    const onlyAttendance = { attendance: 1, missing: 0, late: 0, trend: 0, lowScore: 0, inactivity: 0 }
    const r = computeRiskScore(s, { weights: onlyAttendance, now: NOW })
    expect(r.score).toBe(100)
    expect(r.level).toBe('tinggi')
    const zeroAttendance = { ...DEFAULT_RISK_WEIGHTS, attendance: 0 }
    expect(computeRiskScore(s, { weights: zeroAttendance, now: NOW }).score).toBe(0)
  })

  it('re-normalises weights when signals have no data and reports coverage', () => {
    const s: RiskSignals = {
      attendance: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
      assignments: { due: 2, missing: 2, submitted: 0, late: 0 },
      scores: [],
      lastActivityAt: null,
    }
    const r = computeRiskScore(s, { now: NOW })
    // missing (25) + inactivity (10, no activity at all) have data, both at 1.0
    expect(r.score).toBe(100)
    expect(r.coverage).toBeCloseTo(0.35, 2)
    expect(r.reasons.map((x) => x.key)).toEqual(['missing', 'inactivity'])
    expect(r.reasons[1].text).toMatch(/Belum ada aktivitas/)
  })

  it('returns score 0 when there is no data at all', () => {
    const r = computeRiskScore({
      attendance: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
      assignments: { due: 0, missing: 0, submitted: 0, late: 0 },
      scores: [],
      lastActivityAt: null,
    })
    expect(r.score).toBe(0)
    expect(r.coverage).toBe(0)
    expect(r.level).toBe('rendah')
  })

  it('custom thresholds move the level boundaries', () => {
    const s = signals({ assignments: { due: 4, missing: 2, submitted: 2, late: 0 } })
    const base = computeRiskScore(s, { now: NOW })
    expect(base.level).toBe('rendah')
    const strict = computeRiskScore(s, { now: NOW, thresholds: { mediumAt: 5, highAt: 10 } })
    expect(strict.level).toBe('tinggi')
  })
})

describe('risk helpers', () => {
  it('attendanceRate counts izin/sakit as half', () => {
    expect(attendanceRate({ total: 4, hadir: 2, izin: 1, sakit: 1, alpha: 0 })).toBe(0.75)
    expect(attendanceRate({ total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 })).toBeNull()
  })

  it('scoreTrend compares chronological halves regardless of input order', () => {
    const t = scoreTrend([
      { value: 50, at: '2025-03-01' },
      { value: 90, at: '2025-01-01' },
      { value: 70, at: '2025-02-01' },
      { value: 40, at: '2025-04-01' },
    ])
    expect(t).toEqual({ early: 80, late: 45, drop: 35 })
    expect(scoreTrend([{ value: 1, at: '2025-01-01' }])).toBeNull()
  })

  it('riskLevelFor uses inclusive thresholds', () => {
    expect(riskLevelFor(34)).toBe('rendah')
    expect(riskLevelFor(35)).toBe('sedang')
    expect(riskLevelFor(60)).toBe('tinggi')
  })

  it('validates and normalises weights', () => {
    expect(validateRiskWeights(DEFAULT_RISK_WEIGHTS)).toBeNull()
    expect(validateRiskWeights({ ...DEFAULT_RISK_WEIGHTS, late: -1 })).toMatch(/Terlambat|terlambat/)
    expect(validateRiskWeights({ attendance: 0, missing: 0, late: 0, trend: 0, lowScore: 0, inactivity: 0 })).toMatch(/Minimal/)
    expect(normalizeRiskWeights({ late: 500 as number }).late).toBe(100)
    expect(normalizeRiskWeights(null)).toEqual(DEFAULT_RISK_WEIGHTS)
  })
})

describe('collectRiskSignals', () => {
  const src: RiskSource = {
    assignments: [
      { id: 'a1', course_id: 'c1', tenggat_waktu: '2025-08-15T23:59:59Z', judul: 'T1' },
      { id: 'a2', course_id: 'c1', tenggat_waktu: '2025-08-22T23:59:59Z', judul: 'T2' },
      { id: 'a3', course_id: 'c1', tenggat_waktu: '2025-12-01T00:00:00Z', judul: 'T3 (belum tenggat)' },
      { id: 'x', course_id: 'c2', tenggat_waktu: '2025-08-01T00:00:00Z' },
    ],
    submissions: [
      { assignment_id: 'a1', student_id: 's1', submitted_at: '2025-08-14T10:00:00Z', nilai: 90 },
      { assignment_id: 'a2', student_id: 's1', submitted_at: '2025-08-25T10:00:00Z', nilai: 60 },
      { assignment_id: 'a1', student_id: 's2', submitted_at: '2025-08-14T10:00:00Z' },
    ],
    attendance: [
      { course_id: 'c1', student_id: 's1', status: 'hadir', tanggal: '2025-09-02' },
      { course_id: 'c1', student_id: 's1', status: 'alpha', tanggal: '2025-09-09' },
      { course_id: 'c2', student_id: 's1', status: 'hadir', tanggal: '2025-09-30' },
    ],
    quizzes: [{ id: 'q1', course_id: 'c1', judul: 'Kuis' }],
    attempts: [
      { quiz_id: 'q1', student_id: 's1', percentage: 40, submitted_at: '2025-09-10T08:00:00Z' },
      { quiz_id: 'q1', student_id: 's1', percentage: 50, submitted_at: '2025-09-12T08:00:00Z' },
    ],
  }

  it('derives counts, late submissions, best quiz score and last activity for one course', () => {
    const s = collectRiskSignals('c1', 's1', src, NOW)
    expect(s.assignments).toEqual({ due: 2, missing: 0, submitted: 2, late: 1 })
    expect(s.attendance).toMatchObject({ total: 2, hadir: 1, alpha: 1 })
    expect(s.scores.map((x) => x.value)).toEqual([90, 60, 50])
    expect(s.lastActivityAt).toBe('2025-09-12T08:00:00Z')
  })

  it('counts missing work for a student without submissions', () => {
    const s = collectRiskSignals('c1', 's3', src, NOW)
    expect(s.assignments).toEqual({ due: 2, missing: 2, submitted: 0, late: 0 })
    expect(s.lastActivityAt).toBeNull()
    const r = computeRiskScore(s, { now: NOW })
    expect(r.level).toBe('tinggi')
  })

  it('latestActivityTimestamp finds the newest event', () => {
    expect(latestActivityTimestamp(src)).toBe(new Date('2025-09-30').getTime())
  })
})
