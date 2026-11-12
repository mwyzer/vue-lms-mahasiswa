/**
 * Rubric — Unit Tests (shared/rubric.ts)
 *
 * Score computation, validation, level picking and selection sanitising.
 */
import { describe, it, expect } from 'vitest'
import {
  computeRubricScore,
  criterionMax,
  levelForRatio,
  rubricToText,
  sanitizeSelection,
  validatePeerConfig,
  validateRubricCriteria,
  DEFAULT_PEER_CONFIG,
  type RubricCriterion,
} from '../../../shared/rubric'

const lv = (id: string, poin: number, label = id) => ({ id, label, deskripsi: '', poin })

const CRITERIA: RubricCriterion[] = [
  { id: 'k1', nama: 'Ketepatan', bobot: 50, levels: [lv('k1a', 4), lv('k1b', 3), lv('k1c', 2), lv('k1d', 1)] },
  { id: 'k2', nama: 'Kerapian', bobot: 30, levels: [lv('k2a', 4), lv('k2b', 2), lv('k2c', 0)] },
  { id: 'k3', nama: 'Penjelasan', bobot: 20, levels: [lv('k3a', 10), lv('k3b', 5)] },
]

describe('computeRubricScore', () => {
  it('scores 100 when every criterion is at its top level', () => {
    const s = computeRubricScore(CRITERIA, { k1: 'k1a', k2: 'k2a', k3: 'k3a' })
    expect(s).toMatchObject({ total: 100, exact: 100, complete: true })
  })

  it('weights each criterion by poin / max poin', () => {
    // 50·3/4 + 30·2/4 + 20·5/10 = 37.5 + 15 + 10 = 62.5
    const s = computeRubricScore(CRITERIA, { k1: 'k1b', k2: 'k2b', k3: 'k3b' })
    expect(s.exact).toBe(62.5)
    expect(s.total).toBe(63)
    expect(s.breakdown.map((b) => b.kontribusi)).toEqual([37.5, 15, 10])
    expect(s.breakdown[0]).toMatchObject({ criterion_id: 'k1', level_id: 'k1b', label: 'k1b', poin: 3, max: 4 })
  })

  it('a zero-point level contributes nothing', () => {
    const s = computeRubricScore(CRITERIA, { k1: 'k1a', k2: 'k2c', k3: 'k3a' })
    expect(s.total).toBe(70)
  })

  it('marks missing or unknown selections as incomplete and counts them as 0', () => {
    const s = computeRubricScore(CRITERIA, { k1: 'k1a', k2: 'nope' })
    expect(s.complete).toBe(false)
    expect(s.total).toBe(50)
    expect(s.breakdown[1].level_id).toBeNull()
    expect(computeRubricScore(CRITERIA, null).total).toBe(0)
    expect(computeRubricScore([], {}).complete).toBe(false)
  })

  it('normalises weights that do not total 100', () => {
    const half = CRITERIA.map((c) => ({ ...c, bobot: c.bobot / 2 }))
    expect(computeRubricScore(half, { k1: 'k1a', k2: 'k2a', k3: 'k3a' }).total).toBe(100)
  })
})

describe('validateRubricCriteria', () => {
  it('accepts a valid rubric', () => {
    expect(validateRubricCriteria(CRITERIA)).toBeNull()
  })

  it('requires weights to total 100', () => {
    const bad = CRITERIA.map((c, i) => (i === 0 ? { ...c, bobot: 40 } : c))
    expect(validateRubricCriteria(bad)).toContain('90')
  })

  it('rejects empty names, too few levels, negative points and all-zero criteria', () => {
    expect(validateRubricCriteria([])).toContain('minimal')
    expect(validateRubricCriteria([{ ...CRITERIA[0], nama: ' ', bobot: 100 }])).toContain('wajib')
    expect(validateRubricCriteria([{ ...CRITERIA[0], bobot: 100, levels: [lv('x', 1)] }])).toContain('minimal punya 2 level')
    expect(validateRubricCriteria([{ ...CRITERIA[0], bobot: 100, levels: [lv('x', -1), lv('y', 2)] }])).toContain('Poin')
    expect(validateRubricCriteria([{ ...CRITERIA[0], bobot: 100, levels: [lv('x', 0), lv('y', 0)] }])).toContain('poin > 0')
    expect(validateRubricCriteria([{ ...CRITERIA[0], bobot: 100.5 }])).toContain('Bobot')
  })

  it('rejects duplicate ids', () => {
    expect(validateRubricCriteria([{ ...CRITERIA[0], bobot: 50 }, { ...CRITERIA[1], id: 'k1', bobot: 50 }])).toContain('ID kriteria')
    expect(validateRubricCriteria([{ ...CRITERIA[0], bobot: 100, levels: [lv('x', 1), lv('x', 2)] }])).toContain('ID level')
  })
})

describe('helpers', () => {
  it('criterionMax / levelForRatio pick the closest level (ties → lower)', () => {
    expect(criterionMax(CRITERIA[0])).toBe(4)
    expect(levelForRatio(CRITERIA[0], 1).id).toBe('k1a')
    expect(levelForRatio(CRITERIA[0], 0).id).toBe('k1d')
    expect(levelForRatio(CRITERIA[0], 0.62).id).toBe('k1c') // 0.5 is closer than 0.75
    expect(levelForRatio(CRITERIA[0], 0.625).id).toBe('k1c') // tie between 0.5 and 0.75
  })

  it('sanitizeSelection drops unknown criteria and levels', () => {
    expect(sanitizeSelection(CRITERIA, { k1: 'k1a', k2: 'k1a', zz: 'k3a' })).toEqual({ k1: 'k1a' })
  })

  it('rubricToText lists criteria with weights and levels', () => {
    const text = rubricToText(CRITERIA)
    expect(text).toContain('1. Ketepatan (bobot 50%)')
    expect(text).toContain('k3a (10 poin)')
  })

  it('validatePeerConfig checks reviewers, weight and deadline only when enabled', () => {
    expect(validatePeerConfig(DEFAULT_PEER_CONFIG)).toBeNull()
    const on = { ...DEFAULT_PEER_CONFIG, enabled: true, deadline: '2026-12-01T00:00:00Z' }
    expect(validatePeerConfig(on)).toBeNull()
    expect(validatePeerConfig({ ...on, weight: 31 })).toContain('0–30')
    expect(validatePeerConfig({ ...on, reviewers_per_submission: 0 })).toContain('1–5')
    expect(validatePeerConfig({ ...on, deadline: null })).toContain('Tenggat')
  })
})
