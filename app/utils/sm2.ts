/**
 * SM-2 spaced repetition — pure functions (no Pinia/Nuxt), unit-tested in
 * app/test/utils/sm2.test.ts.
 *
 * Algorithm (SuperMemo 2, Wozniak 1987, as commonly implemented):
 *   quality q ∈ 0..5
 *   q ≥ 3 (correct):  repetitions 0 → interval 1 day, 1 → 6 days, else round(interval × EF); repetitions + 1
 *   q < 3 (lapse):    repetitions = 0, interval = 1 day, lapses + 1
 *   EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02)), floor 1.3 (applied for every review)
 *   dueDate = today + interval (local calendar date, 'YYYY-MM-DD')
 *
 * Buttons on the review page map to qualities with {@link SM2_BUTTONS}
 * (Lagi=1, Sulit=3, Bagus=4, Mudah=5); the advanced mode exposes 0–5 directly.
 */

export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5

/** SM-2 scheduling fields of one card. */
export interface Sm2State {
  ease_factor: number
  interval_days: number
  repetitions: number
  /** Local calendar date 'YYYY-MM-DD' on which the card is due. */
  due_date: string
  lapses: number
}

export const SM2_DEFAULT_EASE = 2.5
export const SM2_MIN_EASE = 1.3
/** Interval cap so a runaway EF can't schedule a card decades ahead. */
export const SM2_MAX_INTERVAL_DAYS = 3650
/** Cards with an interval of at least this many days count as "matang" (mature). */
export const SM2_MATURE_DAYS = 21

export const SM2_QUALITY_LABELS: Record<Sm2Quality, string> = {
  0: 'Lupa total',
  1: 'Salah, baru ingat setelah lihat jawaban',
  2: 'Salah, tapi jawabannya terasa familiar',
  3: 'Benar dengan susah payah',
  4: 'Benar setelah ragu sebentar',
  5: 'Benar dan lancar',
}

/** Simple 4-button mode (Anki-like) → SM-2 quality. */
export const SM2_BUTTONS: ReadonlyArray<{ key: 'lagi' | 'sulit' | 'bagus' | 'mudah'; label: string; quality: Sm2Quality }> = [
  { key: 'lagi', label: 'Lagi', quality: 1 },
  { key: 'sulit', label: 'Sulit', quality: 3 },
  { key: 'bagus', label: 'Bagus', quality: 4 },
  { key: 'mudah', label: 'Mudah', quality: 5 },
]

/** True for an integer quality in 0..5. */
export function isSm2Quality(q: unknown): q is Sm2Quality {
  return typeof q === 'number' && Number.isInteger(q) && q >= 0 && q <= 5
}

// ── Local calendar dates ───────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date of `d` as 'YYYY-MM-DD' (not UTC — "today" is the user's day). */
export function toLocalDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Add `days` calendar days to a 'YYYY-MM-DD' key (DST-safe: computed at local noon). */
export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0)
  date.setDate(date.getDate() + Math.round(days))
  return toLocalDateKey(date)
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'); negative when `to` is earlier. */
export function diffDateKeys(from: string, to: string): number {
  const parse = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/** Fresh scheduling state for a new card: due today. */
export function initialSm2State(today: string = toLocalDateKey()): Sm2State {
  return { ease_factor: SM2_DEFAULT_EASE, interval_days: 0, repetitions: 0, due_date: today, lapses: 0 }
}

/** Card is due when its due date is today or earlier. */
export function isDue(card: Pick<Sm2State, 'due_date'>, today: string = toLocalDateKey()): boolean {
  return card.due_date <= today
}

/** New ease factor for quality `q` (floored at {@link SM2_MIN_EASE}, rounded to 2 decimals). */
export function nextEaseFactor(ef: number, q: Sm2Quality): number {
  const base = Number.isFinite(ef) && ef > 0 ? ef : SM2_DEFAULT_EASE
  const next = base + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  return Math.round(Math.max(SM2_MIN_EASE, next) * 100) / 100
}

/**
 * Apply one review with quality `q` to `state`, reviewed on `today`.
 * Pure: returns a new state. Throws on an invalid quality.
 */
export function reviewSm2(state: Sm2State, q: number, today: string = toLocalDateKey()): Sm2State {
  if (!isSm2Quality(q)) throw new RangeError(`Kualitas SM-2 harus bilangan bulat 0–5 (diterima: ${q})`)
  const ef = Number.isFinite(state.ease_factor) && state.ease_factor >= SM2_MIN_EASE ? state.ease_factor : SM2_DEFAULT_EASE
  const reps = Math.max(0, Math.floor(state.repetitions || 0))
  const prevInterval = Math.max(0, state.interval_days || 0)
  let repetitions: number
  let interval: number
  let lapses = Math.max(0, Math.floor(state.lapses || 0))

  if (q >= 3) {
    if (reps === 0) interval = 1
    else if (reps === 1) interval = 6
    else interval = Math.round(Math.max(1, prevInterval) * ef)
    repetitions = reps + 1
  } else {
    repetitions = 0
    interval = 1
    lapses += 1
  }
  interval = Math.min(SM2_MAX_INTERVAL_DAYS, Math.max(1, interval))

  return {
    ease_factor: nextEaseFactor(ef, q),
    interval_days: interval,
    repetitions,
    due_date: addDaysToDateKey(today, interval),
    lapses,
  }
}

/** Preview of the next interval (days) per button, for labels like "Bagus · 6 h". */
export function previewIntervals(state: Sm2State, today: string = toLocalDateKey()): Record<Sm2Quality, number> {
  const out = {} as Record<Sm2Quality, number>
  for (const q of [0, 1, 2, 3, 4, 5] as Sm2Quality[]) out[q] = reviewSm2(state, q, today).interval_days
  return out
}

/** Human-friendly interval: "1 hari", "2 minggu", "3 bulan", "1,5 tahun". */
export function formatInterval(days: number): string {
  if (days < 1) return 'hari ini'
  if (days < 14) return `${days} hari`
  if (days < 60) return `${Math.round(days / 7)} minggu`
  if (days < 365) return `${Math.round(days / 30)} bulan`
  return `${(Math.round((days / 365) * 10) / 10).toString().replace('.', ',')} tahun`
}
