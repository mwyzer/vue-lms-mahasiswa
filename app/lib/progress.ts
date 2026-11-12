/**
 * Progress & gamification — pure functions (no Pinia, no Nuxt globals).
 *
 * - dayKey / computeStreak      — daily learning streak from activity timestamps
 * - computeStats                — counters that badge rules read
 * - evaluateBadges / badgeProgress — which badges are (newly) earned
 * - activityHeatmap             — per-day activity counts for the last N days
 *
 * A "day" is a calendar day in a fixed UTC offset (default WIB, UTC+7), so the
 * streak does not depend on the browser's time zone and is stable in tests.
 */
import type { BadgeDefinition } from '~/data/badges'

export type ActivityType =
  | 'lesson_completed'
  | 'quiz_submitted'
  | 'assignment_submitted'
  | 'flashcard_reviewed'
  | 'forum_post'

export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'lesson_completed',
  'quiz_submitted',
  'assignment_submitted',
  'flashcard_reviewed',
  'forum_post',
]

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  lesson_completed: 'Materi selesai',
  quiz_submitted: 'Kuis dikerjakan',
  assignment_submitted: 'Tugas dikumpulkan',
  flashcard_reviewed: 'Review flashcard',
  forum_post: 'Diskusi forum',
}

export interface Activity {
  id: string
  user_id: string
  tipe: ActivityType
  /** Id of the lesson/quiz/assignment/thread/flashcard the activity is about. */
  ref_id: string | null
  course_id: string | null
  /** e.g. `{ percentage: 100 }` for quizzes, `{ count: 12 }` for a flashcard session. */
  meta?: Record<string, unknown> | null
  created_at: string
}

export interface ActivityStats {
  totalActivities: number
  activeDays: number
  currentStreak: number
  longestStreak: number
  lessonsCompleted: number
  quizzesSubmitted: number
  perfectQuizzes: number
  assignmentsSubmitted: number
  forumPosts: number
  flashcardReviews: number
  coursesCompleted: number
}

/** WIB (UTC+7) in minutes. */
export const DEFAULT_TZ_OFFSET_MIN = 7 * 60

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` of a timestamp in a fixed UTC offset. Returns null for invalid input. */
export function dayKey(input: string | number | Date, tzOffsetMin = DEFAULT_TZ_OFFSET_MIN): string | null {
  const t = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : Date.parse(input)
  if (!Number.isFinite(t)) return null
  return new Date(t + tzOffsetMin * 60_000).toISOString().slice(0, 10)
}

/** Day number (days since epoch) of a `YYYY-MM-DD` key. */
function dayIndex(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS)
}

export interface StreakResult {
  /** Consecutive active days ending today — or yesterday, when today has no activity yet. */
  current: number
  longest: number
  activeToday: boolean
  lastActiveDay: string | null
  activeDays: number
}

/**
 * Daily streak from activity timestamps.
 * The current streak stays alive until the end of the day after the last
 * active day (so it is not "lost" in the morning before studying).
 */
export function computeStreak(
  timestamps: Array<string | number | Date>,
  now: number | Date = Date.now(),
  tzOffsetMin = DEFAULT_TZ_OFFSET_MIN,
): StreakResult {
  const days = new Set<number>()
  for (const ts of timestamps) {
    const k = dayKey(ts, tzOffsetMin)
    if (k) days.add(dayIndex(k))
  }
  const todayKey = dayKey(now, tzOffsetMin)!
  const today = dayIndex(todayKey)
  // Activities "in the future" (clock skew) count as today.
  const sorted = [...days].map((d) => Math.min(d, today)).sort((a, b) => a - b)
  const unique = [...new Set(sorted)]

  let longest = 0
  let run = 0
  let prev: number | null = null
  for (const d of unique) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }

  const set = new Set(unique)
  const activeToday = set.has(today)
  let current = 0
  let cursor = activeToday ? today : today - 1
  while (set.has(cursor)) {
    current++
    cursor--
  }

  const last = unique.length ? unique[unique.length - 1]! : null
  return {
    current,
    longest,
    activeToday,
    lastActiveDay: last === null ? null : new Date(last * DAY_MS).toISOString().slice(0, 10),
    activeDays: unique.length,
  }
}

/**
 * Counters read by badge rules. Duplicate activities (same type + ref) count
 * once, except flashcard reviews, which add `meta.count` (default 1).
 */
export function computeStats(
  activities: Activity[],
  opts: { coursesCompleted?: number; now?: number | Date; tzOffsetMin?: number } = {},
): ActivityStats {
  const seen = new Set<string>()
  const unique: Activity[] = []
  for (const a of activities) {
    if (!a || !ACTIVITY_TYPES.includes(a.tipe)) continue
    const key = a.tipe === 'flashcard_reviewed' || !a.ref_id ? `${a.tipe}:${a.id}` : `${a.tipe}:${a.ref_id}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(a)
  }

  const streak = computeStreak(unique.map((a) => a.created_at), opts.now ?? Date.now(), opts.tzOffsetMin)
  const count = (t: ActivityType) => unique.filter((a) => a.tipe === t).length
  const flashcardReviews = unique
    .filter((a) => a.tipe === 'flashcard_reviewed')
    .reduce((sum, a) => {
      const n = Number(a.meta?.count)
      return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 1)
    }, 0)

  return {
    totalActivities: unique.length,
    activeDays: streak.activeDays,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    lessonsCompleted: count('lesson_completed'),
    quizzesSubmitted: count('quiz_submitted'),
    // A quiz counts as perfect if *any* attempt at it scored 100 (retakes included).
    perfectQuizzes: new Set(
      activities
        .filter((a) => a?.tipe === 'quiz_submitted' && Number(a.meta?.percentage) >= 100)
        .map((a) => a.ref_id ?? a.id),
    ).size,
    assignmentsSubmitted: count('assignment_submitted'),
    forumPosts: count('forum_post'),
    flashcardReviews,
    coursesCompleted: Math.max(0, Math.floor(opts.coursesCompleted ?? 0)),
  }
}

/** Badges whose rule is satisfied by `stats` (regardless of whether already earned). */
export function qualifyingBadges(defs: readonly BadgeDefinition[], stats: ActivityStats): BadgeDefinition[] {
  return defs.filter((b) => Number(stats[b.metric] ?? 0) >= b.min)
}

/**
 * Newly earned badges: satisfied now and not in `earnedIds`.
 * Earned badges are never revoked, so this only ever adds.
 */
export function evaluateBadges(
  defs: readonly BadgeDefinition[],
  stats: ActivityStats,
  earnedIds: Iterable<string> = [],
): BadgeDefinition[] {
  const earned = new Set(earnedIds)
  return qualifyingBadges(defs, stats).filter((b) => !earned.has(b.id))
}

/** Progress towards one badge, for progress bars. */
export function badgeProgress(def: BadgeDefinition, stats: ActivityStats): { value: number; target: number; percent: number } {
  const value = Math.max(0, Number(stats[def.metric] ?? 0))
  const target = Math.max(1, def.min)
  return { value: Math.min(value, target), target, percent: Math.min(100, Math.round((value / target) * 100)) }
}

/** Activity count per day for the last `days` days (oldest first), for a heatmap. */
export function activityHeatmap(
  activities: Pick<Activity, 'created_at'>[],
  days = 28,
  now: number | Date = Date.now(),
  tzOffsetMin = DEFAULT_TZ_OFFSET_MIN,
): { day: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const a of activities) {
    const k = dayKey(a.created_at, tzOffsetMin)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const today = dayIndex(dayKey(now, tzOffsetMin)!)
  const out: { day: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date((today - i) * DAY_MS).toISOString().slice(0, 10)
    out.push({ day: k, count: counts.get(k) ?? 0 })
  }
  return out
}
