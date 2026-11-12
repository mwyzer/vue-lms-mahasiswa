/**
 * Risk score — pure functions for the "mahasiswa berisiko" dashboard.
 *
 * A student's risk in one course is a weighted mix of six signals, each turned
 * into a factor between 0 (no concern) and 1 (maximum concern):
 *
 *   attendance — % pertemuan dihadiri vs. batas minimal (bawaan 75%)
 *   missing    — tugas yang lewat tenggat dan tidak dikumpulkan
 *   late       — tugas yang dikumpulkan setelah tenggat
 *   trend      — penurunan nilai (paruh awal vs. paruh akhir nilai kronologis)
 *   lowScore   — rata-rata nilai di bawah batas lulus
 *   inactivity — hari sejak aktivitas terakhir
 *
 * Signals without data (e.g. no meetings recorded yet) are skipped and the
 * remaining weights re-normalised, like the gradebook does. `coverage` tells
 * how much of the total weight had data, so the UI can flag thin evidence.
 *
 * Everything here is framework-free so it runs in the browser, in the cron
 * endpoint (server) and in Vitest.
 */

// ── Types ────────────────────────────────────────────────

export type RiskFactorKey = 'attendance' | 'missing' | 'late' | 'trend' | 'lowScore' | 'inactivity'
export type RiskLevel = 'rendah' | 'sedang' | 'tinggi'

export type RiskWeights = Record<RiskFactorKey, number>

export interface RiskThresholds {
  /** Minimum attendance rate (0–1). At or below this the attendance factor is 1. */
  minAttendance: number
  /** Score drop (points) at which the trend factor reaches 1. */
  trendDropFull: number
  /** Smallest drop (points) that is reported as a reason. */
  trendDropMin: number
  /** Passing score (0–100). */
  passScore: number
  /** Days without activity that are reported; the factor reaches 1 at 2× this. */
  inactiveDays: number
  /** Score (0–100) from which the level becomes "sedang". */
  mediumAt: number
  /** Score (0–100) from which the level becomes "tinggi". */
  highAt: number
}

export interface RiskSignals {
  attendance: { total: number; hadir: number; izin: number; sakit: number; alpha: number }
  /** `due` = assignments whose deadline has passed. `submitted` counts all submissions. */
  assignments: { due: number; missing: number; submitted: number; late: number }
  /** Graded items (assignments + quizzes), 0–100, any order (sorted internally). */
  scores: { value: number; at: string; label?: string }[]
  /** ISO timestamp of the latest activity, null when none was recorded. */
  lastActivityAt: string | null
}

export interface RiskReason {
  key: RiskFactorKey
  text: string
  severity: 'warning' | 'danger'
  /** Points (0–100) this factor added to the score. */
  contribution: number
}

export interface RiskFactor {
  key: RiskFactorKey
  /** 0–1, or null when the signal had no data. */
  value: number | null
  weight: number
  contribution: number
}

export interface RiskResult {
  score: number
  level: RiskLevel
  reasons: RiskReason[]
  factors: RiskFactor[]
  /** Share (0–1) of the total weight whose signal had data. */
  coverage: number
}

// ── Config ───────────────────────────────────────────────

export const RISK_FACTORS: RiskFactorKey[] = ['attendance', 'missing', 'late', 'trend', 'lowScore', 'inactivity']

export const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  attendance: 'Kehadiran',
  missing: 'Tugas tidak dikumpulkan',
  late: 'Tugas terlambat',
  trend: 'Tren nilai turun',
  lowScore: 'Nilai rendah',
  inactivity: 'Tidak aktif',
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  attendance: 25,
  missing: 25,
  late: 10,
  trend: 15,
  lowScore: 15,
  inactivity: 10,
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  minAttendance: 0.75,
  trendDropFull: 20,
  trendDropMin: 5,
  passScore: 60,
  inactiveDays: 14,
  mediumAt: 35,
  highAt: 60,
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
}

const DAY_MS = 24 * 60 * 60 * 1000

// ── Small helpers ────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/** Returns sanitised weights: non-negative finite numbers, unknown keys dropped. */
export function normalizeRiskWeights(w: Partial<RiskWeights> | null | undefined): RiskWeights {
  const out = { ...DEFAULT_RISK_WEIGHTS }
  if (!w) return out
  for (const k of RISK_FACTORS) {
    const v = Number(w[k])
    if (w[k] !== undefined && Number.isFinite(v)) out[k] = Math.max(0, Math.min(100, v))
  }
  return out
}

/** Error message, or null when the weights can be used. */
export function validateRiskWeights(w: RiskWeights): string | null {
  for (const k of RISK_FACTORS) {
    const v = w[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
      return `Bobot ${RISK_FACTOR_LABELS[k]} harus angka 0–100.`
    }
  }
  if (RISK_FACTORS.every((k) => w[k] === 0)) return 'Minimal satu bobot harus lebih dari 0.'
  return null
}

export function riskLevelFor(score: number, t: Pick<RiskThresholds, 'mediumAt' | 'highAt'> = DEFAULT_RISK_THRESHOLDS): RiskLevel {
  if (score >= t.highAt) return 'tinggi'
  if (score >= t.mediumAt) return 'sedang'
  return 'rendah'
}

// ── Factors ──────────────────────────────────────────────

/**
 * Attendance rate where izin/sakit count as half a presence (excused, but the
 * student still missed the material). Null when no meeting was recorded.
 */
export function attendanceRate(a: RiskSignals['attendance']): number | null {
  if (!a || a.total <= 0) return null
  return clamp01((a.hadir + 0.5 * (a.izin + a.sakit)) / a.total)
}

/** Chronological early-half vs late-half mean. Null with fewer than 2 scores. */
export function scoreTrend(scores: RiskSignals['scores']): { early: number; late: number; drop: number } | null {
  const sorted = scores
    .filter((s) => Number.isFinite(s.value))
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  if (sorted.length < 2) return null
  const half = Math.floor(sorted.length / 2)
  const early = mean(sorted.slice(0, half).map((s) => s.value))
  const late = mean(sorted.slice(sorted.length - half).map((s) => s.value))
  return { early: round1(early), late: round1(late), drop: round1(early - late) }
}

export function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / DAY_MS))
}

interface FactorEval {
  value: number | null
  text?: string
  severity?: 'warning' | 'danger'
}

function evalFactors(s: RiskSignals, t: RiskThresholds, now: number): Record<RiskFactorKey, FactorEval> {
  const out = {} as Record<RiskFactorKey, FactorEval>

  // attendance
  const rate = attendanceRate(s.attendance)
  if (rate === null) out.attendance = { value: null }
  else {
    const gap = 1 - t.minAttendance
    const value = gap <= 0 ? (rate < 1 ? 1 : 0) : clamp01((1 - rate) / gap)
    const hadir = s.attendance.hadir
    const extra = s.attendance.alpha > 0 ? `, ${s.attendance.alpha}× alpa` : ''
    out.attendance = {
      value,
      text: rate < t.minAttendance
        ? `Kehadiran ${pct(rate)} (hadir ${hadir} dari ${s.attendance.total} pertemuan${extra}), di bawah batas ${pct(t.minAttendance)}`
        : `Kehadiran ${pct(rate)} (hadir ${hadir} dari ${s.attendance.total} pertemuan${extra})`,
      severity: rate < t.minAttendance ? 'danger' : 'warning',
    }
  }

  // missing
  const { due, missing, submitted, late } = s.assignments
  if (due <= 0) out.missing = { value: null }
  else {
    const value = clamp01(missing / due)
    out.missing = {
      value,
      text: `${missing} dari ${due} tugas yang sudah lewat tenggat tidak dikumpulkan`,
      severity: value >= 0.5 ? 'danger' : 'warning',
    }
  }

  // late
  if (submitted <= 0) out.late = { value: null }
  else {
    const value = clamp01(late / submitted)
    out.late = {
      value,
      text: `${late} dari ${submitted} tugas dikumpulkan setelah tenggat`,
      severity: value >= 0.5 ? 'danger' : 'warning',
    }
  }

  // trend
  const trend = scoreTrend(s.scores)
  if (!trend) out.trend = { value: null }
  else {
    const value = trend.drop >= t.trendDropMin ? clamp01(trend.drop / t.trendDropFull) : 0
    out.trend = {
      value,
      text: `Nilai turun ${trend.drop} poin (rata-rata awal ${trend.early} → terbaru ${trend.late})`,
      severity: trend.drop >= t.trendDropFull / 2 ? 'danger' : 'warning',
    }
  }

  // lowScore
  const values = s.scores.map((x) => x.value).filter((v) => Number.isFinite(v))
  if (values.length === 0) out.lowScore = { value: null }
  else {
    const avg = round1(mean(values))
    // 0 at the passing score, 1 at half of it.
    const value = t.passScore <= 0 ? 0 : clamp01((t.passScore - avg) / (t.passScore / 2))
    out.lowScore = {
      value,
      text: `Rata-rata nilai ${avg}, di bawah batas lulus ${t.passScore}`,
      severity: avg < t.passScore / 2 ? 'danger' : 'warning',
    }
  }

  // inactivity
  const days = daysSince(s.lastActivityAt, now)
  const expectsActivity = s.attendance.total > 0 || due > 0
  if (days === null) {
    out.inactivity = expectsActivity
      ? { value: 1, text: 'Belum ada aktivitas tercatat (tugas, kuis, materi, atau presensi)', severity: 'danger' }
      : { value: null }
  } else {
    const value = t.inactiveDays <= 0 ? 0 : days < t.inactiveDays ? 0 : clamp01(days / (2 * t.inactiveDays))
    out.inactivity = {
      value,
      text: `Tidak ada aktivitas selama ${days} hari`,
      severity: days >= 2 * t.inactiveDays ? 'danger' : 'warning',
    }
  }

  return out
}

// ── Main entry ───────────────────────────────────────────

/**
 * Compute a 0–100 risk score, level and human-readable reasons.
 * Reasons only include factors that actually added to the score, sorted by
 * contribution (largest first).
 */
export function computeRiskScore(
  signals: RiskSignals,
  options: { weights?: Partial<RiskWeights>; thresholds?: Partial<RiskThresholds>; now?: number } = {},
): RiskResult {
  const weights = normalizeRiskWeights(options.weights)
  const t: RiskThresholds = { ...DEFAULT_RISK_THRESHOLDS, ...(options.thresholds || {}) }
  const now = options.now ?? Date.now()
  const evals = evalFactors(signals, t, now)

  const totalWeight = RISK_FACTORS.reduce((sum, k) => sum + weights[k], 0)
  const coveredWeight = RISK_FACTORS.reduce((sum, k) => sum + (evals[k].value !== null ? weights[k] : 0), 0)

  const factors: RiskFactor[] = RISK_FACTORS.map((k) => {
    const value = evals[k].value
    const contribution = value === null || coveredWeight === 0 ? 0 : (weights[k] * value * 100) / coveredWeight
    return { key: k, value: value === null ? null : round1(value * 100) / 100, weight: weights[k], contribution: round1(contribution) }
  })

  const score = Math.round(Math.min(100, factors.reduce((sum, f) => sum + f.contribution, 0)))

  const reasons: RiskReason[] = factors
    .filter((f) => f.contribution > 0 && evals[f.key].text)
    .sort((a, b) => b.contribution - a.contribution)
    .map((f) => ({
      key: f.key,
      text: evals[f.key].text as string,
      severity: evals[f.key].severity ?? 'warning',
      contribution: f.contribution,
    }))

  return {
    score,
    level: riskLevelFor(score, t),
    reasons,
    factors,
    coverage: totalWeight > 0 ? round1(coveredWeight / totalWeight * 100) / 100 : 0,
  }
}

// ── Signal extraction from raw rows ──────────────────────

/** Minimal row shapes (compatible with ~/types/database). */
export interface RiskAssignmentRow { id: string; course_id: string; tenggat_waktu?: string | null; judul?: string }
export interface RiskSubmissionRow { assignment_id: string; student_id: string; submitted_at: string; nilai?: number | null; graded_at?: string | null }
export interface RiskAttendanceRow { course_id: string; student_id: string; status: 'hadir' | 'izin' | 'sakit' | 'alpha'; tanggal: string }
export interface RiskQuizRow { id: string; course_id: string; judul?: string }
export interface RiskAttemptRow { quiz_id: string; student_id: string; percentage: number; submitted_at: string }
export interface RiskLessonProgressRow { student_id: string; lesson_id: string; completed?: boolean; completed_at?: string | null }

export interface RiskSource {
  assignments: RiskAssignmentRow[]
  submissions: RiskSubmissionRow[]
  attendance: RiskAttendanceRow[]
  quizzes: RiskQuizRow[]
  attempts: RiskAttemptRow[]
  /** Lesson progress of the course's lessons only (optional). */
  lessonProgress?: RiskLessonProgressRow[]
}

function latest(a: string | null, b: string | null | undefined): string | null {
  if (!b) return a
  const tb = new Date(b).getTime()
  if (Number.isNaN(tb)) return a
  if (!a) return b
  return tb > new Date(a).getTime() ? b : a
}

/**
 * Derive the risk signals of one student in one course from raw rows.
 * Rows of other courses/students are ignored, so callers may pass whole tables.
 */
export function collectRiskSignals(courseId: string, studentId: string, src: RiskSource, now: number = Date.now()): RiskSignals {
  const assignments = src.assignments.filter((a) => a.course_id === courseId)
  const assignmentIds = new Set(assignments.map((a) => a.id))
  const subs = src.submissions.filter((s) => s.student_id === studentId && assignmentIds.has(s.assignment_id))

  let due = 0
  let missing = 0
  let late = 0
  const scores: RiskSignals['scores'] = []
  let last: string | null = null

  for (const a of assignments) {
    const sub = subs.find((s) => s.assignment_id === a.id)
    const deadline = a.tenggat_waktu ? new Date(a.tenggat_waktu).getTime() : NaN
    const pastDue = Number.isFinite(deadline) && deadline < now
    if (pastDue) {
      due++
      if (!sub) missing++
    }
    if (sub) {
      if (Number.isFinite(deadline) && new Date(sub.submitted_at).getTime() > deadline) late++
      if (typeof sub.nilai === 'number') {
        scores.push({ value: sub.nilai, at: a.tenggat_waktu || sub.submitted_at, label: a.judul })
      }
      last = latest(last, sub.submitted_at)
    }
  }

  const quizzes = src.quizzes.filter((q) => q.course_id === courseId)
  for (const q of quizzes) {
    const mine = src.attempts.filter((x) => x.quiz_id === q.id && x.student_id === studentId)
    if (mine.length === 0) continue
    const best = mine.reduce((b, x) => (Number(x.percentage) > Number(b.percentage) ? x : b))
    const first = mine.reduce((f, x) => (new Date(x.submitted_at) < new Date(f.submitted_at) ? x : f))
    scores.push({ value: Number(best.percentage) || 0, at: first.submitted_at, label: q.judul })
    for (const x of mine) last = latest(last, x.submitted_at)
  }

  const att = { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 }
  for (const r of src.attendance) {
    if (r.course_id !== courseId || r.student_id !== studentId) continue
    att.total++
    att[r.status]++
    if (r.status === 'hadir') last = latest(last, r.tanggal)
  }

  for (const p of src.lessonProgress || []) {
    if (p.student_id === studentId && p.completed) last = latest(last, p.completed_at ?? null)
  }

  return {
    attendance: att,
    assignments: { due, missing, submitted: subs.length, late },
    scores,
    lastActivityAt: last,
  }
}

/**
 * Latest timestamp found in a data set. Used as the reference "now" in demo
 * mode, where the seed data is from a past semester.
 */
export function latestActivityTimestamp(src: RiskSource): number | null {
  let last: string | null = null
  for (const s of src.submissions) last = latest(last, s.submitted_at)
  for (const a of src.attempts) last = latest(last, a.submitted_at)
  for (const r of src.attendance) last = latest(last, r.tanggal)
  return last ? new Date(last).getTime() : null
}

/** Sort helper: highest score first, then by name. */
export function compareRisk<T extends { risk: { score: number }; nama?: string }>(a: T, b: T): number {
  return b.risk.score - a.risk.score || (a.nama || '').localeCompare(b.nama || '', 'id')
}
