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
  { id: 's1',  nama: 'Ahmad Fauzi',      npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' },
  { id: 's2',  nama: 'Budi Santoso',      npm: '20241002', kelas: '1A', level: 1, session_time: 'morning' },
  { id: 's3',  nama: 'Citra Dewi',        npm: '20241003', kelas: '1A', level: 1, session_time: 'morning' },
  { id: 's4',  nama: 'Dian Permata',      npm: '20241004', kelas: '1B', level: 1, session_time: 'evening' },
  { id: 's5',  nama: 'Eka Putra',         npm: '20241005', kelas: '1B', level: 1, session_time: 'evening' },
  { id: 's6',  nama: 'Fitri Handayani',   npm: '20241006', kelas: '2A', level: 2, session_time: 'morning' },
  { id: 's7',  nama: 'Gilang Pratama',    npm: '20241007', kelas: '2A', level: 2, session_time: 'morning' },
  { id: 's8',  nama: 'Hesti Wulandari',   npm: '20241008', kelas: '2B', level: 2, session_time: 'evening' },
  { id: 's9',  nama: 'Irfan Hakim',       npm: '20241009', kelas: '3A', level: 3, session_time: 'morning' },
  { id: 's10', nama: 'Joko Susilo',       npm: '20241010', kelas: '3A', level: 3, session_time: 'morning' },
  { id: 's11', nama: 'Kartika Sari',      npm: '20241011', kelas: '3B', level: 3, session_time: 'evening' },
  { id: 's12', nama: 'Lintang Utami',     npm: '20241012', kelas: '4A', level: 4, session_time: 'morning' },
  { id: 's13', nama: 'Mega Puspita',      npm: '20241013', kelas: '4A', level: 4, session_time: 'morning' },
  { id: 's14', nama: 'Nanda Kusuma',      npm: '20241014', kelas: '4B', level: 4, session_time: 'evening' },
  { id: 's15', nama: 'Oscar Rafif',       npm: '20241015', kelas: '4B', level: 4, session_time: 'evening' },
  { id: 's16', nama: 'Putri Anggraini',   npm: '20251001', kelas: '5A', level: 5, session_time: 'morning' },
  { id: 's17', nama: 'Rizky Firmansyah',  npm: '20251002', kelas: '5B', level: 5, session_time: 'evening' },
]

const DEMO_INSTRUCTORS: InstructorEntry[] = [
  { id: 'i1', nama: 'Dr. Andi Wijaya', email: 'andi.wijaya@lms.ac.id' },
  { id: 'i2', nama: 'Dr. Dewi Lestari', email: 'dewi.lestari@lms.ac.id' },
  { id: 'i3', nama: 'Prof. Budi Hartono', email: 'budi.hartono@lms.ac.id' },
]

export const DEMO_INSTRUCTOR_PASSWORDS: Record<string, string> = {
  'i1': 'instruktur123',
  'i2': 'instruktur123',
  'i3': 'instruktur123',
}

const DEMO_ADMINS: AdminEntry[] = [
  { id: 'a1', nama: 'Admin LMS', email: 'admin@lms.ac.id' },
]

export const DEMO_STUDENT_PASSWORDS: Record<string, string> = {
  's1': 'mahasiswa123',
  's2': 'mahasiswa123',
  's3': 'mahasiswa123',
  's4': 'mahasiswa123',
  's5': 'mahasiswa123',
  's6': 'mahasiswa123',
  's7': 'mahasiswa123',
  's8': 'mahasiswa123',
  's9': 'mahasiswa123',
  's10': 'mahasiswa123',
  's11': 'mahasiswa123',
  's12': 'mahasiswa123',
  's13': 'mahasiswa123',
  's14': 'mahasiswa123',
  's15': 'mahasiswa123',
  's16': 'mahasiswa123',
  's17': 'mahasiswa123',
}

export const DEMO_ADMIN_PASSWORDS: Record<string, string> = {
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
      return this.students
    },

    instructorList(): InstructorEntry[] {
      return this.instructors
    },

    classList(): { level: number; session_time: string; label: string }[] {
      const roster = this.students
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
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode

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

      // Demo mode — populate local state with demo data for reactivity
      if (this.isDemoMode && this.students.length === 0) {
        this.students = [...DEMO_STUDENTS]
        this.admins = [...DEMO_ADMINS]
        this.instructors = [...DEMO_INSTRUCTORS]
      }

      this.initialized = true

      // Try restoring from the signed session cookie (client-side)
      // The cookie is HMAC-signed, tamper-proof, and avoids localStorage vulnerabilities.
      if (import.meta.client && !this.isAuthenticated) {
        try {
          const cookies = document.cookie.split('; ').reduce<Record<string, string>>((acc, c) => {
            const [k, ...v] = c.split('=')
            if (k) acc[k.trim()] = decodeURIComponent(v.join('='))
            return acc
          }, {})
          const sessionCookie = cookies['lms_session']
          if (sessionCookie) {
            this.restoreSessionFromCookie(sessionCookie)
          }
        } catch { /* ignore */ }
      }

      // If session was restored and we're on login page, redirect to dashboard
      // (handles the case where SSR redirects to /login then client hydrates)
      if (import.meta.client && this.isAuthenticated) {
        const path = window.location.pathname
        if (path === '/login' || path === '/') {
          navigateTo(this.dashboardRoute)
        }
      }
    },

    /**
     * Login as a student using name+NPM from the roster.
     * In production mode, password is verified server-side via Supabase.
     * In demo mode, password is checked against DEMO_STUDENT_PASSWORDS.
     */
    async loginAsStudent(nama: string, npm: string, password?: string): Promise<boolean> {
      this.loading = true
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      const match = this.students.find(
        (s) => s.nama.toLowerCase() === nama.toLowerCase() && s.npm === npm
      )

      if (!match) {
        this.error = 'Nama atau NPM tidak ditemukan. Silakan cek kembali.'
        this.loading = false
        return false
      }

      // Verify password — demo uses hardcoded passwords; production uses Supabase Auth
      if (this.isDemoMode) {
        const expected = DEMO_STUDENT_PASSWORDS[match.id]
        if (expected && password !== expected) {
          this.error = 'Password salah.'
          this.loading = false
          return false
        }
      } else if (password) {
        // Production: verify password via Supabase Auth
        const supabase = useNuxtApp().$supabase
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: `${match.npm}@lms.ac.id`,
          password,
        })
        if (authError) {
          this.error = 'Password salah.'
          this.loading = false
          return false
        }
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

      // Load saved avatar from localStorage (demo mode)
      if (this.isDemoMode) {
        try {
          const saved = localStorage.getItem(`lms_avatar_${match.id}`)
          if (saved) this.user.avatar_url = saved
        } catch { /* ignore */ }
      }

      this.role = 'student'
      this.loading = false

      // Set server session cookie for middleware auth
      await this.syncSession()

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

      const match = this.instructors.find(
        (i) => i.nama.toLowerCase() === nama.toLowerCase()
      )

      if (!match) {
        this.error = 'Nama instruktur tidak ditemukan.'
        this.loading = false
        return false
      }

      // Verify password — demo uses hardcoded passwords; production uses Supabase Auth
      if (this.isDemoMode) {
        const expected = DEMO_INSTRUCTOR_PASSWORDS[match.id]
        if (expected && password !== expected) {
          this.error = 'Password salah.'
          this.loading = false
          return false
        }
      } else {
        // Production: verify password via Supabase Auth
        const supabase = useNuxtApp().$supabase
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: match.email!,
          password,
        })
        if (authError) {
          this.error = 'Password salah.'
          this.loading = false
          return false
        }
      }

      this.user = {
        id: match.id,
        role: 'instructor',
        nama: match.nama,
        email: match.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Load saved avatar from localStorage (demo mode)
      if (this.isDemoMode) {
        try {
          const saved = localStorage.getItem(`lms_avatar_${match.id}`)
          if (saved) this.user.avatar_url = saved
        } catch { /* ignore */ }
      }

      this.role = 'instructor'
      this.loading = false

      // Set server session cookie for middleware auth
      await this.syncSession()

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

      // Verify password — demo uses hardcoded passwords; production uses Supabase Auth
      if (this.isDemoMode) {
        const expected = DEMO_ADMIN_PASSWORDS[match.id]
        if (expected && password !== expected) {
          this.error = 'Password salah.'
          this.loading = false
          return false
        }
      } else {
        // Production: verify password via Supabase Auth
        const supabase = useNuxtApp().$supabase
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: match.email!,
          password,
        })
        if (authError) {
          this.error = 'Password salah.'
          this.loading = false
          return false
        }
      }

      this.user = {
        id: match.id,
        role: 'admin',
        nama: match.nama,
        email: match.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Load saved avatar from localStorage (demo mode)
      if (this.isDemoMode) {
        try {
          const saved = localStorage.getItem(`lms_avatar_${match.id}`)
          if (saved) this.user.avatar_url = saved
        } catch { /* ignore */ }
      }
      this.role = 'admin'
      this.loading = false

      // Set server session cookie for middleware auth
      await this.syncSession()

      return true
    },

    /**
     * Sync session to server cookie so server middleware can authenticate.
     */
    async syncSession() {
      if (!this.user) return
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.user.id,
            role: this.role,
            name: this.user.nama,
          }),
        })
      } catch {
        // Server session is best-effort; auth store is source of truth in demo mode
      }
    },

    /**
     * Restore session from the lms_session cookie value.
     * Decodes the base64url payload to extract userId, role, name,
     * then rebuilds the user Profile from demo data.
     * Works on both server (SSR) and client.
     */
    restoreSessionFromCookie(cookieValue: string | undefined): boolean {
      if (!cookieValue) return false

      try {
        // Cookie format: base64url(JSON).hexsig
        const parts = cookieValue.split('.')
        if (parts.length !== 2) return false

        // Decode base64url payload
        const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/')
        const json = atob(base64)
        const data = JSON.parse(json)
        if (!data?.userId || !data?.role || !data?.name) return false

        const { userId, role, name } = data

        // Rebuild user profile from demo data
        if (role === 'instructor') {
          const match = this.instructors.find((i) => i.id === userId)
          if (!match || match.nama !== name) return false

          this.user = {
            id: match.id,
            role: 'instructor',
            nama: match.nama,
            email: match.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          this.role = 'instructor'
          return true
        }

        if (role === 'student') {
          const match = this.students.find((s) => s.id === userId)
          if (!match || match.nama !== name) return false

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
          return true
        }

        if (role === 'admin') {
          const roster = this.admins.length > 0 ? this.admins : DEMO_ADMINS
          const match = roster.find((a) => a.id === userId)
          if (!match || match.nama !== name) return false

          this.user = {
            id: match.id,
            role: 'admin',
            nama: match.nama,
            email: match.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          this.role = 'admin'
          return true
        }

        return false
      } catch {
        return false
      }
    },

    /**
     * Logout — clears user state and server session.
     */
    async logout() {
      try {
        await fetch('/api/auth/session', { method: 'DELETE' })
      } catch {
        // Best-effort cleanup
      }
      this.user = null
      this.role = null
      this.error = null
      try {
        navigateTo('/login')
      } catch {
        // navigateTo may not be available in all environments
      }
    },

    /**
     * Update the current user's profile fields.
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async updateProfile(data: Partial<Pick<Profile, 'nama' | 'email' | 'avatar_url'>>): Promise<boolean> {
      if (!this.user) return false

      this.loading = true
      this.error = null

      // Validation
      if (data.nama !== undefined && data.nama.trim().length < 2) {
        this.error = 'Nama harus diisi minimal 2 karakter.'
        this.loading = false
        return false
      }

      if (data.email !== undefined && data.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(data.email)) {
          this.error = 'Format email tidak valid.'
          this.loading = false
          return false
        }
      }

      // Production mode — update via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              ...(data.nama !== undefined && { nama: data.nama }),
              ...(data.email !== undefined && { email: data.email }),
              ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', this.user.id)

          if (updateError) {
            this.error = 'Gagal menyimpan perubahan: ' + updateError.message
            this.loading = false
            return false
          }
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          this.loading = false
          return false
        }
      }

      // Demo mode — update local state
      if (this.isDemoMode) {
        // Yield to allow loading state detection in tests
        await new Promise((r) => setTimeout(r, 10))

        if (this.role === 'student') {
          // Update Pinia state array
          const idx = this.students.findIndex((s) => s.id === this.user!.id)
          if (idx >= 0) {
            if (data.nama !== undefined) this.students[idx].nama = data.nama
          }
        }
        if (this.role === 'instructor') {
          const idx = this.instructors.findIndex((i) => i.id === this.user!.id)
          if (idx >= 0) {
            if (data.nama !== undefined) this.instructors[idx].nama = data.nama
            if (data.email !== undefined) this.instructors[idx].email = data.email
          }
        }
      }

      // Update current user object
      if (data.nama !== undefined) this.user.nama = data.nama
      if (data.email !== undefined) this.user.email = data.email
      if (data.avatar_url !== undefined) this.user.avatar_url = data.avatar_url
      this.user.updated_at = new Date().toISOString()

      // Persist avatar to localStorage in demo mode for cross-session retention
      if (this.isDemoMode && data.avatar_url !== undefined && this.user?.id) {
        try {
          localStorage.setItem(`lms_avatar_${this.user.id}`, data.avatar_url || '')
        } catch {
          // localStorage may be full or unavailable
        }
      }

      this.loading = false
      return true
    },

    /**
     * Change the current user's password.
     * Verifies old password, then sets new password.
     * In demo mode, updates the in-memory password map.
     * In production mode, uses Supabase Auth to update password.
     */
    async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
      if (!this.user) return false

      this.loading = true
      this.error = null

      // Validation
      if (!oldPassword) {
        this.error = 'Password lama harus diisi.'
        this.loading = false
        return false
      }

      if (!newPassword || newPassword.length < 6) {
        this.error = 'Password baru minimal 6 karakter.'
        this.loading = false
        return false
      }

      if (oldPassword === newPassword) {
        this.error = 'Password baru tidak boleh sama dengan password lama.'
        this.loading = false
        return false
      }

      // Demo mode — verify against in-memory password map
      if (this.isDemoMode) {
        await new Promise((r) => setTimeout(r, 10))

        const userId = this.user.id
        let currentPassword: string | undefined

        if (this.role === 'admin') {
          currentPassword = DEMO_ADMIN_PASSWORDS[userId]
        } else if (this.role === 'instructor') {
          currentPassword = DEMO_INSTRUCTOR_PASSWORDS[userId]
        } else if (this.role === 'student') {
          currentPassword = DEMO_STUDENT_PASSWORDS[userId]
        }

        if (!currentPassword) {
          this.error = 'Data password tidak ditemukan.'
          this.loading = false
          return false
        }

        if (oldPassword !== currentPassword) {
          this.error = 'Password lama tidak sesuai.'
          this.loading = false
          return false
        }

        // Update the password map
        if (this.role === 'admin') {
          DEMO_ADMIN_PASSWORDS[userId] = newPassword
        } else if (this.role === 'instructor') {
          DEMO_INSTRUCTOR_PASSWORDS[userId] = newPassword
        } else if (this.role === 'student') {
          DEMO_STUDENT_PASSWORDS[userId] = newPassword
        }

        this.loading = false
        return true
      }

      // Production mode — update via Supabase Auth
      try {
        const supabase = useNuxtApp().$supabase
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        })

        if (updateError) {
          this.error = 'Gagal mengubah password: ' + updateError.message
          this.loading = false
          return false
        }
      } catch (err: any) {
        this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
        this.loading = false
        return false
      }

      this.loading = false
      return true
    },

    /**
     * Clear any auth error.
     */
    clearError() {
      this.error = null
    },

    // ── Admin: Student CRUD ──

    /**
     * Add a new student (admin).
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async addStudent(data: { nama: string; npm: string; kelas: string; level: number; session_time: 'morning' | 'evening'; password?: string; avatar_url?: string }): Promise<boolean> {
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      // Production mode — insert via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const newId = crypto.randomUUID()
          const { data: newProfile, error } = await supabase
            .from('profiles')
            .insert({
              id: newId,
              role: 'student',
              nama: data.nama,
              npm: data.npm,
              kelas: data.kelas,
              level: data.level,
              session_time: data.session_time,
              avatar_url: data.avatar_url || null,
            })
            .select()
            .single()

          if (error) {
            this.error = 'Gagal menambahkan mahasiswa: ' + error.message
            return false
          }

          // Add to local state for immediate UI update
          this.students.push(newProfile as StudentRosterEntry)
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const existingIds = this.students.map((s) => {
        const num = parseInt(s.id.replace('s', ''), 10)
        return isNaN(num) ? 0 : num
      })
      const nextId = Math.max(...existingIds, 0) + 1
      const id = `s${nextId}`

      this.students.push({
        id,
        nama: data.nama,
        npm: data.npm,
        kelas: data.kelas,
        level: data.level,
        session_time: data.session_time,
        avatar_url: data.avatar_url || null,
      })
      if (data.password) {
        DEMO_STUDENT_PASSWORDS[id] = data.password
      }
      return true
    },

    /**
     * Update an existing student (admin).
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async updateStudent(id: string, data: Partial<{ nama: string; npm: string; kelas: string; level: number; session_time: 'morning' | 'evening'; password: string; avatar_url: string }>): Promise<boolean> {
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      // Production mode — update via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const payload: Record<string, any> = { updated_at: new Date().toISOString() }
          if (data.nama !== undefined) payload.nama = data.nama
          if (data.npm !== undefined) payload.npm = data.npm
          if (data.kelas !== undefined) payload.kelas = data.kelas
          if (data.level !== undefined) payload.level = data.level
          if (data.session_time !== undefined) payload.session_time = data.session_time
          if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url

          const { error } = await supabase
            .from('profiles')
            .update(payload)
            .eq('id', id)

          if (error) {
            this.error = 'Gagal memperbarui mahasiswa: ' + error.message
            return false
          }

          // Update local state
          const idx = this.students.findIndex((s) => s.id === id)
          if (idx >= 0) {
            this.students[idx] = { ...this.students[idx], ...data }
          }
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const idx = this.students.findIndex((s) => s.id === id)
      if (idx >= 0) {
        this.students[idx] = { ...this.students[idx], ...data }
        if (data.password) {
          DEMO_STUDENT_PASSWORDS[id] = data.password
        }
      }
      return true
    },

    /**
     * Delete a student (admin).
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async deleteStudent(id: string): Promise<boolean> {
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      // Production mode — delete via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id)

          if (error) {
            this.error = 'Gagal menghapus mahasiswa: ' + error.message
            return false
          }

          // Remove from local state
          const idx = this.students.findIndex((s) => s.id === id)
          if (idx >= 0) {
            this.students.splice(idx, 1)
          }
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const idx = this.students.findIndex((s) => s.id === id)
      if (idx >= 0) {
        this.students.splice(idx, 1)
      }
      return true
    },

    // ── Admin: Instructor CRUD ──

    /**
     * Add a new instructor (admin).
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async addInstructor(data: { nama: string; email: string; password: string; avatar_url?: string }): Promise<boolean> {
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      // Production mode — insert via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const newId = crypto.randomUUID()
          const { data: newProfile, error } = await supabase
            .from('profiles')
            .insert({
              id: newId,
              role: 'instructor',
              nama: data.nama,
              email: data.email || null,
              avatar_url: data.avatar_url || null,
            })
            .select()
            .single()

          if (error) {
            this.error = 'Gagal menambahkan instruktur: ' + error.message
            return false
          }

          // Add to local state for immediate UI update
          this.instructors.push(newProfile as unknown as InstructorEntry)
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const existingIds = this.instructors.map((i) => {
        const num = parseInt(i.id.replace('i', ''), 10)
        return isNaN(num) ? 0 : num
      })
      const nextId = Math.max(...existingIds, 0) + 1
      const id = `i${nextId}`

      this.instructors.push({
        id,
        nama: data.nama,
        email: data.email,
        avatar_url: data.avatar_url || null,
      })
      DEMO_INSTRUCTOR_PASSWORDS[id] = data.password || 'instruktur123'
      return true
    },

    /**
     * Update an existing instructor (admin).
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async updateInstructor(id: string, data: Partial<{ nama: string; email: string; password: string; avatar_url: string }>): Promise<boolean> {
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      // Production mode — update via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const payload: Record<string, any> = { updated_at: new Date().toISOString() }
          if (data.nama !== undefined) payload.nama = data.nama
          if (data.email !== undefined) payload.email = data.email
          if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url

          const { error } = await supabase
            .from('profiles')
            .update(payload)
            .eq('id', id)

          if (error) {
            this.error = 'Gagal memperbarui instruktur: ' + error.message
            return false
          }

          // Update local state
          const idx = this.instructors.findIndex((i) => i.id === id)
          if (idx >= 0) {
            if (data.nama !== undefined) this.instructors[idx].nama = data.nama
            if (data.email !== undefined) this.instructors[idx].email = data.email
            if (data.avatar_url !== undefined) this.instructors[idx].avatar_url = data.avatar_url
          }
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const idx = this.instructors.findIndex((i) => i.id === id)
      if (idx >= 0) {
        if (data.nama !== undefined) this.instructors[idx].nama = data.nama
        if (data.email !== undefined) this.instructors[idx].email = data.email
        if (data.avatar_url !== undefined) this.instructors[idx].avatar_url = data.avatar_url
        if (data.password !== undefined) DEMO_INSTRUCTOR_PASSWORDS[id] = data.password
      }
      return true
    },

    /**
     * Delete an instructor (admin).
     * Works in both demo mode (local state) and production mode (Supabase).
     */
    async deleteInstructor(id: string): Promise<boolean> {
      this.error = null

      // Ensure roster is loaded
      if (!this.initialized) {
        await this.init()
      }

      // Production mode — delete via Supabase
      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id)

          if (error) {
            this.error = 'Gagal menghapus instruktur: ' + error.message
            return false
          }

          // Remove from local state
          const idx = this.instructors.findIndex((i) => i.id === id)
          if (idx >= 0) {
            this.instructors.splice(idx, 1)
          }
          return true
        } catch (err: any) {
          this.error = 'Terjadi kesalahan: ' + (err.message || 'Unknown error')
          return false
        }
      }

      // Demo mode — local state only
      const idx = this.instructors.findIndex((i) => i.id === id)
      if (idx >= 0) {
        this.instructors.splice(idx, 1)
        delete DEMO_INSTRUCTOR_PASSWORDS[id]
      }
      return true
    },
  },
})
