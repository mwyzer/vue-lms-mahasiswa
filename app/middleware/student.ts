/**
 * Student middleware — ensures the current user has a 'student' or 'admin' role.
 * Must be used after auth middleware.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }

  if (!auth.isStudent && !auth.isAdmin) {
    // Instructors trying to access student pages → redirect to instructor dashboard
    return navigateTo('/instructor/dashboard')
  }
})
