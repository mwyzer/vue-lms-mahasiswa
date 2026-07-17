/**
 * Attendance Store — Manages student attendance/presensi records.
 *
 * Features:
 * - Record attendance per course, per meeting (instructor)
 * - View attendance history (student & instructor)
 * - Demo mode + Supabase production mode
 */
import { defineStore } from 'pinia'
import type { Attendance } from '~/types/database'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'

// ── Demo Data ──
const DEMO_ATTENDANCE: Attendance[] = [
  // Course c1 (Pemrograman Dasar) — 3 pertemuan
  { id: 'at1', course_id: 'c1', student_id: 's1', instructor_id: 'i1', tanggal: '2025-09-02', status: 'hadir', pertemuan: 1, created_at: '2025-09-02T00:00:00Z', updated_at: '2025-09-02T00:00:00Z' },
  { id: 'at2', course_id: 'c1', student_id: 's2', instructor_id: 'i1', tanggal: '2025-09-02', status: 'hadir', pertemuan: 1, created_at: '2025-09-02T00:00:00Z', updated_at: '2025-09-02T00:00:00Z' },
  { id: 'at3', course_id: 'c1', student_id: 's3', instructor_id: 'i1', tanggal: '2025-09-02', status: 'izin', pertemuan: 1, keterangan: 'Ada acara keluarga', created_at: '2025-09-02T00:00:00Z', updated_at: '2025-09-02T00:00:00Z' },
  { id: 'at4', course_id: 'c1', student_id: 's1', instructor_id: 'i1', tanggal: '2025-09-09', status: 'hadir', pertemuan: 2, created_at: '2025-09-09T00:00:00Z', updated_at: '2025-09-09T00:00:00Z' },
  { id: 'at5', course_id: 'c1', student_id: 's2', instructor_id: 'i1', tanggal: '2025-09-09', status: 'alpha', pertemuan: 2, created_at: '2025-09-09T00:00:00Z', updated_at: '2025-09-09T00:00:00Z' },
  { id: 'at6', course_id: 'c1', student_id: 's3', instructor_id: 'i1', tanggal: '2025-09-09', status: 'hadir', pertemuan: 2, created_at: '2025-09-09T00:00:00Z', updated_at: '2025-09-09T00:00:00Z' },
  { id: 'at7', course_id: 'c1', student_id: 's1', instructor_id: 'i1', tanggal: '2025-09-16', status: 'sakit', pertemuan: 3, keterangan: 'Demam', created_at: '2025-09-16T00:00:00Z', updated_at: '2025-09-16T00:00:00Z' },
  { id: 'at8', course_id: 'c1', student_id: 's2', instructor_id: 'i1', tanggal: '2025-09-16', status: 'hadir', pertemuan: 3, created_at: '2025-09-16T00:00:00Z', updated_at: '2025-09-16T00:00:00Z' },
  { id: 'at9', course_id: 'c1', student_id: 's3', instructor_id: 'i1', tanggal: '2025-09-16', status: 'hadir', pertemuan: 3, created_at: '2025-09-16T00:00:00Z', updated_at: '2025-09-16T00:00:00Z' },
  // Course c2 (Matematika Diskrit) — 2 pertemuan
  { id: 'at10', course_id: 'c2', student_id: 's4', instructor_id: 'i2', tanggal: '2025-09-03', status: 'hadir', pertemuan: 1, created_at: '2025-09-03T00:00:00Z', updated_at: '2025-09-03T00:00:00Z' },
  { id: 'at11', course_id: 'c2', student_id: 's5', instructor_id: 'i2', tanggal: '2025-09-03', status: 'alpha', pertemuan: 1, created_at: '2025-09-03T00:00:00Z', updated_at: '2025-09-03T00:00:00Z' },
  { id: 'at12', course_id: 'c2', student_id: 's4', instructor_id: 'i2', tanggal: '2025-09-10', status: 'hadir', pertemuan: 2, created_at: '2025-09-10T00:00:00Z', updated_at: '2025-09-10T00:00:00Z' },
  { id: 'at13', course_id: 'c2', student_id: 's5', instructor_id: 'i2', tanggal: '2025-09-10', status: 'sakit', pertemuan: 2, keterangan: 'Flu', created_at: '2025-09-10T00:00:00Z', updated_at: '2025-09-10T00:00:00Z' },
]

const DEMO_COURSE_NAMES: Record<string, string> = {
  'c1': 'Pemrograman Dasar',
  'c2': 'Matematika Diskrit',
  'c5': 'Struktur Data',
  'c8': 'Pemrograman Berorientasi Objek',
}

interface AttendanceState {
  records: Attendance[]
  loading: boolean
  error: string | null
  demoVersion: number
  isDemoMode: boolean
  initialized: boolean
  sbRecords: Attendance[]
}

export const useAttendanceStore = defineStore('attendance', {
  state: (): AttendanceState => ({
    records: [],
    loading: false,
    error: null,
    demoVersion: 0,
    isDemoMode: true,
    initialized: false,
    sbRecords: [],
  }),

  getters: {
    /** All attendance records with student names */
    allRecords(): (Attendance & { student_name?: string; student_npm?: string; course_name?: string })[] {
      const store = useAttendanceStore()
      void store.demoVersion
      const records = store.isDemoMode ? DEMO_ATTENDANCE : store.sbRecords
      const auth = useAuthStore()
      const roster = auth.studentRoster

      return records.map(r => ({
        ...r,
        student_name: roster.find(s => s.id === r.student_id)?.nama || '',
        student_npm: roster.find(s => s.id === r.student_id)?.npm || '',
        course_name: DEMO_COURSE_NAMES[r.course_id] || '',
      }))
    },

    /** Records for a specific course */
    recordsByCourse(): (courseId: string) => ReturnType<typeof useAttendanceStore['allRecords']> {
      return (courseId: string) =>
        this.allRecords.filter(r => r.course_id === courseId)
          .sort((a, b) => b.pertemuan - a.pertemuan || new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    },

    /** Records for a specific student */
    recordsByStudent(): (studentId: string) => ReturnType<typeof useAttendanceStore['allRecords']> {
      return (studentId: string) =>
        this.allRecords.filter(r => r.student_id === studentId)
          .sort((a, b) => b.pertemuan - a.pertemuan || new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    },

    /** Records for a specific course + pertemuan */
    recordsByMeeting(): (courseId: string, pertemuan: number) => ReturnType<typeof useAttendanceStore['allRecords']> {
      return (courseId: string, pertemuan: number) =>
        this.allRecords.filter(r => r.course_id === courseId && r.pertemuan === pertemuan)
    },

    /** Summary: total meetings for a course */
    totalMeetings(): (courseId: string) => number {
      return (courseId: string) => {
        const records = this.isDemoMode ? DEMO_ATTENDANCE : this.sbRecords
        const meetings = new Set(records.filter(r => r.course_id === courseId).map(r => r.pertemuan))
        return meetings.size
      }
    },

    /** Summary: attendance stats for a student in a course */
    studentStats(): (studentId: string, courseId: string) => {
      total: number; hadir: number; izin: number; sakit: number; alpha: number; persentase: number
    } {
      return (studentId: string, courseId: string) => {
        const records = this.recordsByCourse(courseId).filter(r => r.student_id === studentId)
        const hadir = records.filter(r => r.status === 'hadir').length
        const izin = records.filter(r => r.status === 'izin').length
        const sakit = records.filter(r => r.status === 'sakit').length
        const alpha = records.filter(r => r.status === 'alpha').length
        const total = records.length
        return {
          total, hadir, izin, sakit, alpha,
          persentase: total > 0 ? Math.round((hadir / total) * 100) : 0,
        }
      }
    },
  },

  actions: {
    init() {
      if (this.initialized) return
      const config = useRuntimeConfig()
      this.isDemoMode = config.public.demoMode !== 'false'

      if (!this.isDemoMode) {
        // Production: fetch from Supabase
        this.loading = true
        const supabase = useNuxtApp().$supabase
        supabase.from('attendance').select('*').order('tanggal', { ascending: false })
          .then(({ data }) => {
            if (data) this.sbRecords = data as Attendance[]
          })
          .catch(err => {
            console.error('Failed to fetch attendance:', err)
            this.isDemoMode = true
          })
          .finally(() => { this.loading = false })
      }

      this.initialized = true
    },

    /**
     * Record or update attendance for a student in a meeting.
     */
    async setAttendance(data: {
      course_id: string
      student_id: string
      instructor_id: string
      tanggal: string
      status: 'hadir' | 'izin' | 'sakit' | 'alpha'
      pertemuan: number
      keterangan?: string
    }) {
      if (this.isDemoMode) {
        const existing = DEMO_ATTENDANCE.findIndex(
          r => r.course_id === data.course_id && r.student_id === data.student_id && r.pertemuan === data.pertemuan
        )
        const now = new Date().toISOString()
        if (existing >= 0) {
          DEMO_ATTENDANCE[existing] = {
            ...DEMO_ATTENDANCE[existing],
            status: data.status,
            tanggal: data.tanggal,
            keterangan: data.keterangan || null,
            updated_at: now,
          }
        } else {
          DEMO_ATTENDANCE.push({
            id: `at${Date.now()}`,
            course_id: data.course_id,
            student_id: data.student_id,
            instructor_id: data.instructor_id,
            tanggal: data.tanggal,
            status: data.status,
            pertemuan: data.pertemuan,
            keterangan: data.keterangan || null,
            created_at: now,
            updated_at: now,
          })
        }
        this.demoVersion++
        return true
      }

      // Production: upsert into Supabase
      try {
        const supabase = useNuxtApp().$supabase
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('course_id', data.course_id)
          .eq('student_id', data.student_id)
          .eq('pertemuan', data.pertemuan)
          .maybeSingle()

        if (existing) {
          await supabase.from('attendance').update({
            status: data.status,
            tanggal: data.tanggal,
            keterangan: data.keterangan || null,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
        } else {
          await supabase.from('attendance').insert({
            course_id: data.course_id,
            student_id: data.student_id,
            instructor_id: data.instructor_id,
            tanggal: data.tanggal,
            status: data.status,
            pertemuan: data.pertemuan,
            keterangan: data.keterangan || null,
          })
        }
        return true
      } catch (err) {
        console.error('Failed to save attendance:', err)
        return false
      }
    },

    /**
     * Get attendance for a whole class in a single meeting.
     * Returns records for all students, with defaults for unrecorded ones.
     */
    async getOrCreateMeetingAttendance(courseId: string, pertemuan: number, tanggal: string): Promise<Attendance[]> {
      const auth = useAuthStore()
      await auth.init()

      // Use all students (instructor can filter by course)
      const allStudents = auth.studentRoster

      const existing = this.isDemoMode
        ? DEMO_ATTENDANCE.filter(r => r.course_id === courseId && r.pertemuan === pertemuan)
        : this.sbRecords.filter(r => r.course_id === courseId && r.pertemuan === pertemuan)

      return allStudents.map(s => {
        const record = existing.find(r => r.student_id === s.id)
        return record || {
          id: '',
          course_id: courseId,
          student_id: s.id,
          instructor_id: auth.user?.id || '',
          tanggal,
          status: '' as Attendance['status'],
          pertemuan,
          keterangan: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      })
    },
  },
})
