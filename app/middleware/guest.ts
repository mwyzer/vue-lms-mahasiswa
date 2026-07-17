/**
 * Guest middleware — redirects authenticated users to their dashboard.
 * Used for login and landing pages.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.init()
  }

  // Try restoring from the signed session cookie if not authenticated yet
  if (!auth.isAuthenticated) {
    const sessionCookie = useCookie('lms_session')
    if (sessionCookie.value) {
      auth.restoreSessionFromCookie(sessionCookie.value)
    }
  }

  if (auth.isAuthenticated) {
    return navigateTo(auth.dashboardRoute)
  }
})
