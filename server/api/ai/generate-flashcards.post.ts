/**
 * Generate Flashcards API — POST /api/ai/generate-flashcards
 *
 * Drafts question/answer flashcards from a lesson's text. Nothing is saved
 * here: the client shows the cards as drafts and the student explicitly saves
 * the ones they keep (stores/flashcards.ts → saveDrafts).
 *
 * Modes:
 *   - AI: OpenAI-compatible JSON mode via the shared client, strictly validated
 *     (server/utils/flashcardGen.ts).
 *   - Demo / AI unavailable: deterministic definition + cloze cards from the
 *     lesson text (`source: 'demo'`).
 *
 * Auth + rate limit come from server/middleware/01.ai-safeguard.ts; this route
 * allows every logged-in role (students make their own study cards).
 */
import { getRequestHeader, readBody } from 'h3'

defineRouteMeta({
  openAPI: {
    summary: 'Generate flashcard dari materi (AI)',
    description:
      'Membuat draf flashcard (front/back) dari isi materi. Tidak menyimpan apa pun.\n\n' +
      '**Mode AI**: OpenAI-compatible JSON mode jika NUXT_AI_API_KEY diset.\n' +
      '**Mode demo**: kartu definisi + isian rumpang deterministik dari teks materi (`source: "demo"`).',
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
                  konten: { type: 'string', minLength: 80, maxLength: 50000 },
                },
              },
              count: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
              existing: { type: 'array', maxItems: 500, items: { type: 'string' }, description: 'Sisi depan kartu yang sudah dimiliki (hindari duplikat)' },
              seed: { type: 'integer', description: 'Opsional: seed variasi mode demo' },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Draf flashcard',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                cards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } } } },
                source: { type: 'string', enum: ['ai', 'demo'] },
                requested: { type: 'integer' },
                generated: { type: 'integer' },
              },
            },
          },
        },
      },
      400: { description: 'Input tidak valid' },
      401: { description: 'Belum login' },
      413: { description: 'Body permintaan terlalu besar' },
      422: { description: 'Materi terlalu pendek/kurang bervariasi untuk membuat kartu' },
      429: { description: 'Rate limit atau batas harian AI tercapai' },
    },
  },
})

export default defineEventHandler(async (event) => {
  requireAiRole(event, ['student', 'instructor', 'admin'])

  const declared = Number(getRequestHeader(event, 'content-length') || 0)
  if (declared > FLASHCARDGEN_LIMITS.BODY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Payload Too Large', message: 'Permintaan terlalu besar.' })
  }

  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Body permintaan bukan JSON yang valid.' })
  }
  const parsed = parseFlashcardGenRequest(body)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: parsed.message })
  }

  const config = getAiConfig(event)
  const callModel: FlashcardGenModelCall | null = config.isDemo ? null : (opts, validate) => chatJsonWith(config, opts, validate)

  try {
    return await runFlashcardGeneration(parsed.value, callModel, {
      onFallback: (err) => console.warn('[generate-flashcards] AI unavailable, using demo fallback:', (err as Error)?.message),
    })
  } catch (err) {
    if ((err as Error)?.name === 'FlashcardGenEmptyError') {
      throw createError({ statusCode: 422, statusMessage: 'Unprocessable Entity', message: (err as Error).message })
    }
    throw err
  }
})
