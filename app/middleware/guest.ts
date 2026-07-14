/**
 * Guest middleware — redirects authenticated users to their dashboard.
 * Used for login and landing pages.
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (auth.isAuthenticated) {
    return navigateTo(auth.dashboardRoute)
  }
})
