/**
 * Plagiarism Check — POST /api/plagiarism/check
 *
 * Compares a batch of text submissions against each other and reports
 * pairwise similarity. Intended for instructors reviewing assignment
 * submissions.
 *
 * Body: {
 *   submissions: Array<{ id, student_id, student_name?, jawaban? }>
 * }
 *
 * Response: {
 *   checked: PlagiarismResult[],   // per-submission ranked matches
 *   flagged: PlagiarismResult[],   // those with highestScore >= threshold
 *   threshold: number,             // severity threshold applied (75)
 *   total: number,                 // number of submissions compared
 * }
 */
import { checkSubmissionAgainst, type SubmissionLike } from '~/server/utils/plagiarism'

export default defineEventHandler(
  {
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
                },
              },
            },
          },
        },
        400: { description: 'Payload submissions tidak valid atau kosong' },
        403: { description: 'Hanya instruktur yang dapat menjalankan pemeriksaan' },
      },
    },
  },
  async (event) => {
    const session = parseSessionCookie(getCookie(event, 'lms_session'))
    if (!session) {
      throw createError({ statusCode: 401, statusMessage: 'Silakan login terlebih dahulu.' })
    }
    if (session.role !== 'instructor' && session.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Hanya instruktur yang dapat memeriksa kemiripan.' })
    }

    const body = await readBody<{ submissions?: SubmissionLike[] }>(event)
    const submissions: SubmissionLike[] = body?.submissions ?? []

    const withText = submissions.filter((s) => (s.jawaban || '').trim().length > 0)
    if (withText.length < 2) {
      return { checked: [], flagged: [], threshold: 75, total: withText.length }
    }

    const checked = withText.map((s) =>
      checkSubmissionAgainst(
        s.id,
        s.student_name || s.student_id,
        s.jawaban || '',
        withText
      )
    )

    const threshold = 75
    const flagged = checked.filter((r) => r.highestScore >= threshold)

    return { checked, flagged, threshold, total: withText.length }
  }
)