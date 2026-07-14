/**
 * Auth middleware — redirects unauthenticated users to login page.
 * Used for any route that requires authentication (student or instructor).
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
