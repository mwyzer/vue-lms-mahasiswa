/**
 * usePlagiarism — Composable for calling the plagiarism-check server API.
 * Wraps $fetch against POST /api/plagiarism/check with a simple state.
 */
import type { PlagiarismResult } from '~/server/utils/plagiarism'

export interface PlagiarismReport {
  checked: PlagiarismResult[]
  flagged: PlagiarismResult[]
  threshold: number
  total: number
}

interface CheckableSubmission {
  id: string
  student_id: string
  student_name?: string
  jawaban?: string | null
}

export function usePlagiarism() {
  const checking = ref(false)
  const error = ref<string | null>(null)

  /**
   * Run a plagiarism check on a batch of submissions.
   * Returns the report, or null when there aren't enough text submissions (>1).
   */
  async function check(submissions: CheckableSubmission[]): Promise<PlagiarismReport | null> {
    error.value = null
    const withText = submissions.filter((s) => (s.jawaban || '').trim().length > 0)
    if (withText.length < 2) {
      return { checked: [], flagged: [], threshold: 75, total: withText.length }
    }

    checking.value = true
    try {
      const report = await $fetch<PlagiarismReport>('/api/plagiarism/check', {
        method: 'POST',
        body: { submissions: withText },
      })
      return report
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Gagal menjalankan pemeriksaan kemiripan.'
      return null
    } finally {
      checking.value = false
    }
  }

  return {
    checking,
    error,
    check,
  }
}