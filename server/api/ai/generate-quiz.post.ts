/**
 * Generate Quiz API — POST /api/ai/generate-quiz
 *
 * Drafts multiple-choice questions from a lesson's material for an instructor
 * to REVIEW. Nothing is saved here: the instructor edits/deselects the drafts
 * in the UI and explicitly adds the chosen ones to a quiz.
 *
 * Modes:
 *   - AI: OpenAI-compatible JSON mode via the shared client (`chatJson`),
 *     strictly validated (see server/utils/quizGen.ts).
 *   - Demo / AI unavailable: deterministic cloze questions built from the
 *     lesson text (`source: 'demo'`).
 *
 * Auth + rate limit come from server/middleware/01.ai-safeguard.ts; this route
 * additionally requires role instructor/admin and validates input sizes.
 */
import { getRequestHeader, readBody } from 'h3'

defineRouteMeta({
  openAPI: {
    summary: 'Generate soal kuis dari materi (AI)',
    description:
      'Membuat draf soal pilihan ganda dari isi materi untuk ditinjau instruktur. Tidak menyimpan apa pun.\n\n' +
      '**Mode AI**: OpenAI-compatible JSON mode jika NUXT_AI_API_KEY diset.\n' +
      '**Mode demo**: soal isian rumpang deterministik dari teks materi (`source: "demo"`).',
    tags: ['AI'],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['lesson'],
            properties: {
              lesson: {
                type: 'object',
                required: ['konten'],
                properties: {
                  judul: { type: 'string', maxLength: 200 },
                  konten: { type: 'string', minLength: 120, maxLength: 50000 },
                },
              },
              count: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
              difficulty: { type: 'string', enum: ['mudah', 'sedang', 'sulit'], default: 'sedang' },
              existing: {
                type: 'array',
                maxItems: 200,
                items: { type: 'string' },
                description: 'Teks soal yang sudah ada di kuis (untuk menghindari duplikat)',
              },
              seed: { type: 'integer', description: 'Opsional: seed pengacakan (generate ulang)' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Draf soal berhasil dibuat',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      pertanyaan: { type: 'string' },
                      pilihan_a: { type: 'string' },
                      pilihan_b: { type: 'string' },
                      pilihan_c: { type: 'string' },
                      pilihan_d: { type: 'string' },
                      jawaban_benar: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
                      penjelasan: { type: 'string' },
                    },
                  },
                },
                source: { type: 'string', enum: ['ai', 'demo'] },
                requested: { type: 'integer' },
                generated: { type: 'integer' },
              },
            },
          },
        },
      },
      400: { description: 'Input tidak valid (materi kosong/terlalu pendek/terlalu panjang, dll.)' },
      401: { description: 'Belum login' },
      403: { description: 'Bukan instruktur/admin' },
      413: { description: 'Body permintaan terlalu besar' },
      422: { description: 'Materi terlalu pendek/kurang bervariasi untuk membuat soal' },
      429: { description: 'Rate limit atau batas harian AI tercapai' },
    },
  },
})

export default defineEventHandler(async (event) => {
  requireAiRole(event, ['instructor', 'admin'])

  const declared = Number(getRequestHeader(event, 'content-length') || 0)
  if (declared > QUIZGEN_LIMITS.BODY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Payload Too Large', message: 'Permintaan terlalu besar.' })
  }

  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Body permintaan bukan JSON yang valid.' })
  }
  const parsed = parseQuizGenRequest(body)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: parsed.message })
  }

  const config = getAiConfig(event)
  const callModel: QuizGenModelCall | null = config.isDemo
    ? null
    : (opts, validate) => chatJsonWith(config, opts, validate)

  try {
    return await runQuizGeneration(parsed.value, callModel, {
      onFallback: (err) => console.warn('[generate-quiz] AI unavailable, using demo fallback:', (err as Error)?.message),
    })
  } catch (err) {
    if ((err as Error)?.name === 'QuizGenEmptyError') {
      throw createError({ statusCode: 422, statusMessage: 'Unprocessable Entity', message: (err as Error).message })
    }
    throw err // incl. H3 429 (daily budget) — must reach the client
  }
})
