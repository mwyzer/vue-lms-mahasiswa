/**
 * useAuth — Composable for authentication operations.
 *
 * Wraps the auth store with convenient methods and reactive state
 * for use in components/pages.
 */
import { useAuthStore } from '~/stores/auth'

export function useAuth() {
  const auth = useAuthStore()

  const loginAsStudent = (nama: string, npm: string): boolean => {
    return auth.loginAsStudent(nama, npm)
  }

  const loginAsInstructor = (nama: string, password: string): boolean => {
    return auth.loginAsInstructor(nama, password)
  }

  const logout = () => {
    auth.logout()
  }

  return {
    // Reactive state
    user: computed(() => auth.user),
    role: computed(() => auth.role),
    isAuthenticated: computed(() => auth.isAuthenticated),
    isStudent: computed(() => auth.isStudent),
    isInstructor: computed(() => auth.isInstructor),
    loading: computed(() => auth.loading),
    error: computed(() => auth.error),
    dashboardRoute: computed(() => auth.dashboardRoute),

    // Roster data
    studentRoster: computed(() => auth.studentRoster),
    instructorList: computed(() => auth.instructorList),
    classList: computed(() => auth.classList),

    // Actions
    loginAsStudent,
    loginAsInstructor,
    logout,
    clearError: () => auth.clearError(),
  }
}
