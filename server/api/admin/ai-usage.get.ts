/**
 * Admin AI Usage — GET /api/admin/ai-usage
 *
 * Returns today's AI token usage and request statistics.
 * Only accessible by admin users (checked via session cookie).
 */
export default defineEventHandler(
  {
    openAPI: {
      summary: 'AI Usage Statistics',
      description: 'Mengembalikan statistik penggunaan token AI hari ini. Hanya dapat diakses oleh admin.',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: 'Statistik penggunaan AI hari ini',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date', description: 'Tanggal (YYYY-MM-DD)', example: '2026-07-21' },
                  totalTokens: { type: 'integer', description: 'Total token yang digunakan hari ini', example: 5432 },
                  promptTokens: { type: 'integer', description: 'Token prompt (input)', example: 3200 },
                  completionTokens: { type: 'integer', description: 'Token completion (output)', example: 2232 },
                  requestCount: { type: 'integer', description: 'Jumlah request AI hari ini', example: 15 },
                  budgetRemaining: { type: 'integer', description: 'Sisa budget token hari ini', example: 94568 },
                  budgetTotal: { type: 'integer', description: 'Total budget token per hari', example: 100000 },
                  budgetPercent: { type: 'integer', description: 'Persentase budget terpakai', example: 5 },
                },
              },
            },
          },
        },
        403: { description: 'Forbidden — hanya admin yang dapat mengakses' },
      },
    },
  },
  async (event) => {
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
