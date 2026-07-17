/**
 * Auth middleware — redirects unauthenticated users to login page.
 * Used for any route that requires authentication (student or instructor).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // Initialize: restores session from localStorage (client) or cookie (server)
  if (!auth.initialized) {
    await auth.init()
  }

  // If still not authenticated, try restoring from the signed session cookie
  if (!auth.isAuthenticated) {
    const sessionCookie = useCookie('lms_session')
    if (sessionCookie.value) {
      auth.restoreSessionFromCookie(sessionCookie.value)
    }
  }

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
