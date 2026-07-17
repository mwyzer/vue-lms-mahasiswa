/**
 * Student middleware — ensures the current user has a 'student' or 'admin' role.
 * Must be used after auth middleware.
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

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }

  if (!auth.isStudent && !auth.isAdmin) {
    // Instructors trying to access student pages → redirect to instructor dashboard
    return navigateTo('/instructor/dashboard')
  }
})
