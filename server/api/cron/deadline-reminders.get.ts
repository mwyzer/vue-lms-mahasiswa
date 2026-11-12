/**
 * Deadline Reminders — GET /api/cron/deadline-reminders
 *
 * Creates an in-app "tenggat mendekat" notification for every student who has
 * an unsubmitted assignment due within the next N hours (default 24).
 * The work is done by the Postgres function `notify_upcoming_deadlines`
 * (see supabase/migration-prioritas-1.sql), which de-duplicates per assignment.
 * Also reminds reviewers of pending peer reviews via `notify_peer_review_deadlines`
 * (supabase/migration-prioritas-3-w3.sql) when that function exists.
 *
 * Triggered by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.
 *
 * Required env (server-only):
 *   CRON_SECRET                 — shared secret for this endpoint
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS)
 */
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

defineRouteMeta({
  openAPI: {
    summary: 'Deadline Reminders (Cron)',
    description:
      'Membuat notifikasi pengingat untuk tugas yang tenggatnya mendekat dan belum dikumpulkan. Dipanggil oleh Vercel Cron dengan header Authorization: Bearer CRON_SECRET.',
    tags: ['Cron'],
    parameters: [
      {
        in: 'query',
        name: 'hours',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 168, default: 24 },
        description: 'Jendela waktu (jam) sebelum tenggat.',
      },
    ],
    responses: {
      200: {
        description: 'Jumlah notifikasi yang dibuat',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ok: { type: 'boolean', example: true },
                created: { type: 'integer', example: 12 },
                hours: { type: 'integer', example: 24 },
              },
            },
          },
        },
      },
      401: { description: 'Secret tidak valid' },
      503: { description: 'CRON_SECRET atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi' },
    },
  },
})

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig(event)
    const secret = process.env.CRON_SECRET || config.cronSecret
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey
    const supabaseUrl = config.public.supabaseUrl

    // Fail closed: without a secret this endpoint must not be callable.
    if (!secret || !serviceKey || !supabaseUrl) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Cron belum dikonfigurasi (CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY).',
      })
    }

    const header = getHeader(event, 'authorization') || ''
    if (!safeEqual(header, `Bearer ${secret}`)) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const rawHours = Number(getQuery(event).hours ?? 24)
    const hours = Number.isFinite(rawHours) ? Math.min(168, Math.max(1, Math.floor(rawHours))) : 24

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase.rpc('notify_upcoming_deadlines', { p_hours: hours })
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Gagal membuat pengingat: ${error.message}` })
    }

    // Prioritas 3: peer review deadlines (function from migration-prioritas-3-w3.sql; optional).
    const peer = await supabase.rpc('notify_peer_review_deadlines', { p_hours: hours })
    if (peer.error) console.warn('notify_peer_review_deadlines skipped:', peer.error.message)

    return { ok: true, created: Number(data ?? 0), peer_created: peer.error ? 0 : Number(peer.data ?? 0), hours }
  }
)
