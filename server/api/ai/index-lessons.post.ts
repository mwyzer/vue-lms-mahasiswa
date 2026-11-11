/**
 * Index Lessons for AI — POST /api/ai/index-lessons  (instructor/admin)
 *
 * Chunks + embeds the lessons of a course and upserts them into `lesson_chunks`
 * (pgvector) so the AI tutor can retrieve them with `match_lesson_chunks`.
 * Unchanged chunks (same `content_hash` and embedding mode) are skipped; chunk
 * indexes that no longer exist for a lesson are deleted.
 *
 * Security: writes use the service-role client (bypasses RLS), so the server
 *   - checks the instructor teaches `course_id` (admins: any course), and
 *   - reads lesson text from the `lessons` table itself. The `lessons` sent by the
 *     client only select WHICH lessons to index (ids); their `judul`/`konten` are
 *     ignored, so nobody can plant text in another course's index.
 *
 * Request:  { course_id: string, lessons?: { id: string, judul?: string, konten?: string }[] }
 *           (omit `lessons` to index every lesson of the course)
 * Response: { ok: true, course_id, lessons, chunks, embedded, unchanged, deleted_lessons,
 *             mode: 'api' | 'local' | null, rejected: string[], warning? }
 * 503 when SUPABASE_SERVICE_ROLE_KEY / Supabase URL are not configured (e.g. demo mode).
 */
import { createClient } from '@supabase/supabase-js'
import { createError, defineEventHandler, readBody } from 'h3'
import { embedTextsWith, getAiConfig, requireAiRole } from '../../utils/ai'
import {
  indexLessonsWith,
  isUuid,
  loadCourseLessons,
  resolveServiceConfig,
  supabaseIndexStore,
  MAX_INDEX_LESSONS,
} from '../../utils/rag'

defineRouteMeta({
  openAPI: {
    summary: 'Indeks materi untuk AI tutor',
    description:
      'Memotong dan membuat embedding materi sebuah mata kuliah lalu menyimpannya ke `lesson_chunks` (pgvector). ' +
      'Hanya instruktur pengampu atau admin. Isi materi dibaca dari database; `lessons` hanya memilih materi mana yang diindeks. ' +
      'Butuh SUPABASE_SERVICE_ROLE_KEY.',
    tags: ['AI'],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['course_id'],
            properties: {
              course_id: { type: 'string', format: 'uuid' },
              lessons: {
                type: 'array',
                maxItems: 100,
                description: 'Materi yang diindeks (hanya `id` yang dipakai). Kosongkan untuk semua materi mata kuliah.',
                items: {
                  type: 'object',
                  required: ['id'],
                  properties: { id: { type: 'string' }, judul: { type: 'string' }, konten: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Hasil pengindeksan',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
                course_id: { type: 'string' },
                lessons: { type: 'integer', description: 'Materi yang diproses' },
                chunks: { type: 'integer', description: 'Total potongan materi' },
                embedded: { type: 'integer', description: 'Potongan baru/berubah yang di-embed' },
                unchanged: { type: 'integer', description: 'Potongan yang dilewati (tidak berubah)' },
                deleted_lessons: { type: 'integer', description: 'Materi yang potongan lamanya dihapus' },
                mode: { type: 'string', enum: ['api', 'local'], nullable: true },
                rejected: { type: 'array', items: { type: 'string' }, description: 'ID materi yang bukan milik mata kuliah ini' },
                warning: { type: 'string' },
              },
            },
          },
        },
      },
      400: { description: 'Input tidak valid' },
      401: { description: 'Belum login' },
      403: { description: 'Bukan instruktur pengampu / admin' },
      404: { description: 'Mata kuliah tidak ditemukan' },
      429: { description: 'Rate limit / batas harian token AI' },
      503: { description: 'Service role belum dikonfigurasi' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const session = requireAiRole(event, ['instructor', 'admin'])
  const body = await readBody<{ course_id?: unknown; lessons?: unknown }>(event)

  const courseId = typeof body?.course_id === 'string' ? body.course_id.trim() : ''
  if (!courseId) throw createError({ statusCode: 400, statusMessage: 'course_id wajib diisi.' })

  let onlyIds: string[] | undefined
  if (body?.lessons !== undefined) {
    if (!Array.isArray(body.lessons)) throw createError({ statusCode: 400, statusMessage: 'lessons harus berupa array.' })
    if (body.lessons.length > MAX_INDEX_LESSONS) {
      throw createError({ statusCode: 400, statusMessage: `Maksimal ${MAX_INDEX_LESSONS} materi per permintaan.` })
    }
    onlyIds = [
      ...new Set(
        (body.lessons as Array<{ id?: unknown }>)
          .map((l) => (typeof l?.id === 'string' ? l.id.trim() : ''))
          .filter(Boolean),
      ),
    ]
  }

  const config = useRuntimeConfig(event) as unknown as { supabaseServiceRoleKey?: string; public?: { supabaseUrl?: string } }
  const svc = resolveServiceConfig({
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey,
    url: config.public?.supabaseUrl,
  })
  if (!svc) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Indeks pgvector belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY). AI tutor tetap memakai materi langsung.',
    })
  }
  if (!isUuid(courseId)) throw createError({ statusCode: 400, statusMessage: 'course_id tidak valid.' })

  const db = createClient(svc.url, svc.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Ownership: the instructor must teach this course (admins may index any course).
  const { data: course, error: courseErr } = await db.from('courses').select('id, instructor_id').eq('id', courseId).maybeSingle()
  if (courseErr) throw createError({ statusCode: 500, statusMessage: `Gagal membaca mata kuliah: ${courseErr.message}` })
  if (!course) throw createError({ statusCode: 404, statusMessage: 'Mata kuliah tidak ditemukan.' })
  if (session.role !== 'admin' && course.instructor_id !== session.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak — Anda bukan pengampu mata kuliah ini.' })
  }

  let loaded
  try {
    loaded = await loadCourseLessons(db, courseId, onlyIds)
  } catch (err) {
    throw createError({ statusCode: 500, statusMessage: `Gagal membaca materi: ${(err as Error).message}` })
  }
  if (loaded.lessons.length > MAX_INDEX_LESSONS) {
    throw createError({ statusCode: 400, statusMessage: `Mata kuliah memiliki lebih dari ${MAX_INDEX_LESSONS} materi; kirim daftar lessons per bagian.` })
  }

  const ai = getAiConfig(event)
  try {
    const result = await indexLessonsWith(courseId, loaded.lessons, {
      embed: (texts) => embedTextsWith(ai, texts),
      expectedMode: ai.isDemo ? 'local' : 'api',
      store: supabaseIndexStore(db),
    })
    return { ok: true, ...result, rejected: loaded.rejected }
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status) throw err // 400 (too many chunks) / 429 (budget)
    throw createError({ statusCode: 500, statusMessage: `Gagal menyimpan indeks: ${(err as Error).message}` })
  }
})
