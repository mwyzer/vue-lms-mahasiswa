/**
 * AI Safeguard Middleware — Runs on every /api/ai/* request.
 *
 * Guards:
 *   1. Authentication — rejects requests without a valid session cookie
 *   2. Rate limiting  — per-user (20/min) + global (100/min)
 *   3. Message length — rejects POST /api/ai/chat with >2000 char messages
 *
 * Attaches the validated session to `event.context.session` for downstream handlers.
 */
import { getCookie, getMethod, getRequestURL, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Only guard /api/ai/* routes
  if (!path.startsWith('/api/ai/')) return

  // ── 1. Auth ──
  const raw = getCookie(event, 'lms_session')
  const session = parseSessionCookie(raw)

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized — silakan login terlebih dahulu',
    })
  }

  // Make session available to route handlers
  event.context.session = session

  // ── 2. Rate limiting ──
  const userLimit = checkRateLimit(`user:${session.userId}`)
  const globalLimit = checkRateLimit('global:ai', { windowMs: 60_000, maxRequests: 100 })

  if (!userLimit.allowed) {
    const retryAfter = Math.ceil((userLimit.resetAt - Date.now()) / 1000)
    setResponseHeader(event, 'retry-after', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: `Terlalu banyak permintaan. Coba lagi dalam ${retryAfter} detik.`,
    })
  }

  if (!globalLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Server sedang sibuk, silakan coba lagi nanti.',
    })
  }

  // ── 3. Message length (POST only) ──
  if (path === '/api/ai/chat' && getMethod(event) === 'POST') {
    const body = await readBody<{ message?: string }>(event)
    const msgLen = body?.message?.length ?? 0

    if (msgLen > 2000) {
      throw createError({
        statusCode: 400,
        statusMessage: `Pesan terlalu panjang (${msgLen} karakter). Maksimal 2000 karakter.`,
      })
    }
  }
})
