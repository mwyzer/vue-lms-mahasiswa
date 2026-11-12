/**
 * Student Import — POST /api/import/students   (Supabase mode only)
 *
 * Body: { rows: { nama, npm, kelas?, level?, session_time?|sesi?, email? }[], course_id?, file_name? }
 *
 * The client previews/validates first (app/utils/studentImport.ts); this
 * endpoint validates every row again with the same function, skips NPM/email
 * already in `profiles`, inserts the new student profiles, optionally enrols
 * them into `course_id` (and gives them the course's level + session), and
 * logs an `import_jobs` row. Uses the service role key, so it answers 503 when
 * that key is not configured — demo mode never calls it.
 *
 * Guards: instructor/admin session cookie; an instructor may only enrol into a
 * course they teach. (Demo system: the session cookie itself is not verified
 * against Supabase Auth — see docs/12-prioritas-2.md "Batasan".)
 */
import { createClient } from '@supabase/supabase-js'
import { validateStudentRecord, MAX_IMPORT_ROWS, type ImportTargetCourse } from '../../../app/utils/studentImport'

defineRouteMeta({
  openAPI: {
    summary: 'Impor mahasiswa (CSV → Supabase)',
    description:
      'Menambahkan mahasiswa hasil impor CSV ke tabel profiles (service role), opsional enroll ke satu mata kuliah, dan mencatat import_jobs. Hanya instruktur/admin.',
    tags: ['Instructor', 'Admin'],
    responses: {
      200: { description: '{ ok, job_id, created[], failed[], enrolled }' },
      400: { description: 'Payload tidak valid' },
      403: { description: 'Bukan instruktur/admin, atau bukan pengampu mata kuliah' },
      503: { description: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi' },
    },
  },
})

interface IncomingRow {
  nama?: unknown
  npm?: unknown
  kelas?: unknown
  level?: unknown
  session_time?: unknown
  sesi?: unknown
  email?: unknown
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v)).slice(0, 300)

export default defineEventHandler(async (event) => {
  const session = parseSessionCookie(getCookie(event, 'lms_session'))
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Belum login.' })
  if (session.role !== 'instructor' && session.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Hanya instruktur/admin yang boleh mengimpor.' })
  }

  const config = useRuntimeConfig(event)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey
  const supabaseUrl = config.public.supabaseUrl
  if (!serviceKey || !supabaseUrl) {
    throw createError({ statusCode: 503, statusMessage: 'Impor Supabase belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY).' })
  }

  const body = await readBody<{ rows?: IncomingRow[]; course_id?: string | null; file_name?: string }>(event)
  const rows = Array.isArray(body?.rows) ? body.rows : null
  if (!rows || rows.length === 0) throw createError({ statusCode: 400, statusMessage: 'rows wajib berisi minimal 1 baris.' })
  if (rows.length > MAX_IMPORT_ROWS) throw createError({ statusCode: 400, statusMessage: `Maksimal ${MAX_IMPORT_ROWS} baris.` })

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Target course (optional)
  let course: ImportTargetCourse | null = null
  const courseId = body.course_id ? String(body.course_id) : null
  if (courseId) {
    const { data, error } = await supabase.from('courses').select('id, kode, level, session_time, instructor_id').eq('id', courseId).maybeSingle()
    if (error || !data) throw createError({ statusCode: 400, statusMessage: 'Mata kuliah tidak ditemukan.' })
    if (session.role === 'instructor' && data.instructor_id !== session.userId) {
      throw createError({ statusCode: 403, statusMessage: 'Anda bukan pengampu mata kuliah ini.' })
    }
    course = { id: data.id, kode: data.kode, level: data.level, session_time: data.session_time }
  }

  // Re-validate every row with the same rules as the client preview.
  const failed: { npm: string; error: string }[] = []
  const valid: ReturnType<typeof validateStudentRecord>['data'][] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const raw = {
      nama: str(r?.nama),
      npm: str(r?.npm),
      kelas: str(r?.kelas),
      level: str(r?.level),
      sesi: str(r?.sesi ?? r?.session_time),
      email: str(r?.email),
    }
    const res = validateStudentRecord(raw, course)
    if (!res.data) {
      failed.push({ npm: raw.npm, error: res.errors.join(' ') })
      continue
    }
    const key = res.data.npm.toLowerCase()
    if (seen.has(key)) {
      failed.push({ npm: raw.npm, error: 'NPM ganda di dalam file.' })
      continue
    }
    seen.add(key)
    valid.push(res.data)
  }

  // Skip NPM / email that already exist.
  const npms = valid.map((v) => v!.npm)
  const emails = valid.map((v) => v!.email).filter(Boolean) as string[]
  const existingNpm = new Set<string>()
  const existingEmail = new Set<string>()
  if (npms.length) {
    const { data } = await supabase.from('profiles').select('npm').in('npm', npms)
    for (const p of data || []) if (p.npm) existingNpm.add(String(p.npm).toLowerCase())
  }
  if (emails.length) {
    const { data } = await supabase.from('profiles').select('email').in('email', emails)
    for (const p of data || []) if (p.email) existingEmail.add(String(p.email).toLowerCase())
  }

  const toInsert = valid.filter((v) => {
    if (existingNpm.has(v!.npm.toLowerCase())) {
      failed.push({ npm: v!.npm, error: 'NPM sudah terdaftar.' })
      return false
    }
    if (v!.email && existingEmail.has(v!.email)) {
      failed.push({ npm: v!.npm, error: 'Email sudah dipakai.' })
      return false
    }
    return true
  })

  let created: any[] = []
  if (toInsert.length) {
    const { data, error } = await supabase
      .from('profiles')
      .insert(toInsert.map((v) => ({
        role: 'student',
        nama: v!.nama,
        npm: v!.npm,
        kelas: v!.kelas,
        level: v!.level,
        session_time: v!.session_time,
        email: v!.email,
      })))
      .select('id, nama, npm, kelas, level, session_time, avatar_url, campus_id')
    if (error) throw createError({ statusCode: 500, statusMessage: `Gagal menyimpan mahasiswa: ${error.message}` })
    created = data || []
  }

  let enrolled = 0
  if (course && created.length) {
    const { error, count } = await supabase
      .from('enrollments')
      .upsert(created.map((p) => ({ student_id: p.id, course_id: course!.id })), { onConflict: 'student_id,course_id', ignoreDuplicates: true, count: 'exact' })
    if (error) failed.push({ npm: '*', error: `Mahasiswa tersimpan, tetapi enroll gagal: ${error.message}` })
    else enrolled = count ?? created.length
  }

  // Log the job (best effort: the table may not exist before the migration).
  let jobId: string | null = null
  const { data: job } = await supabase
    .from('import_jobs')
    .insert({
      actor_id: session.userId,
      actor_role: session.role,
      kind: 'students',
      file_name: str(body.file_name || 'impor.csv').slice(0, 255),
      course_id: course?.id ?? null,
      total_rows: rows.length,
      created_count: created.length,
      failed_count: failed.length,
      errors: failed.slice(0, 500),
    })
    .select('id')
    .maybeSingle()
  jobId = job?.id ?? null

  return {
    ok: true,
    job_id: jobId,
    enrolled,
    failed,
    created: created.map((p) => ({
      id: p.id,
      nama: p.nama,
      npm: p.npm,
      kelas: p.kelas,
      level: p.level,
      session_time: p.session_time,
      avatar_url: p.avatar_url ?? null,
      campusId: p.campus_id ?? null,
    })),
  }
})
