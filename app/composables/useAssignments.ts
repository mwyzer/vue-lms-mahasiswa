/**
 * useAssignments — Composable for assignment-related operations.
 *
 * Also provides date helpers and countdown timer logic so pages
 * don't need inline setInterval / date formatting.
 */
import { useAssignmentsStore } from '~/stores/assignments'

export function useAssignments() {
  const store = useAssignmentsStore()

  // ── Date Helpers ──

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function isOverdue(dueDateStr: string): boolean {
    return new Date(dueDateStr) < new Date()
  }

  // ── Countdown Timer ──

  function useCountdown(dueDateStr: string) {
    const timeRemaining = ref('')
    let interval: ReturnType<typeof setInterval> | null = null

    function tick() {
      const now = new Date().getTime()
      const due = new Date(dueDateStr).getTime()
      const diff = due - now

      if (diff <= 0) {
        timeRemaining.value = 'Terlewat'
        if (interval) clearInterval(interval)
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) {
        timeRemaining.value = `${days} hari ${hours} jam lagi`
      } else if (hours > 0) {
        timeRemaining.value = `${hours} jam ${minutes} menit lagi`
      } else {
        timeRemaining.value = `${minutes} menit lagi`
      }
    }

    function start() {
      tick()
      interval = setInterval(tick, 60_000)
    }

    function stop() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    return { timeRemaining, start, stop }
  }

  return {
    // State
    assignments: computed(() => store.assignments),
    myAssignments: computed(() => store.myAssignments),
    currentAssignment: computed(() => store.currentAssignment),
    loading: computed(() => store.loading),

    // Actions
    setCurrentAssignment: (id: string) => store.setCurrentAssignment(id),
    submitAssignment: (assignmentId: string, jawaban: string) =>
      store.submitAssignment(assignmentId, jawaban),
    addAssignment: (courseId: string, judul: string, deskripsi: string, tenggatWaktu: string) =>
      store.addAssignment(courseId, judul, deskripsi, tenggatWaktu),
    gradeSubmission: (submissionId: string, nilai: number, feedback: string) =>
      store.gradeSubmission(submissionId, nilai, feedback),

    // Date helpers
    formatDate,
    isOverdue,
    useCountdown,
  }
}
