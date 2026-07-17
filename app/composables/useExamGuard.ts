/**
 * useExamGuard — Monitors student focus during exams.
 *
 * Detects when a student switches tabs, opens another browser window,
 * or moves the current window to the background. On repeated violations,
 * the exam is automatically submitted to prevent cheating.
 *
 * Usage:
 *   const examGuard = useExamGuard(assignmentId, submitCallback)
 *   examGuard.start()
 *   // ... later ...
 *   examGuard.stop()
 */
import { ref, onUnmounted, watch } from 'vue'
import { useNotification } from './useNotification'

export interface ExamGuardOptions {
  /** Maximum allowed violations before auto-submit (default: 1) */
  maxViolations?: number
  /** Whether to auto-submit on violation threshold (default: true) */
  autoSubmit?: boolean
}

interface ViolationLog {
  timestamp: number
  type: 'tab-hide' | 'window-blur'
}

export function useExamGuard(
  assignmentId: string,
  submitCallback: () => void,
  options: ExamGuardOptions = {}
) {
  const { maxViolations = 1, autoSubmit = true } = options

  const violationCount = ref(0)
  const isMonitoring = ref(false)
  const wasAutoSubmitted = ref(false)
  const violationLog = ref<ViolationLog[]>([])
  const lastViolationTime = ref(0)
  const showWarning = ref(false)

  const notification = useNotification()

  // ── Event handlers ──

  function handleVisibilityChange() {
    if (!isMonitoring.value) return
    if (document.visibilityState === 'hidden') {
      recordViolation('tab-hide')
    }
  }

  function handleWindowBlur() {
    if (!isMonitoring.value) return
    // Small delay to avoid false positives from dialog/alert blur events
    setTimeout(() => {
      if (document.visibilityState === 'hidden' || !document.hasFocus()) {
        recordViolation('window-blur')
      }
    }, 300)
  }

  function handleWindowFocus() {
    // Clear warning when student returns
    if (showWarning.value) {
      showWarning.value = false
    }
  }

  // ── Violation recording ──

  function recordViolation(type: ViolationLog['type']) {
    // Debounce: ignore if last violation was less than 2 seconds ago
    const now = Date.now()
    if (now - lastViolationTime.value < 2000) return
    lastViolationTime.value = now

    violationCount.value++
    violationLog.value.push({ timestamp: now, type })

    if (violationCount.value >= maxViolations) {
      showWarning.value = false
      if (autoSubmit) {
        submitCallback()
        wasAutoSubmitted.value = true
        notification.warning(
          'Ujian diakhiri karena Anda meninggalkan halaman ujian.'
        )
      }
      stop()
    } else {
      // Show warning on first violation
      showWarning.value = true
      notification.warning(
        'Peringatan: Anda meninggalkan halaman ujian! ' +
        (maxViolations - violationCount.value > 0
          ? `Pelanggaran berikutnya akan mengakhiri ujian secara otomatis.`
          : '')
      )
    }
  }

  // ── Lifecycle ──

  function start() {
    if (isMonitoring.value) return
    isMonitoring.value = true
    violationCount.value = 0
    violationLog.value = []
    wasAutoSubmitted.value = false
    showWarning.value = false

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)
  }

  function stop() {
    if (!isMonitoring.value) return
    isMonitoring.value = false
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('blur', handleWindowBlur)
    window.removeEventListener('focus', handleWindowFocus)
  }

  function reset() {
    violationCount.value = 0
    violationLog.value = []
    wasAutoSubmitted.value = false
    showWarning.value = false
    lastViolationTime.value = 0
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stop()
  })

  return {
    violationCount,
    isMonitoring,
    wasAutoSubmitted,
    showWarning,
    start,
    stop,
    reset,
  }
}
