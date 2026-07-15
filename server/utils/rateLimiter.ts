/**
 * Rate Limiter — In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per key (userId or IP) and enforces
 * configurable request-per-minute limits.
 *
 * Limits (configurable via options):
 *   - Per-user:  20 requests / minute (default)
 *   - Global:   100 requests / minute
 *
 * Expired entries are cleaned up every 60 seconds.
 */

interface RateLimitEntry {
  timestamps: number[]
}

export interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // epoch ms
}

const stores = new Map<string, RateLimitEntry>()

// Auto-cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of stores.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000)
    if (entry.timestamps.length === 0) {
      stores.delete(key)
    }
  }
}, 60_000)

/**
 * Check if a request is within the rate limit for the given key.
 *
 * @param key   Unique identifier (e.g. `user:${userId}` or `global:ai`)
 * @param opts  Rate limit options (default: 20 req / 60s window)
 * @returns     Result with allowed flag, remaining quota, and reset time
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions = { windowMs: 60_000, maxRequests: 20 }
): RateLimitResult {
  const now = Date.now()

  let entry = stores.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    stores.set(key, entry)
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < opts.windowMs)

  if (entry.timestamps.length >= opts.maxRequests) {
    const oldest = entry.timestamps[0]
    return { allowed: false, remaining: 0, resetAt: oldest + opts.windowMs }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: opts.maxRequests - entry.timestamps.length,
    resetAt: now + opts.windowMs,
  }
}
