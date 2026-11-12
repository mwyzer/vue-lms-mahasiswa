/**
 * At-risk digest — GET /api/cron/at-risk
 *
 * For every course, computes each enrolled student's risk score with the same
 * pure function as the dashboard (app/utils/riskScore.ts, default weights) and
 * sends the course instructor one in-app notification listing the students at
 * level "tinggi" (or ≥ `min_level`). De-duplicated per course per day via
 * `dedupe_key = at-risk:<course>:<YYYY-MM-DD>`.
 *
 * Triggered by Vercel Cron (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Same requirements and fail-closed behaviour as /api/cron/deadline-reminders.
 */
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { computeRiskScore, collectRiskSignals, type RiskLevel } from '../../../app/utils/riskScore'

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

defineRouteMeta({
  openAPI: {
    summary: 'At-risk digest (Cron)',
    description:
      'Menghitung skor risiko mahasiswa per mata kuliah dan mengirim notifikasi ringkasan ke dosen pengampu. Dipanggil oleh Vercel Cron dengan header Authorization: Bearer CRON_SECRET.',
    tags: ['Cron'],
    parameters: [
      {
        in: 'query',
        name: 'min_level',
        required: false,
        schema: { type: 'string', enum: ['sedang', 'tinggi'], default: 'tinggi' },
        description: 'Level minimum yang dilaporkan.',
      },
    ],
    responses: {
      200: { description: '{ ok, courses, flagged, notified }' },
      401: { description: 'Secret tidak valid' },
      503: { description: 'CRON_SECRET atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi' },
    },
  },
})

/** Fetch a whole table in pages of 1000 rows (PostgREST default limit). */
async function fetchAll(supabase: any, table: string, columns: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) throw createError({ statusCode: 500, statusMessage: `Gagal membaca ${table}: ${error.message}` })
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = process.env.CRON_SECRET || config.cronSecret
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey
  const supabaseUrl = config.public.supabaseUrl

  if (!secret || !serviceKey || !supabaseUrl) {
    throw createError({ statusCode: 503, statusMessage: 'Cron belum dikonfigurasi (CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY).' })
  }
  if (!safeEqual(getHeader(event, 'authorization') || '', `Bearer ${secret}`)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const minLevel: RiskLevel = getQuery(event).min_level === 'sedang' ? 'sedang' : 'tinggi'
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const [courses, enrollments, profiles, assignments, submissions, attendance, quizzes, attempts] = await Promise.all([
    fetchAll(supabase, 'courses', 'id, kode, nama, instructor_id'),
    fetchAll(supabase, 'enrollments', 'student_id, course_id'),
    fetchAll(supabase, 'profiles', 'id, nama, role'),
    fetchAll(supabase, 'assignments', 'id, course_id, tenggat_waktu, judul'),
    fetchAll(supabase, 'submissions', 'assignment_id, student_id, submitted_at, nilai'),
    fetchAll(supabase, 'attendance', 'course_id, student_id, status, tanggal'),
    fetchAll(supabase, 'quizzes', 'id, course_id, judul'),
    fetchAll(supabase, 'quiz_attempts', 'quiz_id, student_id, percentage, submitted_at'),
  ])

  const names = new Map(profiles.map((p: any) => [p.id, p.nama]))
  const src = { assignments, submissions, attendance, quizzes, attempts }
  const now = Date.now()
  const today = new Date(now).toISOString().slice(0, 10)
  const notifications: any[] = []
  let flagged = 0

  for (const c of courses) {
    const students = enrollments.filter((e: any) => e.course_id === c.id).map((e: any) => e.student_id)
    const hits: { nama: string; score: number }[] = []
    for (const sid of students) {
      const risk = computeRiskScore(collectRiskSignals(c.id, sid, src, now), { now })
      if (risk.level === 'tinggi' || (minLevel === 'sedang' && risk.level === 'sedang')) {
        hits.push({ nama: names.get(sid) || 'Mahasiswa', score: risk.score })
      }
    }
    if (hits.length === 0 || !c.instructor_id) continue
    flagged += hits.length
    hits.sort((a, b) => b.score - a.score)
    const top = hits.slice(0, 5).map((h) => `${h.nama} (${h.score})`).join(', ')
    notifications.push({
      user_id: c.instructor_id,
      tipe: 'sistem',
      judul: `${hits.length} mahasiswa berisiko ${minLevel === 'sedang' ? 'sedang/tinggi' : 'tinggi'} di ${c.kode}`,
      pesan: `${c.nama}: ${top}${hits.length > 5 ? `, +${hits.length - 5} lainnya` : ''}`,
      link: `/instructor/at-risk?course=${c.id}`,
      dedupe_key: `at-risk:${c.id}:${today}`,
    })
  }

  let notified = 0
  if (notifications.length) {
    const { data, error } = await supabase
      .from('notifications')
      .upsert(notifications, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      .select('id')
    if (error) throw createError({ statusCode: 500, statusMessage: `Gagal membuat notifikasi: ${error.message}` })
    notified = data?.length ?? 0
  }

  return { ok: true, courses: courses.length, flagged, notified, min_level: minLevel }
})
