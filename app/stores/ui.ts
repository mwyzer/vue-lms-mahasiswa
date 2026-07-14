/**
 * UI Store — Manages global UI state such as loading indicators,
 * notifications/toasts, sidebar state, and theme preferences.
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
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    globalLoading: false,
    toasts: [],
    sidebarCollapsed: false,
    theme: 'light',
  }),

  getters: {
    activeToasts: (state) => state.toasts.slice(0, 5),
    hasToasts: (state) => state.toasts.length > 0,
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
  },
})
