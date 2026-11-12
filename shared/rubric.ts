/**
 * Rubric — pure, dependency-free logic shared by the app (stores/components)
 * and the server (AI grade draft). No Nuxt/Nitro globals: unit tested directly.
 *
 * Model:
 *   Rubric ─┬─ Criterion (nama, bobot %)  — bobot of all criteria totals 100
 *           └─ Level (label, deskripsi, poin) — 2..6 levels per criterion
 *
 * Score of one criterion = bobot × (poin of the chosen level / max poin of the
 * criterion). Total score (0–100) = sum over criteria. Rounded to an integer
 * because `submissions.nilai` is an INTEGER column.
 */

export interface RubricLevel {
  id: string
  label: string
  deskripsi?: string | null
  poin: number
}

export interface RubricCriterion {
  id: string
  nama: string
  deskripsi?: string | null
  /** Weight in percent (integer 1–100). All criteria of a rubric total 100. */
  bobot: number
  levels: RubricLevel[]
}

export interface PeerReviewConfig {
  enabled: boolean
  /** Reviewers per submission (1–5). */
  reviewers_per_submission: number
  /** ISO deadline for reviews. Required when enabled. */
  deadline: string | null
  /** Weight of the peer average in the final assignment score, percent 0–30. */
  weight: number
  /** When reviewers were (last) assigned. */
  assigned_at?: string | null
}

export interface Rubric {
  id: string
  assignment_id: string
  criteria: RubricCriterion[]
  peer: PeerReviewConfig
  created_at?: string
  updated_at?: string
}

/** criterion_id → level_id */
export type RubricSelection = Record<string, string>

export const RUBRIC_LIMITS = {
  criteria: 10,
  levels: 6,
  minLevels: 2,
  nama: 120,
  label: 60,
  deskripsi: 500,
  maxPoin: 1000,
  peerReviewers: 5,
  peerWeight: 30,
} as const

export const DEFAULT_PEER_CONFIG: PeerReviewConfig = {
  enabled: false,
  reviewers_per_submission: 2,
  deadline: null,
  weight: 20,
  assigned_at: null,
}

// ────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────

/** Returns an error message (Bahasa Indonesia) or null when the criteria are valid. */
export function validateRubricCriteria(criteria: RubricCriterion[]): string | null {
  if (!Array.isArray(criteria) || criteria.length === 0) return 'Rubrik minimal punya 1 kriteria.'
  if (criteria.length > RUBRIC_LIMITS.criteria) return `Rubrik maksimal ${RUBRIC_LIMITS.criteria} kriteria.`

  let total = 0
  for (const [i, c] of criteria.entries()) {
    const n = i + 1
    const nama = typeof c?.nama === 'string' ? c.nama.trim() : ''
    if (!nama) return `Nama kriteria ${n} wajib diisi.`
    if (nama.length > RUBRIC_LIMITS.nama) return `Nama kriteria ${n} terlalu panjang (maks. ${RUBRIC_LIMITS.nama} karakter).`
    if (typeof c.deskripsi === 'string' && c.deskripsi.length > RUBRIC_LIMITS.deskripsi) {
      return `Deskripsi kriteria "${nama}" terlalu panjang (maks. ${RUBRIC_LIMITS.deskripsi} karakter).`
    }
    if (!Number.isInteger(c.bobot) || c.bobot < 1 || c.bobot > 100) return `Bobot kriteria "${nama}" harus bilangan bulat 1–100.`
    total += c.bobot

    const levels = Array.isArray(c.levels) ? c.levels : []
    if (levels.length < RUBRIC_LIMITS.minLevels) return `Kriteria "${nama}" minimal punya ${RUBRIC_LIMITS.minLevels} level.`
    if (levels.length > RUBRIC_LIMITS.levels) return `Kriteria "${nama}" maksimal punya ${RUBRIC_LIMITS.levels} level.`
    for (const [j, l] of levels.entries()) {
      const label = typeof l?.label === 'string' ? l.label.trim() : ''
      if (!label) return `Label level ${j + 1} pada kriteria "${nama}" wajib diisi.`
      if (label.length > RUBRIC_LIMITS.label) return `Label level "${label}" terlalu panjang (maks. ${RUBRIC_LIMITS.label} karakter).`
      if (typeof l.deskripsi === 'string' && l.deskripsi.length > RUBRIC_LIMITS.deskripsi) {
        return `Deskriptor level "${label}" terlalu panjang (maks. ${RUBRIC_LIMITS.deskripsi} karakter).`
      }
      if (typeof l.poin !== 'number' || !Number.isFinite(l.poin) || l.poin < 0 || l.poin > RUBRIC_LIMITS.maxPoin) {
        return `Poin level "${label}" pada kriteria "${nama}" harus angka 0–${RUBRIC_LIMITS.maxPoin}.`
      }
    }
    if (criterionMax(c) <= 0) return `Kriteria "${nama}" butuh minimal satu level dengan poin > 0.`
    const ids = new Set(levels.map((l) => l.id))
    if (ids.size !== levels.length) return `ID level pada kriteria "${nama}" tidak unik.`
  }
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length) return 'ID kriteria tidak unik.'
  if (total !== 100) return `Total bobot kriteria harus 100% (sekarang ${total}%).`
  return null
}

export function validatePeerConfig(cfg: PeerReviewConfig): string | null {
  if (!cfg.enabled) return null
  const k = cfg.reviewers_per_submission
  if (!Number.isInteger(k) || k < 1 || k > RUBRIC_LIMITS.peerReviewers) {
    return `Jumlah reviewer per jawaban harus 1–${RUBRIC_LIMITS.peerReviewers}.`
  }
  if (!Number.isInteger(cfg.weight) || cfg.weight < 0 || cfg.weight > RUBRIC_LIMITS.peerWeight) {
    return `Bobot nilai peer harus bilangan bulat 0–${RUBRIC_LIMITS.peerWeight}%.`
  }
  if (!cfg.deadline || Number.isNaN(new Date(cfg.deadline).getTime())) return 'Tenggat peer review wajib diisi.'
  return null
}

// ────────────────────────────────────────────
// Scoring
// ────────────────────────────────────────────

export function criterionMax(c: Pick<RubricCriterion, 'levels'>): number {
  return c.levels.reduce((m, l) => Math.max(m, Number(l.poin) || 0), 0)
}

export interface CriterionResult {
  criterion_id: string
  nama: string
  bobot: number
  level_id: string | null
  label: string | null
  poin: number | null
  max: number
  /** Contribution to the 0–100 total (bobot × poin / max), one decimal. */
  kontribusi: number
}

export interface RubricScore {
  /** Integer 0–100 (what is stored as `submissions.nilai`). */
  total: number
  /** Unrounded total, one decimal. */
  exact: number
  /** Every criterion has a (valid) level selected. */
  complete: boolean
  breakdown: CriterionResult[]
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Score a selection. Unknown/missing selections contribute 0 and make
 * `complete` false. Weights are normalised by their sum, so a rubric whose
 * weights do not total 100 still yields a 0–100 score.
 */
export function computeRubricScore(criteria: RubricCriterion[], selection: RubricSelection | null | undefined): RubricScore {
  const sel = selection || {}
  const totalWeight = criteria.reduce((s, c) => s + (Number(c.bobot) || 0), 0)
  let exact = 0
  let complete = criteria.length > 0
  const breakdown: CriterionResult[] = criteria.map((c) => {
    const max = criterionMax(c)
    const level = c.levels.find((l) => l.id === sel[c.id]) || null
    if (!level) complete = false
    const w = totalWeight > 0 ? (Number(c.bobot) || 0) * (100 / totalWeight) : 0
    const kontribusi = level && max > 0 ? (w * Math.min(level.poin, max)) / max : 0
    exact += kontribusi
    return {
      criterion_id: c.id,
      nama: c.nama,
      bobot: c.bobot,
      level_id: level?.id ?? null,
      label: level?.label ?? null,
      poin: level?.poin ?? null,
      max,
      kontribusi: round1(kontribusi),
    }
  })
  const clamped = Math.max(0, Math.min(100, exact))
  return { total: Math.round(clamped), exact: round1(clamped), complete, breakdown }
}

/** Drop selections that do not point to an existing criterion/level. */
export function sanitizeSelection(criteria: RubricCriterion[], selection: RubricSelection | null | undefined): RubricSelection {
  const out: RubricSelection = {}
  for (const c of criteria) {
    const id = selection?.[c.id]
    if (id && c.levels.some((l) => l.id === id)) out[c.id] = id
  }
  return out
}

/** Level whose poin/max ratio is closest to `ratio` (0–1); ties go to the lower level. */
export function levelForRatio(c: RubricCriterion, ratio: number): RubricLevel {
  const max = criterionMax(c) || 1
  const r = Math.max(0, Math.min(1, ratio))
  const sorted = [...c.levels].sort((a, b) => a.poin - b.poin)
  let best = sorted[0]!
  let bestDist = Infinity
  for (const l of sorted) {
    const d = Math.abs(l.poin / max - r)
    if (d < bestDist - 1e-9) {
      best = l
      bestDist = d
    }
  }
  return best
}

/** Plain-text rendering (for prompts and exports). Levels are listed from highest to lowest poin. */
export function rubricToText(criteria: RubricCriterion[]): string {
  return criteria
    .map((c, i) => {
      const levels = [...c.levels]
        .sort((a, b) => b.poin - a.poin)
        .map((l) => `  - ${l.label} (${l.poin} poin)${l.deskripsi ? `: ${l.deskripsi}` : ''}`)
        .join('\n')
      return `${i + 1}. ${c.nama} (bobot ${c.bobot}%)${c.deskripsi ? ` — ${c.deskripsi}` : ''}\n${levels}`
    })
    .join('\n')
}

// ────────────────────────────────────────────
// Editor helpers
// ────────────────────────────────────────────

let localSeq = 0
/** Client-side id (UUID when available so it can be inserted into Supabase as-is). */
export function newRubricId(prefix = 'rb'): string {
  const c = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${(++localSeq).toString(36)}`
}

/** A sensible 4-level template for a new criterion. */
export function defaultLevels(): RubricLevel[] {
  return [
    { id: newRubricId('lv'), label: 'Sangat baik', deskripsi: '', poin: 4 },
    { id: newRubricId('lv'), label: 'Baik', deskripsi: '', poin: 3 },
    { id: newRubricId('lv'), label: 'Cukup', deskripsi: '', poin: 2 },
    { id: newRubricId('lv'), label: 'Kurang', deskripsi: '', poin: 1 },
  ]
}

export function cloneCriteria(criteria: RubricCriterion[]): RubricCriterion[] {
  return criteria.map((c) => ({ ...c, levels: c.levels.map((l) => ({ ...l })) }))
}
