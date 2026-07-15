/**
 * Session — Signed session cookie management.
 *
 * Creates and validates session cookies using HMAC-SHA256.
 * Prevents tampering — cookie data is signed with a server-only secret.
 *
 * Session data: { userId, role, name }
 */
import { createHash, randomBytes } from 'node:crypto'

const SECRET = randomBytes(32).toString('hex')
const COOKIE_NAME = 'lms_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24 hours

export interface SessionData {
  userId: string
  role: 'student' | 'instructor' | 'admin'
  name: string
}

/**
 * Create a signed session cookie value.
 */
export function createSessionCookie(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const sig = createHash('sha256').update(`${payload}.${SECRET}`).digest('hex').slice(0, 16)
  return `${payload}.${sig}`
}

/**
 * Parse and validate a session cookie.
 * Returns null if the cookie is missing, malformed, or tampered with.
 */
export function parseSessionCookie(raw: string | undefined): SessionData | null {
  if (!raw) return null

  const parts = raw.split('.')
  if (parts.length !== 2) return null

  const [payload, sig] = parts
  const expected = createHash('sha256').update(`${payload}.${SECRET}`).digest('hex').slice(0, 16)

  if (sig !== expected) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (data?.userId && data?.role && data?.name) {
      return data as SessionData
    }
  } catch {
    // Invalid JSON payload
  }
  return null
}

/**
 * Get the session cookie configuration.
 */
export function getSessionConfig() {
  return {
    name: COOKIE_NAME,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: false, // readable by JS for SSR hydration
  }
}
