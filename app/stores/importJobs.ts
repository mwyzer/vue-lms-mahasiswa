/**
 * Import Jobs Store — runs a validated student import and keeps a history.
 *
 * Demo mode : valid rows are added to the auth roster (authStore.addStudent).
 *             "Enrol" = the student gets the course's level + session, which
 *             is how enrolment works across the app.
 * Supabase  : rows are sent to POST /api/import/students, which re-validates,
 *             inserts profiles (+ enrollments) with the service role key and
 *             logs an `import_jobs` row. Without the key it answers 503.
 */
import { defineStore } from 'pinia'
import type { StudentImportData, ImportTargetCourse } from '~/utils/studentImport'
import type { StudentRosterEntry } from '~/types/roster'
import { useAuthStore } from './auth'

export interface ImportJob {
  id: string
  file_name: string
  course_id: string | null
  course_label: string | null
  total: number
  created: number
  failed: number
  mode: 'demo' | 'supabase'
  errors: { npm: string; error: string }[]
  created_at: string
}

export interface ImportOutcome {
  ok: boolean
  created: number
  failed: { npm: string; error: string }[]
  message?: string
}

const DEMO_JOBS: ImportJob[] = []
let demoSeq = 0

export const useImportJobsStore = defineStore('importJobs', {
  state: () => ({
    jobs: [] as ImportJob[],
    running: false,
    error: null as string | null,
  }),

  actions: {
    async importStudents(
      rows: StudentImportData[],
      opts: { fileName: string; course: (ImportTargetCourse & { label?: string }) | null },
    ): Promise<ImportOutcome> {
      const auth = useAuthStore()
      const ui = useUiStore()
      this.error = null
      this.running = true
      const failed: ImportOutcome['failed'] = []
      let created = 0

      try {
        if (ui.isDemoMode) {
          for (const r of rows) {
            // Re-check: the roster may have changed since the preview.
            if (auth.studentRoster.some((s) => s.npm.toLowerCase() === r.npm.toLowerCase())) {
              failed.push({ npm: r.npm, error: 'NPM sudah terdaftar.' })
              continue
            }
            const ok = await auth.addStudent({
              nama: r.nama,
              npm: r.npm,
              kelas: r.kelas,
              level: r.level,
              session_time: r.session_time,
            })
            if (ok) created++
            else failed.push({ npm: r.npm, error: auth.error || 'Gagal menambahkan.' })
          }
          const job: ImportJob = {
            id: `ij-demo-${Date.now()}-${++demoSeq}`,
            file_name: opts.fileName,
            course_id: opts.course?.id ?? null,
            course_label: opts.course?.label ?? null,
            total: rows.length,
            created,
            failed: failed.length,
            mode: 'demo',
            errors: failed,
            created_at: new Date().toISOString(),
          }
          DEMO_JOBS.unshift(job)
          this.jobs = [...DEMO_JOBS]
          return { ok: true, created, failed }
        }

        const res = await $fetch<{
          ok: boolean
          job_id: string | null
          created: StudentRosterEntry[]
          failed: { npm: string; error: string }[]
          enrolled: number
        }>('/api/import/students', {
          method: 'POST',
          body: { rows, course_id: opts.course?.id ?? null, file_name: opts.fileName },
        })

        for (const p of res.created) {
          if (!auth.students.some((s) => s.id === p.id)) auth.students.push(p)
        }
        this.jobs = [
          {
            id: res.job_id ?? `ij-${Date.now()}`,
            file_name: opts.fileName,
            course_id: opts.course?.id ?? null,
            course_label: opts.course?.label ?? null,
            total: rows.length,
            created: res.created.length,
            failed: res.failed.length,
            mode: 'supabase',
            errors: res.failed,
            created_at: new Date().toISOString(),
          },
          ...this.jobs,
        ]
        return { ok: true, created: res.created.length, failed: res.failed }
      } catch (err: any) {
        const msg = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Impor gagal.'
        this.error = msg
        return { ok: false, created, failed, message: msg }
      } finally {
        this.running = false
      }
    },

    /** Supabase: load the latest import jobs (RLS: own jobs, admin sees all). */
    async loadHistory() {
      if (useUiStore().isDemoMode) {
        this.jobs = [...DEMO_JOBS]
        return
      }
      try {
        const { data, error } = await useNuxtApp().$supabase
          .from('import_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (error) throw error
        this.jobs = (data || []).map((j: any) => ({
          id: j.id,
          file_name: j.file_name,
          course_id: j.course_id,
          course_label: null,
          total: j.total_rows,
          created: j.created_count,
          failed: j.failed_count,
          mode: 'supabase' as const,
          errors: Array.isArray(j.errors) ? j.errors : [],
          created_at: j.created_at,
        }))
      } catch (err) {
        console.error('Failed to load import history:', err)
      }
    },
  },
})
