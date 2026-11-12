/**
 * GET /api/search?q=… — global search (Supabase mode of the GlobalSearch palette).
 *
 * Requires the `lms_session` cookie. Searches courses, lessons, quizzes,
 * assignments and forum threads the user may see (checked server-side, the
 * service role bypasses RLS). Lessons get a pgvector similarity boost when
 * chunks are indexed (see /api/ai/index-lessons); otherwise ranking is lexical.
 *
 * 503 when SUPABASE_SERVICE_ROLE_KEY is not set (demo) — the client then
 * searches its own store data instead.
 */
import { createClient } from '@supabase/supabase-js'
import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { embedTextsWith, getAiConfig, requireAiRole } from '../utils/ai'
import { checkRateLimit } from '../utils/rateLimiter'
import { resolveServiceConfig } from '../utils/rag'
import { runGlobalSearch, SEARCH_MAX_QUERY } from '../utils/globalSearch'

defineRouteMeta({
  openAPI: {
    summary: 'Pencarian global',
    description:
      'Mencari mata kuliah, materi, kuis, tugas, dan thread forum yang boleh dilihat pengguna. ' +
      'Ranking leksikal, ditambah kemiripan pgvector untuk materi bila indeks tersedia.',
    tags: ['Search'],
    parameters: [{ in: 'query', name: 'q', required: true, schema: { type: 'string', maxLength: SEARCH_MAX_QUERY } }],
    responses: {
      200: { description: '{ q, mode: "semantic" | "lexical", results: { id, type, title, subtitle?, to, icon, score }[] }' },
      400: { description: 'Query kosong atau terlalu panjang' },
      401: { description: 'Belum login' },
      429: { description: 'Rate limit' },
      503: { description: 'Service role key belum diset — klien memakai pencarian lokal' },
    },
  },
})

export default defineEventHandler(async (event) => {
  const session = requireAiRole(event, ['student', 'instructor', 'admin'])
  const raw = getQuery(event).q
  const q = typeof raw === 'string' ? raw.trim() : ''
  if (!q) throw createError({ statusCode: 400, statusMessage: 'Parameter q wajib diisi' })
  if (q.length > SEARCH_MAX_QUERY) throw createError({ statusCode: 400, statusMessage: `Query maksimal ${SEARCH_MAX_QUERY} karakter` })

  const limit = checkRateLimit(`search:${session.userId}`, { windowMs: 60_000, maxRequests: 60 })
  if (!limit.allowed) {
    setResponseHeader(event, 'retry-after', String(Math.ceil((limit.resetAt - Date.now()) / 1000)))
    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak pencarian. Coba lagi sebentar.' })
  }

  const config = useRuntimeConfig(event) as unknown as { supabaseServiceRoleKey?: string; public?: { supabaseUrl?: string } }
  const svc = resolveServiceConfig({
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey,
    url: config.public?.supabaseUrl,
  })
  if (!svc) throw createError({ statusCode: 503, statusMessage: 'Pencarian server belum dikonfigurasi' })
  const db = createClient(svc.url, svc.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const ai = getAiConfig(event)
  try {
    return await runGlobalSearch(db, { userId: session.userId, role: session.role }, q, {
      embed: (texts) => embedTextsWith(ai, texts),
    })
  } catch (err) {
    console.error('[Search] failed:', (err as Error)?.message ?? err)
    throw createError({ statusCode: 502, statusMessage: 'Pencarian gagal' })
  }
})
