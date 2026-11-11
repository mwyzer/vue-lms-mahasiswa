/**
 * Plagiarism Check — POST /api/plagiarism/check
 *
 * Compares a batch of text submissions against each other and reports two
 * similarity signals per pair, for an instructor to review (never a verdict):
 *   - lexical  — Jaccard over word 3-grams (copy-paste), unchanged
 *   - semantic — cosine similarity of embeddings (paraphrase, with an AI key)
 *
 * Body: {
 *   submissions: Array<{ id, student_id, student_name?, jawaban? }>   // max 200
 *   thresholds?: { lexical?: number, semantic?: number }               // clamped
 * }
 *
 * Response: {
 *   checked: PlagiarismResultV2[],  // per-submission ranked matches (+ semantic fields)
 *   flagged: PlagiarismResultV2[],  // submissions with any flagged match (lexical or semantic)
 *   threshold: number,              // lexical threshold applied (default 75)
 *   total: number,                  // number of text submissions compared
 *   pairs: PlagiarismPair[],        // flagged pairs, both scores, sorted by max score
 *   semantic: { mode: 'api'|'local'|'unavailable', threshold, effective_threshold,
 *               baseline, min_words, compared, skipped_short, truncated, reason?, note? }
 * }
 *
 * Guards: instructor/admin session, per-user rate limit (10/min, the call can
 * spend embedding budget), payload caps. Over the daily AI budget the lexical
 * result is still returned with `semantic.mode = 'unavailable', reason: 'budget'`.
 */
import {
  buildPlagiarismReport,
  semanticCandidates,
  MAX_CHECK_SUBMISSIONS,
  type SemanticInput,
  type SubmissionLike,
} from '../../utils/plagiarism'
import { MAX_EMBED_INPUT_CHARS, embedTexts, getAiConfig } from '../../utils/ai'
import { checkRateLimit } from '../../utils/rateLimiter'

/** Per-user limit for this endpoint (each call may embed up to 200 answers). */
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 }
/** Hard cap per answer to keep the lexical O(n²) pass bounded. */
const MAX_ANSWER_CHARS = 50_000

defineRouteMeta({
  openAPI: {
    summary: 'Plagiarism Check',
    description:
      'Membandingkan sekumpulan jawaban tugas dan mengembalikan hasil kesamaan teks antar mahasiswa. Hanya boleh diakses instruktur.',
    tags: ['Instructor'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['submissions'],
            properties: {
              submissions: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'student_id'],
                  properties: {
                    id: { type: 'string' },
                    student_id: { type: 'string' },
                    student_name: { type: 'string' },
                    jawaban: { type: 'string', nullable: true },
                  },
                },
                maxItems: MAX_CHECK_SUBMISSIONS,
              },
              thresholds: {
                type: 'object',
                description: 'Override ambang (persen). Leksikal 20–100; semantik api 70–99, local 50–99.',
                properties: {
                  lexical: { type: 'number' },
                  semantic: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Hasil perbandingan kemiripan',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                checked: { type: 'array', items: { type: 'object' } },
                flagged: { type: 'array', items: { type: 'object' } },
                threshold: { type: 'number' },
                total: { type: 'number' },
                pairs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      a_id: { type: 'string' },
                      a_name: { type: 'string' },
                      b_id: { type: 'string' },
                      b_name: { type: 'string' },
                      similarity: { type: 'number', description: 'Skor leksikal 0–100' },
                      semantic_similarity: { type: 'number', nullable: true, description: 'Skor semantik 0–100' },
                      match_type: { type: 'string', enum: ['lexical', 'semantic', 'both'] },
                      semantic_skipped: { type: 'string', enum: ['short', 'unavailable'] },
                      semantic_truncated: { type: 'boolean' },
                    },
                  },
                },
                semantic: {
                  type: 'object',
                  properties: {
                    mode: { type: 'string', enum: ['api', 'local', 'unavailable'] },
                    threshold: { type: 'number', nullable: true },
                    effective_threshold: { type: 'number', nullable: true },
                    baseline: { type: 'number', nullable: true },
                    min_words: { type: 'number' },
                    compared: { type: 'number' },
                    skipped_short: { type: 'number' },
                    truncated: { type: 'number' },
                    reason: { type: 'string', enum: ['budget', 'error', 'disabled'] },
                    note: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: 'Payload submissions tidak valid atau kosong' },
      401: { description: 'Belum login' },
      403: { description: 'Hanya instruktur yang dapat menjalankan pemeriksaan' },
      429: { description: 'Terlalu banyak pemeriksaan dalam satu menit' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const session = parseSessionCookie(getCookie(event, 'lms_session'))
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Silakan login terlebih dahulu.' })
  }
  if (session.role !== 'instructor' && session.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Hanya instruktur yang dapat memeriksa kemiripan.' })
  }

  const limit = checkRateLimit(`plagiarism:${session.userId}`, RATE_LIMIT)
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
    setResponseHeader(event, 'retry-after', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: `Terlalu banyak pemeriksaan kemiripan. Coba lagi dalam ${retryAfter} detik.`,
    })
  }

  const body = await readBody<{
    submissions?: SubmissionLike[]
    thresholds?: { lexical?: unknown; semantic?: unknown }
  }>(event)
  const raw = Array.isArray(body?.submissions) ? body!.submissions! : []

  // Keep well-formed entries with text; one entry per id.
  const seen = new Set<string>()
  const withText: SubmissionLike[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || seen.has(s.id)) continue
    const jawaban = typeof s.jawaban === 'string' ? s.jawaban : ''
    if (!jawaban.trim()) continue
    if (jawaban.length > MAX_ANSWER_CHARS) {
      throw createError({ statusCode: 400, statusMessage: `Jawaban terlalu panjang (maks. ${MAX_ANSWER_CHARS} karakter).` })
    }
    seen.add(s.id)
    withText.push({
      id: s.id,
      student_id: String(s.student_id ?? ''),
      student_name: typeof s.student_name === 'string' ? s.student_name : undefined,
      jawaban,
    })
  }
  if (withText.length > MAX_CHECK_SUBMISSIONS) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maksimal ${MAX_CHECK_SUBMISSIONS} jawaban per pemeriksaan.`,
    })
  }

  const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
  const opts = {
    lexicalThreshold: num(body?.thresholds?.lexical),
    semanticThreshold: num(body?.thresholds?.semantic),
    maxEmbedChars: MAX_EMBED_INPUT_CHARS,
  }

  // One embedding batch for all eligible answers ⇒ one shared mode.
  const candidates = withText.length >= 2 ? semanticCandidates(withText) : []
  let semantic: SemanticInput
  if (candidates.length < 2) {
    // Nothing to compare semantically: no budget spent. Report the mode we would use.
    semantic = { mode: getAiConfig(event).isDemo ? 'local' : 'api', vectorsById: {} }
  } else {
    try {
      const { vectors, mode } = await embedTexts(event, candidates.map((c) => c.jawaban || ''))
      semantic = { mode, vectorsById: Object.fromEntries(candidates.map((c, i) => [c.id, vectors[i]!])) }
    } catch (err: any) {
      // Lexical results are still useful: degrade the semantic score, don't fail the check.
      const status = err?.statusCode ?? err?.status
      if (status === 429) {
        semantic = { mode: 'unavailable', reason: 'budget', message: err?.statusMessage || undefined }
      } else {
        console.error('[plagiarism] embedding failed:', err?.message ?? err)
        semantic = { mode: 'unavailable', reason: 'error' }
      }
    }
  }

  const report = buildPlagiarismReport(withText, semantic, opts)
  if (withText.length < 2) {
    // Same early-exit shape as before (empty lists), plus the new fields.
    return { ...report, checked: [], flagged: [], pairs: [] }
  }
  return report
})
