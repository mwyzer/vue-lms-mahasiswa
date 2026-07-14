/**
 * useNotification — Composable for toast notifications.
 */
import { useUiStore } from '~/stores/ui'

export function useNotification() {
  const ui = useUiStore()

  return {
    toasts: computed(() => ui.activeToasts),
    hasToasts: computed(() => ui.hasToasts),

    success: (message: string) => ui.showToast('success', message),
    error: (message: string) => ui.showToast('error', message),
    warning: (message: string) => ui.showToast('warning', message),
    info: (message: string) => ui.showToast('info', message),

    dismiss: (id: string) => ui.dismissToast(id),
    clearAll: () => ui.clearToasts(),
  }
}
