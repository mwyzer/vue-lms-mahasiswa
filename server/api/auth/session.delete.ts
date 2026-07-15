/**
 * Auth Session — DELETE /api/auth/session
 *
 * Clears the session cookie. Called by the auth store on logout.
 */
export default defineEventHandler(async (event) => {
  const cfg = getSessionConfig()
  deleteCookie(event, cfg.name, { path: cfg.path })
  return { ok: true }
})
