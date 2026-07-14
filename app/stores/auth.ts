/**
 * Auth Store — Manages authentication state for both Student and Instructor roles.
 *
 * Features:
 * - Role-based login (student by name+NPM, instructor by name+password)
 * - Roster-based student login (pick from predefined class list)
 * - Demo mode + Supabase production mode
 * - Automatic dashboard route resolution based on role
 */
import { defineStore } from 'pinia'
import type { Profile } from '~/types/database'
import type { StudentRosterEntry, InstructorEntry, AdminEntry } from '~/types/roster'

// ── Demo data (fallback when demoMode=true) ──────────
const DEMO_STUDENTS: StudentRosterEntry[] = [
  { id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' },
  { id: 's2', nama: 'Budi Santoso', npm: '20241002', kelas: '1A', level: 1, session_time: 'morning' },
  { id: 's3', nama: 'Citra Dewi', npm: '20241003', kelas: '1A', level: 1, session_time: 'morning' },
  { id: 's4', nama: 'Dian Permata', npm: '20241004', kelas: '1B', level: 1, session_time: 'evening' },
  { id: 's5', nama: 'Eka Putra', npm: '20241005', kelas: '1B', level: 1, session_time: 'evening' },
  { id: 's6', nama: 'Fitri Handayani', npm: '20241006', kelas: '2A', level: 2, session_time: 'morning' },
  { id: 's7', nama: 'Gilang Pratama', npm: '20241007', kelas: '2A', level: 2, session_time: 'morning' },
  { id: 's8', nama: 'Hesti Wulandari', npm: '20241008', kelas: '2B', level: 2, session_time: 'evening' },
  { id: 's9', nama: 'Irfan Hakim', npm: '20241009', kelas: '3A', level: 3, session_time: 'morning' },
  { id: 's10', nama: 'Joko Susilo', npm: '20241010', kelas: '3A', level: 3, session_time: 'morning' },
  { id: 's11', nama: 'Kartika Sari', npm: '20241011', kelas: '3B', level: 3, session_time: 'evening' },
  { id: 's12', nama: 'Lintang Utami', npm: '20241012', kelas: '4A', level: 4, session_time: 'morning' },
  { id: 's13', nama: 'Mega Puspita', npm: '20241013', kelas: '4A', level: 4, session_time: 'morning' },
  { id: 's14', nama: 'Nanda Kusuma', npm: '20241014', kelas: '4B', level: 4, session_time: 'evening' },
  { id: 's15', nama: 'Oscar Rafif', npm: '20241015', kelas: '4B', level: 4, session_time: 'evening' },
]

const DEMO_INSTRUCTORS: InstructorEntry[] = [
  { id: 'i1', nama: 'Dr. Andi Wijaya, M.Kom.', email: 'andi@lms.ac.id' },
  { id: 'i2', nama: 'Dr. Dewi Lestari, M.Pd.', email: 'dewi@lms.ac.id' },
  { id: 'i3', nama: 'Prof. Budi Hartono, Ph.D.', email: 'budi@lms.ac.id' },
]

const DEMO_INSTRUCTOR_PASSWORDS: Record<string, string> = {
  'i1': 'instruktur123',
  'i2': 'instruktur123',
  'i3': 'instruktur123',
}

const DEMO_ADMINS: AdminEntry[] = [
  { id: 'a1', nama: 'Admin LMS', email: 'admin@lms.ac.id' },
]

const DEMO_ADMIN_PASSWORDS: Record<string, string> = {
  'a1': 'admin123',
}

interface AuthState {
  user: Profile | null
  role: 'student' | 'instructor' | 'admin' | null
  isDemoMode: boolean
  loading: boolean
  error: string | null
  students: StudentRosterEntry[]
  instructors: InstructorEntry[]
  admins: AdminEntry[]
  initialized: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    role: null,
    isDemoMode: true,
    loading: false,
    error: null,
    students: [],
    instructors: [],
    admins: [],
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    isStudent: (state) => state.role === 'student',
    isInstructor: (state) => state.role === 'instructor',
    isAdmin: (state) => state.role === 'admin',

    dashboardRoute: (state): string => {
      if (state.role === 'admin') return '/admin/dashboard'
      if (state.role === 'instructor') return '/instructor/dashboard'
      if (state.role === 'student') return '/dashboard'
      return '/login'
    },

    studentRoster(): StudentRosterEntry[] {
      const store = useAuthStore()
      if (store.students.length > 0) return store.students
      return DEMO_STUDENTS
    },

    instructorList(): InstructorEntry[] {
      const store = useAuthStore()
      if (store.instructors.length > 0) return store.instructors
      return DEMO_INSTRUCTORS
    },

    classList(): { level: number; session_time: string; label: string }[] {
      const store = useAuthStore()
      const roster = store.students.length > 0 ? store.students : DEMO_STUDENTS
      const unique = new Map<string, { level: number; session_time: string; label: string }>()
      for (const s of roster) {
        const key = `${s.level}-${s.session_time}`
        if (!unique.has(key)) {
          unique.set(key, {
            level: s.level,
            session_time: s.session_time,
            label: `Level ${s.level} - ${s.session_time === 'morning' ? 'Pagi' : 'Sore'}`
          })
        }
      }
      return Array.from(unique.values())
    },

    adminList(): AdminEntry[] {
      const store = useAuthStore()
      if (store.admins.length > 0) return store.admins
      return DEMO_ADMINS
    },
  },

  actions: {
    /**
     * Initialize store: detect demo mode and fetch roster from Supabase.
     */
    async init() {
      if (this.initialized) return
      const config = useRuntimeConfig()
      this.isDemoMode = config.public.demoMode !== 'false'

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase

          const { data: studentData } = await supabase
            .from('profiles')
            .select('id, nama, npm, kelas, level, session_time')
            .eq('role', 'student')
            .order('nama')

          if (studentData) {
            this.students = studentData as StudentRosterEntry[]
          }

          const { data: instructorData } = await supabase
            .from('profiles')
            .select('id, nama, email')
            .eq('role', 'instructor')
            .order('nama')

          if (instructorData) {
            this.instructors = instructorData as unknown as InstructorEntry[]
          }

          const { data: adminData } = await supabase
            .from('profiles')
            .select('id, nama, email')
            .eq('role', 'admin')
            .order('nama')

          if (adminData) {
            this.admins = adminData as AdminEntry[]
          }
        } catch (err) {
          console.error('Failed to fetch roster from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        }
      }

      this.initialized = true
    },

    /**
     * Login as a student using name+NPM from the roster.
     */
    async loginAsStudent(nama: string, npm: string): Promise<boolean> {
      this.loading = true
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      const roster = this.students.length > 0 ? this.students : DEMO_STUDENTS
      const match = roster.find(
        (s) => s.nama.toLowerCase() === nama.toLowerCase() && s.npm === npm
      )

      if (!match) {
        this.error = 'Nama atau NPM tidak ditemukan. Silakan cek kembali.'
        this.loading = false
        return false
      }

      this.user = {
        id: match.id,
        role: 'student',
        nama: match.nama,
        npm: match.npm,
        kelas: match.kelas,
        level: match.level,
        session_time: match.session_time,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      this.role = 'student'
      this.loading = false
      return true
    },

    /**
     * Login as an instructor using name+password.
     */
    async loginAsInstructor(nama: string, password: string): Promise<boolean> {
      this.loading = true
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      const roster = this.instructors.length > 0 ? this.instructors : DEMO_INSTRUCTORS
      const match = roster.find(
        (i) => i.nama.toLowerCase() === nama.toLowerCase()
      )

      if (!match) {
        this.error = 'Nama instruktur tidak ditemukan.'
        this.loading = false
        return false
      }

      // In demo mode, use hardcoded passwords.
      // In production, passwords would be verified server-side.
      const expectedPassword = DEMO_INSTRUCTOR_PASSWORDS[match.id]
      if (password !== expectedPassword) {
        this.error = 'Password salah.'
        this.loading = false
        return false
      }

      this.user = {
        id: match.id,
        role: 'instructor',
        nama: match.nama,
        email: match.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      this.role = 'instructor'
      this.loading = false
      return true
    },

    /**
     * Login as an administrator using name+password.
     */
    async loginAsAdmin(nama: string, password: string): Promise<boolean> {
      this.loading = true
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      const roster = this.admins.length > 0 ? this.admins : DEMO_ADMINS
      const match = roster.find(
        (a) => a.nama.toLowerCase() === nama.toLowerCase()
      )

      if (!match) {
        this.error = 'Nama administrator tidak ditemukan.'
        this.loading = false
        return false
      }

      const expectedPassword = DEMO_ADMIN_PASSWORDS[match.id]
      if (password !== expectedPassword) {
        this.error = 'Password salah.'
        this.loading = false
        return false
      }

      this.user = {
        id: match.id,
        role: 'admin',
        nama: match.nama,
        email: match.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      this.role = 'admin'
      this.loading = false
      return true
    },

    /**
     * Logout — clears user state.
     */
    logout() {
      this.user = null
      this.role = null
      this.error = null
      navigateTo('/login')
    },

    /**
     * Clear any auth error.
     */
    clearError() {
      this.error = null
    },
  },
})
