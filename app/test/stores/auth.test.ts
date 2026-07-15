/**
 * Auth Store — Unit Tests
 *
 * Tests login flows, getters, and state transitions
 * for both student and instructor roles in demo mode.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '~/stores/auth'

describe('Auth Store', () => {
  let store: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    store = useAuthStore()
  })

  // ── Initial State ──
  describe('initial state', () => {
    it('starts with no user logged in', () => {
      expect(store.user).toBeNull()
      expect(store.role).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(store.isStudent).toBe(false)
      expect(store.isInstructor).toBe(false)
      expect(store.isAdmin).toBe(false)
    })

    it('starts in demo mode by default', () => {
      expect(store.isDemoMode).toBe(true)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('has empty roster arrays initially', () => {
      expect(store.students).toEqual([])
      expect(store.instructors).toEqual([])
      expect(store.initialized).toBe(false)
    })
  })

  // ── Getters ──
  describe('getters', () => {
    it('dashboardRoute returns /login when not authenticated', () => {
      expect(store.dashboardRoute).toBe('/login')
    })

    it('dashboardRoute returns /dashboard for student', async () => {
      await store.loginAsStudent('Ahmad Fauzi', '20241001')
      expect(store.dashboardRoute).toBe('/dashboard')
    })

    it('dashboardRoute returns /instructor/dashboard for instructor', async () => {
      await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'instruktur123')
      expect(store.dashboardRoute).toBe('/instructor/dashboard')
    })

    it('dashboardRoute returns /admin/dashboard for admin', async () => {
      await store.loginAsAdmin('Admin LMS', 'admin123')
      expect(store.dashboardRoute).toBe('/admin/dashboard')
    })

    it('studentRoster falls back to DEMO_STUDENTS when empty', () => {
      const roster = store.studentRoster
      expect(roster.length).toBe(15)
      expect(roster[0].nama).toBe('Ahmad Fauzi')
      expect(roster[0].npm).toBe('20241001')
    })

    it('instructorList falls back to DEMO_INSTRUCTORS when empty', () => {
      const list = store.instructorList
      expect(list.length).toBe(3)
      expect(list[0].nama).toBe('Dr. Andi Wijaya, M.Kom.')
    })

    it('adminList falls back to DEMO_ADMINS when empty', () => {
      const admins = store.adminList
      expect(admins.length).toBe(1)
      expect(admins[0].nama).toBe('Admin LMS')
      expect(admins[0].email).toBe('admin@lms.ac.id')
    })

    it('classList groups students by level and session', () => {
      const classes = store.classList
      expect(classes.length).toBe(8) // 4 levels × 2 sessions
      expect(classes[0]).toEqual({
        level: 1,
        session_time: 'morning',
        label: 'Level 1 - Pagi',
      })
    })
  })

  // ── Student Login ──
  describe('loginAsStudent', () => {
    it('logs in successfully with valid nama and npm', async () => {
      const result = await store.loginAsStudent('Ahmad Fauzi', '20241001')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isStudent).toBe(true)
      expect(store.user).toMatchObject({
        id: 's1',
        nama: 'Ahmad Fauzi',
        npm: '20241001',
        role: 'student',
      })
    })

    it('handles case-insensitive nama matching', async () => {
      const result = await store.loginAsStudent('ahmad fauzi', '20241001')
      expect(result).toBe(true)
      expect(store.user?.nama).toBe('Ahmad Fauzi')
    })

    it('returns false for non-existent student', async () => {
      const result = await store.loginAsStudent('Unknown', '00000000')
      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.error).toBe('Nama atau NPM tidak ditemukan. Silakan cek kembali.')
    })

    it('returns false for wrong npm', async () => {
      const result = await store.loginAsStudent('Ahmad Fauzi', '00000000')
      expect(result).toBe(false)
      expect(store.error).toContain('Nama atau NPM tidak ditemukan')
    })

    it('sets loading state during login', async () => {
      const promise = store.loginAsStudent('Ahmad Fauzi', '20241001')
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('logs in all 15 demo students successfully', async () => {
      const students = [
        ['Ahmad Fauzi', '20241001'],
        ['Budi Santoso', '20241002'],
        ['Citra Dewi', '20241003'],
        ['Dian Permata', '20241004'],
        ['Eka Putra', '20241005'],
        ['Fitri Handayani', '20241006'],
        ['Gilang Pratama', '20241007'],
        ['Hesti Wulandari', '20241008'],
        ['Irfan Hakim', '20241009'],
        ['Joko Susilo', '20241010'],
        ['Kartika Sari', '20241011'],
        ['Lintang Utami', '20241012'],
        ['Mega Puspita', '20241013'],
        ['Nanda Kusuma', '20241014'],
        ['Oscar Rafif', '20241015'],
      ]
      for (const [nama, npm] of students) {
        const result = await store.loginAsStudent(nama, npm)
        expect(result).toBe(true)
      }
    })
  })

  // ── Instructor Login ──
  describe('loginAsInstructor', () => {
    it('logs in successfully with correct password', async () => {
      const result = await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'instruktur123')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isInstructor).toBe(true)
      expect(store.user).toMatchObject({
        id: 'i1',
        nama: 'Dr. Andi Wijaya, M.Kom.',
        role: 'instructor',
      })
    })

    it('handles case-insensitive nama matching for instructors', async () => {
      const result = await store.loginAsInstructor('dr. andi wijaya, m.kom.', 'instruktur123')
      expect(result).toBe(true)
    })

    it('rejects wrong password', async () => {
      const result = await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'wrongpass')
      expect(result).toBe(false)
      expect(store.error).toBe('Password salah.')
    })

    it('returns false for non-existent instructor', async () => {
      const result = await store.loginAsInstructor('Unknown Person', 'instruktur123')
      expect(result).toBe(false)
      expect(store.error).toBe('Nama instruktur tidak ditemukan.')
    })

    it('logs in all 3 instructors with correct password', async () => {
      const instructors = [
        ['Dr. Andi Wijaya, M.Kom.', 'instruktur123'],
        ['Dr. Dewi Lestari, M.Pd.', 'instruktur123'],
        ['Prof. Budi Hartono, Ph.D.', 'instruktur123'],
      ]
      for (const [nama, password] of instructors) {
        const result = await store.loginAsInstructor(nama, password)
        expect(result).toBe(true)
      }
    })
  })

  // ── Admin Login ──
  describe('loginAsAdmin', () => {
    it('logs in successfully with correct password', async () => {
      const result = await store.loginAsAdmin('Admin LMS', 'admin123')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isAdmin).toBe(true)
      expect(store.user).toMatchObject({
        id: 'a1',
        nama: 'Admin LMS',
        role: 'admin',
      })
    })

    it('handles case-insensitive nama matching', async () => {
      const result = await store.loginAsAdmin('admin lms', 'admin123')
      expect(result).toBe(true)
    })

    it('rejects wrong password', async () => {
      await store.loginAsStudent('Ahmad Fauzi', '20241001') // clear state first
      store.logout()
      const result = await store.loginAsAdmin('Admin LMS', 'wrongpass')
      expect(result).toBe(false)
      expect(store.error).toBe('Password salah.')
    })

    it('returns false for non-existent admin', async () => {
      const result = await store.loginAsAdmin('Unknown Person', 'admin123')
      expect(result).toBe(false)
      expect(store.error).toBe('Nama administrator tidak ditemukan.')
    })

    it('sets loading state during login', async () => {
      const promise = store.loginAsAdmin('Admin LMS', 'admin123')
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })
  })

  // ── Logout ──
  describe('logout', () => {
    it('clears user state after student login', async () => {
      await store.loginAsStudent('Ahmad Fauzi', '20241001')
      expect(store.isAuthenticated).toBe(true)

      store.logout()
      expect(store.user).toBeNull()
      expect(store.role).toBeNull()
      expect(store.error).toBeNull()
    })

    it('clears user state after instructor login', async () => {
      await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'instruktur123')
      expect(store.isAuthenticated).toBe(true)

      store.logout()
      expect(store.user).toBeNull()
      expect(store.role).toBeNull()
    })

    it('clears user state after admin login', async () => {
      await store.loginAsAdmin('Admin LMS', 'admin123')
      expect(store.isAuthenticated).toBe(true)

      store.logout()
      expect(store.user).toBeNull()
      expect(store.role).toBeNull()
    })
  })

  // ── clearError ──
  describe('clearError', () => {
    it('clears error state', async () => {
      await store.loginAsStudent('Wrong', '0000')
      expect(store.error).toBeTruthy()

      store.clearError()
      expect(store.error).toBeNull()
    })
  })

  // ── Demo Data Integrity ──
  describe('demo data integrity', () => {
    it('has exactly 15 students in roster', () => {
      expect(store.studentRoster.length).toBe(15)
    })

    it('has exactly 3 instructors', () => {
      expect(store.instructorList.length).toBe(3)
    })

    it('has exactly 1 admin', () => {
      expect(store.adminList.length).toBe(1)
      expect(store.adminList[0].id).toBe('a1')
      expect(store.adminList[0].nama).toBe('Admin LMS')
    })

    it('has unique npm across all students', () => {
      const npms = store.studentRoster.map((s) => s.npm)
      expect(new Set(npms).size).toBe(npms.length)
    })

    it('has students across all 4 levels', () => {
      const levels = new Set(store.studentRoster.map((s) => s.level))
      expect(levels).toEqual(new Set([1, 2, 3, 4]))
    })

    it('has both morning and evening sessions', () => {
      const sessions = new Set(store.studentRoster.map((s) => s.session_time))
      expect(sessions).toEqual(new Set(['morning', 'evening']))
    })
  })

  // ── updateProfile ──
  describe('updateProfile', () => {
    it('updates student nama successfully', async () => {
      await store.loginAsStudent('Oscar Rafif', '20241015')
      expect(store.user?.nama).toBe('Oscar Rafif')

      const result = await store.updateProfile({ nama: 'Oscar Update' })
      expect(result).toBe(true)
      expect(store.user?.nama).toBe('Oscar Update')
    })

    it('updates student nama in roster array', async () => {
      await store.loginAsStudent('Nanda Kusuma', '20241014')
      const before = store.studentRoster.find((s) => s.id === 's14')
      expect(before?.nama).toBe('Nanda Kusuma')

      await store.updateProfile({ nama: 'Nanda Updated' })
      const rosterEntry = store.studentRoster.find((s) => s.id === 's14')
      expect(rosterEntry?.nama).toBe('Nanda Updated')
    })

    it('updates instructor nama and email successfully', async () => {
      await store.loginAsInstructor('Prof. Budi Hartono, Ph.D.', 'instruktur123')
      expect(store.user?.nama).toBe('Prof. Budi Hartono, Ph.D.')

      const result = await store.updateProfile({ nama: 'Prof. Budi Update', email: 'budi.baru@lms.ac.id' })
      expect(result).toBe(true)
      expect(store.user?.nama).toBe('Prof. Budi Update')
      expect(store.user?.email).toBe('budi.baru@lms.ac.id')
    })

    it('updates admin nama successfully', async () => {
      await store.loginAsAdmin('Admin LMS', 'admin123')
      await store.updateProfile({ nama: 'Admin Test' })
      expect(store.user?.nama).toBe('Admin Test')
    })

    it('returns false when not logged in', async () => {
      const result = await store.updateProfile({ nama: 'Test' })
      expect(result).toBe(false)
    })

    it('rejects empty nama', async () => {
      await store.loginAsStudent('Citra Dewi', '20241003')
      const result = await store.updateProfile({ nama: 'A' })
      expect(result).toBe(false)
      expect(store.error).toContain('minimal 2 karakter')
    })

    it('rejects invalid email format', async () => {
      await store.loginAsInstructor('Dr. Dewi Lestari, M.Pd.', 'instruktur123')
      const result = await store.updateProfile({ email: 'not-an-email' })
      expect(result).toBe(false)
      expect(store.error).toContain('email tidak valid')
    })

    it('accepts empty email', async () => {
      await store.loginAsInstructor('Dr. Dewi Lestari, M.Pd.', 'instruktur123')
      const result = await store.updateProfile({ email: '' })
      expect(result).toBe(true)
      expect(store.user?.email).toBe('')
    })

    it('sets and clears loading state during update', async () => {
      await store.loginAsStudent('Lintang Utami', '20241012')
      const promise = store.updateProfile({ nama: 'Lintang Baru' })
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })
  })
})
