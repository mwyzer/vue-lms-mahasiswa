/**
 * Instructor middleware — ensures the current user has an 'instructor' or 'admin' role.
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

  if (!auth.isInstructor && !auth.isAdmin) {
    // Students trying to access instructor pages → redirect to student dashboard
    return navigateTo('/dashboard')
  }
})
