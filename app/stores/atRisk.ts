/**
 * At-risk Store — "mahasiswa berisiko" dashboard data + interventions.
 *
 * - Builds one risk row per (enrolled student × course) from the existing
 *   assignments / quiz / attendance stores, using the pure functions in
 *   ~/utils/riskScore (weights configurable, persisted in localStorage).
 * - Interventions: "Kirim pengingat" (in-app notification to the student) and
 *   "Tandai sudah ditindaklanjuti" (follow-up note), both logged.
 *
 * Demo mode: interventions live in module memory (shared across demo logins in
 * one browser session); reminders go through notificationsStore.notifyUsers.
 * Supabase: table `risk_interventions` + RPC `send_risk_reminder`
 * (supabase/migration-prioritas-3-w4.sql) — the RPC inserts the notification,
 * because clients cannot insert into `notifications` directly (RLS).
 */
import { defineStore } from 'pinia'
import type { Course } from '~/types/database'
import {
  computeRiskScore,
  collectRiskSignals,
  latestActivityTimestamp,
  normalizeRiskWeights,
  validateRiskWeights,
  compareRisk,
  DEFAULT_RISK_WEIGHTS,
  type RiskResult,
  type RiskSignals,
  type RiskSource,
  type RiskWeights,
} from '~/utils/riskScore'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useAssignmentsStore } from './assignments'
import { useQuizStore } from './quiz'
import { useAttendanceStore } from './attendance'
import { useNotificationsStore } from './notifications'
import { courseCampusId, campusIdForUser } from './campus'

export type InterventionType = 'reminder' | 'followup'

export interface RiskIntervention {
  id: string
  course_id: string
  student_id: string
  actor_id: string
  actor_name?: string | null
  tipe: InterventionType
  catatan: string | null
  risk_score: number | null
  risk_level: string | null
  created_at: string
}

export interface AtRiskRow {
  key: string
  student_id: string
  nama: string
  npm: string
  kelas: string
  course_id: string
  course_kode: string
  course_nama: string
  instructor_id: string
  campus_id: string | null
  signals: RiskSignals
  risk: RiskResult
  lastReminder: RiskIntervention | null
  lastFollowUp: RiskIntervention | null
}

export const RISK_WEIGHTS_STORAGE_KEY = 'lms_risk_weights'

const DEMO_INTERVENTIONS: RiskIntervention[] = []
let demoSeq = 0

function newestFirst(a: { created_at: string }, b: { created_at: string }) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

/** Campus of a course: the row's campus_id, else the demo mapping. */
export function campusOfCourse(c: Pick<Course, 'id'> & { campus_id?: string | null }): string | null {
  return c.campus_id ?? courseCampusId(c.id)
}

interface AtRiskState {
  interventions: RiskIntervention[]
  weights: RiskWeights
  isDemoMode: boolean
  initialized: boolean
  loading: boolean
  error: string | null
}

export const useAtRiskStore = defineStore('atRisk', {
  state: (): AtRiskState => ({
    interventions: [],
    weights: { ...DEFAULT_RISK_WEIGHTS },
    isDemoMode: true,
    initialized: false,
    loading: false,
    error: null,
  }),

  getters: {
    /** Raw rows from the source stores (demo or Supabase cache). */
    source(): RiskSource {
      const assignments = useAssignmentsStore()
      const quiz = useQuizStore()
      const attendance = useAttendanceStore()
      const courses = useCoursesStore()
      return {
        assignments: assignments.isDemoMode ? assignments.assignments : assignments.sbAssignments,
        submissions: assignments.isDemoMode ? assignments.submissions : assignments.sbSubmissions,
        attendance: attendance.isDemoMode ? attendance.records : attendance.sbRecords,
        quizzes: quiz.quizzes,
        attempts: quiz.attempts,
        lessonProgress: courses.isDemoMode ? [] : courses.sbProgress,
      }
    },

    /**
     * Reference "now". Demo seed data is from a past semester, so demo mode
     * measures inactivity/deadlines against the latest recorded activity.
     */
    referenceNow(): number {
      if (!this.isDemoMode) return Date.now()
      return latestActivityTimestamp(this.source) ?? Date.now()
    },

    /** Risk rows for the given courses, highest risk first. */
    rowsForCourses(): (courseIds: string[]) => AtRiskRow[] {
      return (courseIds: string[]) => {
        const auth = useAuthStore()
        const courses = useCoursesStore().allCourses
        const src = this.source
        const now = this.referenceNow
        const wanted = new Set(courseIds)
        const rows: AtRiskRow[] = []

        for (const c of courses) {
          if (!wanted.has(c.id)) continue
          // Enrolment: same level + session lookup as the gradebook.
          const enrolled = auth.studentRoster.filter((s) => s.level === c.level && s.session_time === c.session_time)
          for (const s of enrolled) {
            const signals = collectRiskSignals(c.id, s.id, src, now)
            const risk = computeRiskScore(signals, { weights: this.weights, now })
            const mine = this.interventions.filter((i) => i.course_id === c.id && i.student_id === s.id)
            rows.push({
              key: `${c.id}:${s.id}`,
              student_id: s.id,
              nama: s.nama,
              npm: s.npm,
              kelas: s.kelas,
              course_id: c.id,
              course_kode: c.kode,
              course_nama: c.nama,
              instructor_id: c.instructor_id,
              campus_id: campusOfCourse(c) ?? s.campusId ?? campusIdForUser(s.id),
              signals,
              risk,
              lastReminder: mine.filter((i) => i.tipe === 'reminder').sort(newestFirst)[0] ?? null,
              lastFollowUp: mine.filter((i) => i.tipe === 'followup').sort(newestFirst)[0] ?? null,
            })
          }
        }
        return rows.sort(compareRisk)
      }
    },

    historyFor(): (courseId: string, studentId: string) => RiskIntervention[] {
      return (courseId: string, studentId: string) =>
        this.interventions.filter((i) => i.course_id === courseId && i.student_id === studentId).sort(newestFirst)
    },
  },

  actions: {
    async init() {
      await Promise.all([
        useAuthStore().init(),
        useCoursesStore().init(),
        useQuizStore().init(),
        useAttendanceStore().init(),
      ])
      await useAssignmentsStore().init()

      this.loadWeights()
      if (this.initialized) return
      this.isDemoMode = useUiStore().isDemoMode
      this.error = null

      if (!this.isDemoMode) {
        this.loading = true
        try {
          const { data, error } = await useNuxtApp().$supabase
            .from('risk_interventions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000)
          if (error) throw error
          this.interventions = (data || []) as RiskIntervention[]
        } catch (err: any) {
          // Migration not applied yet: the dashboard still works, without history.
          console.error('Failed to fetch risk interventions:', err)
          this.error = err?.message || 'Gagal memuat riwayat intervensi.'
          this.interventions = []
        } finally {
          this.loading = false
        }
      } else {
        this.interventions = [...DEMO_INTERVENTIONS]
      }
      this.initialized = true
    },

    loadWeights() {
      if (!import.meta.client) return
      try {
        const raw = localStorage.getItem(RISK_WEIGHTS_STORAGE_KEY)
        this.weights = normalizeRiskWeights(raw ? JSON.parse(raw) : null)
      } catch {
        this.weights = { ...DEFAULT_RISK_WEIGHTS }
      }
    },

    /** Save the signal weights. Returns an error message or null. */
    setWeights(w: RiskWeights): string | null {
      const err = validateRiskWeights(w)
      if (err) return err
      this.weights = normalizeRiskWeights(w)
      if (import.meta.client) {
        try { localStorage.setItem(RISK_WEIGHTS_STORAGE_KEY, JSON.stringify(this.weights)) } catch { /* ignore */ }
      }
      return null
    },

    resetWeights() {
      this.weights = { ...DEFAULT_RISK_WEIGHTS }
      if (import.meta.client) {
        try { localStorage.removeItem(RISK_WEIGHTS_STORAGE_KEY) } catch { /* ignore */ }
      }
    },

    _addLocal(row: AtRiskRow, tipe: InterventionType, catatan: string | null): RiskIntervention {
      const auth = useAuthStore()
      const item: RiskIntervention = {
        id: `ri-demo-${Date.now()}-${++demoSeq}`,
        course_id: row.course_id,
        student_id: row.student_id,
        actor_id: auth.user?.id ?? 'unknown',
        actor_name: auth.user?.nama ?? null,
        tipe,
        catatan,
        risk_score: row.risk.score,
        risk_level: row.risk.level,
        created_at: new Date().toISOString(),
      }
      DEMO_INTERVENTIONS.push(item)
      this.interventions = [...DEMO_INTERVENTIONS]
      return item
    },

    /** Send an in-app reminder to the student and log it. */
    async sendReminder(row: AtRiskRow, message: string): Promise<boolean> {
      this.error = null
      const pesan = message.trim().slice(0, 1000)
      if (!pesan) {
        this.error = 'Pesan pengingat tidak boleh kosong.'
        return false
      }
      const judul = `Pengingat dari dosen: ${row.course_kode} ${row.course_nama}`

      if (this.isDemoMode) {
        useNotificationsStore().notifyUsers([row.student_id], {
          tipe: 'sistem',
          judul,
          pesan,
          link: `/courses/${row.course_id}`,
        })
        this._addLocal(row, 'reminder', pesan)
        return true
      }

      try {
        const { data, error } = await useNuxtApp().$supabase.rpc('send_risk_reminder', {
          p_course_id: row.course_id,
          p_student_id: row.student_id,
          p_judul: judul,
          p_pesan: pesan,
          p_risk_score: row.risk.score,
          p_risk_level: row.risk.level,
        })
        if (error) throw error
        if (data) this.interventions = [data as RiskIntervention, ...this.interventions]
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal mengirim pengingat.'
        return false
      }
    },

    /** Record that the instructor followed up (note optional). */
    async markFollowedUp(row: AtRiskRow, note: string): Promise<boolean> {
      this.error = null
      const catatan = note.trim().slice(0, 2000) || null

      if (this.isDemoMode) {
        this._addLocal(row, 'followup', catatan)
        return true
      }

      try {
        const auth = useAuthStore()
        const { data, error } = await useNuxtApp().$supabase
          .from('risk_interventions')
          .insert({
            course_id: row.course_id,
            student_id: row.student_id,
            actor_id: auth.user?.id,
            actor_name: auth.user?.nama ?? null,
            tipe: 'followup',
            catatan,
            risk_score: row.risk.score,
            risk_level: row.risk.level,
          })
          .select()
          .single()
        if (error) throw error
        this.interventions = [data as RiskIntervention, ...this.interventions]
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menyimpan tindak lanjut.'
        return false
      }
    },
  },
})
