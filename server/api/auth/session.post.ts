/**
 * Auth Session — POST /api/auth/session
 *
 * Creates a signed session cookie for the authenticated user.
 * Called by the auth store after a successful login.
 *
 * Body: { userId: string, role: 'student' | 'instructor' | 'admin', name: string }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId: string; role: 'student' | 'instructor' | 'admin'; name: string }>(event)

  if (!body?.userId || !body?.role || !body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'Data session tidak lengkap.' })
  }

  const sessionCookie = createSessionCookie({
    userId: body.userId,
    role: body.role,
    name: body.name,
  })

  const cfg = getSessionConfig()
  setCookie(event, cfg.name, sessionCookie, {
    path: cfg.path,
    sameSite: cfg.sameSite,
    maxAge: cfg.maxAge,
  })

  return { ok: true }
})
