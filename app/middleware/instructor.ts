/**
 * Instructor middleware — ensures the current user has an 'instructor' or 'admin' role.
 * Must be used after auth middleware.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }

  if (!auth.isInstructor && !auth.isAdmin) {
    // Students trying to access instructor pages → redirect to student dashboard
    return navigateTo('/dashboard')
  }
})
