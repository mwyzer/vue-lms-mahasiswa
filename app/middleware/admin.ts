/**
 * Admin middleware — ensures the current user has an 'admin' role.
 * Must be used after auth middleware.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }

  if (!auth.isAdmin) {
    // Non-admin users → redirect to their own dashboard
    return navigateTo(auth.dashboardRoute)
  }
})
