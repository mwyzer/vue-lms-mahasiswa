/**
 * useAiUsage — Composable for fetching AI usage statistics.
 *
 * Encapsulates the fetch call and loading/error state so pages
 * don't directly call fetch() — maintaining a clean separation
 * between presentation and data access.
 */
export interface AiUsageData {
  date: string
  totalTokens: number
  promptTokens: number
  completionTokens: number
  requestCount: number
  budgetRemaining: number
  budgetTotal: number
  budgetPercent: number
}

export function useAiUsage() {
  const data = ref<AiUsageData | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function fetch() {
    loading.value = true
    error.value = ''
    try {
      const res = await $fetch<AiUsageData>('/api/admin/ai-usage')
      data.value = res
    } catch (err: any) {
      error.value = err.message || 'Gagal memuat data AI usage.'
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    fetch,
  }
}
