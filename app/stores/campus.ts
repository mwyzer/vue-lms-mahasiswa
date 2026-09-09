/**
 * Campus Store — Manages campus/institution entities (multi-campus).
 *
 * A campus is a branch of the institution. Users (students, instructors)
 * and courses can be tagged with a campus so admin views can scope their
 * data per campus. Demo mode ships two campuses.
 *
 * Features:
 * - Demo mode + Supabase production mode
 * - Pure helpers (campusIdForUser, courseCampusId, campusNameOf, filterByCampus)
 * - Admin CRUD for campus entities
 * - Per-campus counts for admin scoping views
 */
import { defineStore } from 'pinia'
import type { Campus } from '~/types/database'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'

// ── Demo data (fallback when demoMode=true) ──────────
export const DEMO_CAMPUSES: Campus[] = [
  {
    id: 'camp-utama',
    kode: 'KPU',
    nama: 'Kampus Utama',
    alamat: 'Jl. Pendidikan No. 1, Jakarta',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'camp-satelit',
    kode: 'KPS',
    nama: 'Kampus Satelit',
    alamat: 'Jl. Teknologi No. 2, Bandung',
    created_at: '',
    updated_at: '',
  },
]

/** Demo user → campus assignment (students s1..s17, instructors i1..i3). */
export const DEMO_USER_CAMPUS: Record<string, string> = {
  s1: 'camp-utama', s2: 'camp-utama', s3: 'camp-utama', s4: 'camp-utama',
  s5: 'camp-utama', s6: 'camp-utama', s7: 'camp-utama', s8: 'camp-utama',
  s9: 'camp-satelit', s10: 'camp-satelit', s11: 'camp-satelit', s12: 'camp-satelit',
  s13: 'camp-satelit', s14: 'camp-satelit', s15: 'camp-satelit', s16: 'camp-satelit',
  s17: 'camp-satelit',
  i1: 'camp-utama', i2: 'camp-satelit', i3: 'camp-utama',
}

/** Demo course → campus assignment (c1..c8 utama, c9..c15 satelit). */
export const DEMO_COURSE_CAMPUS: Record<string, string> = {
  c1: 'camp-utama', c2: 'camp-utama', c3: 'camp-utama', c4: 'camp-utama',
  c5: 'camp-utama', c6: 'camp-utama', c7: 'camp-utama', c8: 'camp-utama',
  c9: 'camp-satelit', c10: 'camp-satelit', c11: 'camp-satelit', c12: 'camp-satelit',
  c13: 'camp-satelit', c14: 'camp-satelit', c15: 'camp-satelit',
}

// ── Pure helpers ──

/**
 * Resolve the demo campus for a user id (student/instructor).
 * Returns null when unknown (e.g. admin or a user without a campus).
 */
export function campusIdForUser(userId: string): string | null {
  return DEMO_USER_CAMPUS[userId] ?? null
}

/**
 * Resolve the demo campus for a course id.
 */
export function courseCampusId(courseId: string): string | null {
  return DEMO_COURSE_CAMPUS[courseId] ?? null
}

/**
 * Look up a campus display name from a list of campuses.
 * Falls back to `—` for null/unknown campuses.
 */
export function campusNameOf(campuses: Campus[], campusId: string | null | undefined): string {
  if (!campusId) return '—'
  return campuses.find((c) => c.id === campusId)?.nama ?? '—'
}

/**
 * Filter an item list by campus using a resolver.
 * A null/empty campusId returns every item (no scoping).
 */
export function filterByCampus<T>(
  items: T[],
  campusId: string | null | undefined,
  resolver: (item: T) => string | null,
): T[] {
  if (!campusId) return [...items]
  return items.filter((item) => resolver(item) === campusId)
}

/** Default resolver for demo students/instructors. */
export function demoUserCampusResolver(item: { id: string }): string | null {
  return campusIdForUser(item.id)
}

/** Default resolver for demo courses. */
export function demoCourseCampusResolver(item: { id: string }): string | null {
  return courseCampusId(item.id)
}

/** Resolver for Supabase roster entries (reads campusId from the row). */
export function rosterCampusResolver(item: { campusId?: string | null }): string | null {
  return item.campusId ?? null
}

/** Resolver for Supabase course rows (reads campus_id from the row). */
export function courseRowCampusResolver(item: { campus_id?: string | null }): string | null {
  return item.campus_id ?? null
}

export interface CampusCounts {
  campusId: string
  students: number
  instructors: number
  courses: number
}

interface CampusState {
  campuses: Campus[]
  currentCampusId: string | null
  loading: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
  sbCampuses: Campus[]
}

export const useCampusStore = defineStore('campus', {
  state: (): CampusState => ({
    campuses: [],
    currentCampusId: null,
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
    sbCampuses: [],
  }),

  getters: {
    allCampuses(): Campus[] {
      return this.isDemoMode ? this.campuses : this.sbCampuses
    },

    campusCount(): number {
      return this.allCampuses.length
    },

    currentCampus(): Campus | null {
      if (!this.currentCampusId) return null
      return this.allCampuses.find((c) => c.id === this.currentCampusId) ?? null
    },

    /**
     * Per-campus headcounts across the auth roster and course store.
     * Uses demo maps in demo mode, row fields in Supabase mode.
     */
    campusCounts(): CampusCounts[] {
      const auth = useAuthStore()
      const courses = useCoursesStore()

      const students = auth.studentRoster
      const instructors = auth.instructorList
      const courseList = courses.allCourses

      const studentResolver = this.isDemoMode ? demoUserCampusResolver : rosterCampusResolver
      const instructorResolver = this.isDemoMode ? demoUserCampusResolver : rosterCampusResolver
      const courseResolver = this.isDemoMode ? demoCourseCampusResolver : courseRowCampusResolver

      return this.allCampuses.map((cam) => ({
        campusId: cam.id,
        students: students.filter((s) => studentResolver(s) === cam.id).length,
        instructors: instructors.filter((i) => instructorResolver(i) === cam.id).length,
        courses: courseList.filter((c) => courseResolver(c as any) === cam.id).length,
      }))
    },
  },

  actions: {
    /**
     * Initialize store: fetch campuses from Supabase in production mode.
     */
    async init() {
      if (this.initialized) return
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          this.loading = true

          const { data, error } = await supabase.from('campuses').select('*').order('nama')
          if (error) throw error
          if (data) this.sbCampuses = data as Campus[]

          if (this.sbCampuses.length === 0) {
            console.warn('Supabase returned zero campuses — falling back to demo data.')
            this.isDemoMode = true
          }
        } catch (err) {
          console.error('Failed to fetch campuses from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      if (this.isDemoMode) {
        this.campuses = [...DEMO_CAMPUSES]
      }

      this.initialized = true
    },

    /**
     * Set the active campus scope (admin filter). null clears the filter.
     */
    selectCampus(campusId: string | null) {
      this.currentCampusId = campusId
    },

    /** Sync demo data into reactive state. */
    _syncDemo() {
      if (this.isDemoMode) {
        this.campuses = [...DEMO_CAMPUSES]
      }
    },

    /**
     * Add a new campus (admin).
     */
    async addCampus(data: { kode: string; nama: string; alamat?: string }): Promise<boolean> {
      this.error = null
      if (!this.initialized) await this.init()

      if (!data.kode.trim() || !data.nama.trim()) {
        this.error = 'Kode dan nama kampus harus diisi.'
        return false
      }

      const existing = this.allCampuses.some(
        (c) => c.kode.toLowerCase() === data.kode.trim().toLowerCase()
      )
      if (existing) {
        this.error = 'Kode kampus sudah digunakan.'
        return false
      }

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const newId = crypto.randomUUID()
          const { data: created, error } = await supabase
            .from('campuses')
            .insert({
              id: newId,
              kode: data.kode.trim(),
              nama: data.nama.trim(),
              alamat: data.alamat?.trim() || null,
            })
            .select()
            .single()

          if (error) throw error
          if (created) this.sbCampuses.push(created as Campus)
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const existingIds = this.campuses.map((c) => {
        const num = parseInt(c.id.replace('camp-', ''), 10)
        return isNaN(num) ? 0 : num
      })
      const nextId = Math.max(...existingIds, 0) + 1
      this.campuses.push({
        id: `camp-${nextId}`,
        kode: data.kode.trim(),
        nama: data.nama.trim(),
        alamat: data.alamat?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      return true
    },

    /**
     * Update an existing campus (admin).
     */
    async updateCampus(id: string, data: { kode?: string; nama?: string; alamat?: string }): Promise<boolean> {
      this.error = null
      if (!this.initialized) await this.init()

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (data.kode !== undefined) payload.kode = data.kode.trim()
          if (data.nama !== undefined) payload.nama = data.nama.trim()
          if (data.alamat !== undefined) payload.alamat = data.alamat?.trim() || null

          const { error } = await supabase.from('campuses').update(payload).eq('id', id)
          if (error) throw error

          const idx = this.sbCampuses.findIndex((c) => c.id === id)
          if (idx >= 0) this.sbCampuses[idx] = { ...this.sbCampuses[idx], ...payload } as Campus
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const idx = this.campuses.findIndex((c) => c.id === id)
      if (idx < 0) {
        this.error = 'Kampus tidak ditemukan.'
        return false
      }
      if (data.kode !== undefined && data.kode.trim()) this.campuses[idx].kode = data.kode.trim()
      if (data.nama !== undefined && data.nama.trim()) this.campuses[idx].nama = data.nama.trim()
      if (data.alamat !== undefined) this.campuses[idx].alamat = data.alamat?.trim() || null
      this.campuses[idx].updated_at = new Date().toISOString()
      this._syncDemo()
      return true
    },

    /**
     * Delete a campus (admin).
     */
    async deleteCampus(id: string): Promise<boolean> {
      this.error = null
      if (!this.initialized) await this.init()

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const { error } = await supabase.from('campuses').delete().eq('id', id)
          if (error) throw error
          this.sbCampuses = this.sbCampuses.filter((c) => c.id !== id)
          if (this.currentCampusId === id) this.currentCampusId = null
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      this.campuses = this.campuses.filter((c) => c.id !== id)
      if (this.currentCampusId === id) this.currentCampusId = null
      return true
    },
  },
})