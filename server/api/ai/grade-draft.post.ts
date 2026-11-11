/**
 * AI Grade Draft — POST /api/ai/grade-draft
 *
 * Suggests a score + feedback DRAFT for one text submission. Nothing is saved:
 * the instructor reviews, edits and saves through the normal grading form.
 *
 * Auth/rate limit: `01.ai-safeguard` (all /api/ai/*) + instructor/admin only.
 *
 * Request:  { assignment: { judul, deskripsi? }, submission: { text }, rubric?, max_score?: 100 }
 *           (no student name/NPM/id — not needed for grading and never sent to the model)
 * Response: { nilai_saran, feedback, kekuatan[], perbaikan[], catatan?, flags[], source: 'ai' | 'demo' }
 *
 * Errors: 400 invalid/oversized input, 401/403 auth, 413 body too large,
 *         422 submission without text (file-only), 429 rate limit / daily AI budget.
 */
import { createError, getRequestHeader, readBody } from 'h3'
import { GRADE_LIMITS, generateGradeDraft, validateGradeDraftRequest } from '../../utils/gradeDraft'

/** Hard cap on the raw body (all fields at their max fit comfortably below this). */
const MAX_BODY_BYTES = 120_000

defineRouteMeta({
  openAPI: {
    summary: 'AI Grade Draft',
    description:
      'Membuat DRAF nilai (0–100) dan feedback untuk satu jawaban teks mahasiswa. Tidak menyimpan nilai; instruktur meninjau dan menyimpan sendiri. Hanya instruktur/admin.',
    tags: ['Instructor', 'AI'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['assignment', 'submission'],
            properties: {
              assignment: {
                type: 'object',
                required: ['judul'],
                properties: {
                  judul: { type: 'string', maxLength: GRADE_LIMITS.judul },
                  deskripsi: { type: 'string', maxLength: GRADE_LIMITS.deskripsi },
                },
              },
              submission: {
                type: 'object',
                properties: { text: { type: 'string', maxLength: GRADE_LIMITS.submission } },
              },
              rubric: { type: 'string', maxLength: GRADE_LIMITS.rubric },
              max_score: { type: 'number', enum: [100] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Draf nilai + feedback (source: ai | demo) dan flags peringatan' },
      400: { description: 'Input tidak valid atau terlalu panjang' },
      403: { description: 'Bukan instruktur/admin' },
      422: { description: 'Jawaban tanpa teks (hanya file)' },
      429: { description: 'Batas permintaan / anggaran AI harian tercapai' },
    },
  },
})

export default defineEventHandler(async (event) => {
  requireAiRole(event, ['instructor', 'admin'])

  const len = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (len > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Permintaan terlalu besar. Persingkat jawaban atau rubrik.' })
  }

  const body = await readBody(event).catch(() => null)
  const parsed = validateGradeDraftRequest(body)
  if (!parsed.ok) throw createError({ statusCode: parsed.status, statusMessage: parsed.message })

  const config = getAiConfig(event)
  return generateGradeDraft(parsed.value, {
    chat: (opts, validate) => chatJson(event, opts, validate),
    isUnavailable: isAiUnavailable,
    aiConfigured: !config.isDemo,
  })
})
