/**
 * UI Store — Manages global UI state such as loading indicators,
 * notifications/toasts, sidebar state, theme preferences,
 * and demo-mode runtime override.
 */
import { defineStore } from 'pinia'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface UiState {
  globalLoading: boolean
  toasts: Toast[]
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  /** Runtime override for demo mode. null = use env config (NUXT_PUBLIC_DEMO_MODE). */
  demoModeOverride: boolean | null
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    globalLoading: false,
    toasts: [],
    sidebarCollapsed: false,
    theme: 'light',
    demoModeOverride: null,
  }),

  getters: {
    activeToasts: (state) => state.toasts.slice(0, 5),
    hasToasts: (state) => state.toasts.length > 0,

    /** Effective demo mode — override takes priority over env config. */
    isDemoMode(): boolean {
      if (this.demoModeOverride !== null) return this.demoModeOverride
      const config = useRuntimeConfig()
      const mode = config.public.demoMode
      // Handle both boolean and string values (Nuxt may parse env vars)
      return mode === true || mode === 'true'
    },
  },

  actions: {
    /**
     * Show a toast notification.
     */
    showToast(type: Toast['type'], message: string, duration = 4000) {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const toast: Toast = { id, type, message, duration }
      this.toasts.push(toast)

      if (duration > 0) {
        setTimeout(() => {
          this.dismissToast(id)
        }, duration)
      }

      return id
    },

    /**
     * Dismiss a specific toast by ID.
     */
    dismissToast(id: string) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },

    /**
     * Clear all toasts immediately.
     */
    clearToasts() {
      this.toasts = []
    },

    /**
     * Set global loading state.
     */
    setLoading(value: boolean) {
      this.globalLoading = value
    },

    /**
     * Toggle sidebar collapsed state.
     */
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },

    /**
     * Set the theme and persist to localStorage + DOM attribute.
     * The `data-theme` attribute on <html> drives all CSS variable overrides
     * and Vuestic UI's color preset switching.
     */
    setTheme(theme: 'light' | 'dark') {
      this.theme = theme

      if (import.meta.client) {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('lms-theme', theme)
      }
    },

    /**
     * Toggle between light and dark themes.
     */
    toggleTheme() {
      const next = this.theme === 'light' ? 'dark' : 'light'
      this.setTheme(next)
    },

    /**
     * Initialize theme from localStorage or system preference.
     * Call once on app mount (e.g., in a client-only plugin or layout).
     */
    initTheme() {
      if (!import.meta.client) return

      const stored = localStorage.getItem('lms-theme') as UiState['theme'] | null
      const preferred =
        stored ??
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

      this.setTheme(preferred)

      // Listen for OS-level changes when no explicit preference is stored
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('lms-theme')) {
          this.setTheme(e.matches ? 'dark' : 'light')
        }
      })
    },

    /**
     * Initialize demo mode override from localStorage.
     */
    initDemoMode() {
      if (!import.meta.client) return
      const stored = localStorage.getItem('lms-demo-override')
      if (stored === 'on') this.demoModeOverride = true
      else if (stored === 'off') this.demoModeOverride = false
    },

    /**
     * Toggle demo mode at runtime (admin only).
     * Re-initializes all data stores to switch between demo and Supabase data.
     */
    async toggleDemoMode() {
      const current = this.isDemoMode
      const next = !current
      this.demoModeOverride = next

      if (import.meta.client) {
        localStorage.setItem('lms-demo-override', next ? 'on' : 'off')
      }

      // Re-initialize all data stores with the new mode
      try {
        const { useAuthStore } = await import('./auth')
        const { useCoursesStore } = await import('./courses')
        const { useAssignmentsStore } = await import('./assignments')
        const { useQuizStore } = await import('./quiz')
        const { useAttendanceStore } = await import('./attendance')
        const { useAnnouncementsStore } = await import('./announcements')
        const { useCalendarStore } = await import('./calendar')

        const auth = useAuthStore()
        const courses = useCoursesStore()
        const assignments = useAssignmentsStore()
        const quiz = useQuizStore()
        const attendance = useAttendanceStore()
        const announcements = useAnnouncementsStore()
        const calendar = useCalendarStore()

        // Reset initialized flags so init() runs fresh
        auth.initialized = false
        courses.initialized = false
        assignments.initialized = false
        quiz.initialized = false
        attendance.initialized = false
        announcements.initialized = false
        calendar.initialized = false

        // Re-init all stores in parallel
        await Promise.all([
          auth.init(),
          courses.init(),
          assignments.init(),
          quiz.init(),
          attendance.init(),
          announcements.init(),
          calendar.init(),
        ])

        this.showToast('info', next ? 'Demo mode aktif — menggunakan data lokal' : 'Demo mode nonaktif — menggunakan data Supabase')
      } catch (err) {
        console.error('Failed to toggle demo mode:', err)
        this.showToast('error', 'Gagal mengganti mode demo')
      }
    },
  },
})
