/**
 * Admin AI Usage — GET /api/admin/ai-usage
 *
 * Returns today's AI token usage and request statistics.
 * Only accessible by admin users (checked via session cookie).
 */
export default defineEventHandler(async (event) => {
  // Auth check — only admin can see usage stats
  const raw = getCookie(event, 'lms_session')
  const session = parseSessionCookie(raw)

  if (!session || session.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Akses ditolak. Hanya admin yang dapat melihat usage AI.',
    })
  }

  const usage = getUsage()
  const budget = remainingBudget()
  const maxBudget = 100_000

  return {
    date: usage.date,
    totalTokens: usage.totalTokens,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    requestCount: usage.requestCount,
    budgetRemaining: budget,
    budgetTotal: maxBudget,
    budgetPercent: Math.round((usage.totalTokens / maxBudget) * 100),
  }
})
