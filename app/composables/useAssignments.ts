/**
 * useAssignments — Composable for assignment-related operations.
 */
import { useAssignmentsStore } from '~/stores/assignments'

export function useAssignments() {
  const store = useAssignmentsStore()

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
  }
}
