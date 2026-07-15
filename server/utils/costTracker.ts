/**
 * Cost Tracker — Tracks daily AI API token usage in memory.
 *
 * Data resets at midnight (server time) and is NOT persisted
 * across server restarts. Useful for monitoring and preventing
 * unexpected OpenAI API costs.
 */

interface DailyUsage {
  date: string // YYYY-MM-DD
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestCount: number
}

const MAX_DAILY_TOKENS = 100_000
const store = new Map<string, DailyUsage>()

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getToday(): DailyUsage {
  const key = todayKey()
  if (!store.has(key)) {
    store.set(key, { date: key, promptTokens: 0, completionTokens: 0, totalTokens: 0, requestCount: 0 })
  }
  return store.get(key)!
}

/**
 * Record token usage for a single AI request.
 */
export function recordUsage(promptTokens: number, completionTokens: number): DailyUsage {
  const today = getToday()
  today.promptTokens += promptTokens
  today.completionTokens += completionTokens
  today.totalTokens += promptTokens + completionTokens
  today.requestCount++
  return { ...today }
}

/**
 * Check if today's usage has exceeded the daily token budget.
 */
export function isOverBudget(): boolean {
  return getToday().totalTokens >= MAX_DAILY_TOKENS
}

/**
 * Get today's usage summary (immutable snapshot).
 */
export function getUsage(): DailyUsage {
  return { ...getToday() }
}

/**
 * Get remaining token budget for today.
 */
export function remainingBudget(): number {
  return Math.max(0, MAX_DAILY_TOKENS - getToday().totalTokens)
}
