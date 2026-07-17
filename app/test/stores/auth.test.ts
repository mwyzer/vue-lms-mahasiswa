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
      store.students = [{ id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' }]
      await store.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')
      expect(store.dashboardRoute).toBe('/dashboard')
    })

    it('dashboardRoute returns /instructor/dashboard for instructor', async () => {
      store.instructors = [{ id: 'i1', nama: 'Dr. Andi Wijaya, M.Kom.', email: 'andi@lms.ac.id' }]
      await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'instruktur123')
      expect(store.dashboardRoute).toBe('/instructor/dashboard')
    })

    it('dashboardRoute returns /admin/dashboard for admin', async () => {
      await store.loginAsAdmin('Admin LMS', 'admin123')
      expect(store.dashboardRoute).toBe('/admin/dashboard')
    })

    it('studentRoster returns empty array when no students', () => {
      expect(store.studentRoster).toEqual([])
    })

    it('studentRoster returns populated students array', () => {
      store.students = [{ id: 's99', nama: 'Test Student', npm: '99999', kelas: '1A', level: 1, session_time: 'morning' }]
      expect(store.studentRoster).toHaveLength(1)
      expect(store.studentRoster[0].nama).toBe('Test Student')
    })

    it('instructorList returns empty array when no instructors', () => {
      expect(store.instructorList).toEqual([])
    })

    it('instructorList returns populated instructors array', () => {
      store.instructors = [{ id: 'i99', nama: 'Dr. Test', email: 'test@lms.ac.id' }]
      expect(store.instructorList).toHaveLength(1)
      expect(store.instructorList[0].nama).toBe('Dr. Test')
    })

    it('adminList falls back to DEMO_ADMINS when empty', () => {
      const admins = store.adminList
      expect(admins.length).toBe(1)
      expect(admins[0].nama).toBe('Admin LMS')
      expect(admins[0].email).toBe('admin@lms.ac.id')
    })

    it('classList returns empty array when no students', () => {
      expect(store.classList).toEqual([])
    })

    it('classList groups students by level and session', () => {
      store.students = [
        { id: 's1', nama: 'A', npm: '1', kelas: '1A', level: 1, session_time: 'morning' },
        { id: 's2', nama: 'B', npm: '2', kelas: '1A', level: 1, session_time: 'morning' },
        { id: 's3', nama: 'C', npm: '3', kelas: '1B', level: 1, session_time: 'evening' },
      ]
      const classes = store.classList
      expect(classes).toHaveLength(2)
      expect(classes[0]).toEqual({ level: 1, session_time: 'morning', label: 'Level 1 - Pagi' })
      expect(classes[1]).toEqual({ level: 1, session_time: 'evening', label: 'Level 1 - Sore' })
    })
  })

  // ── Student Login ──
  describe('loginAsStudent', () => {
    beforeEach(() => {
      // Seed students array for login tests
      store.students = [
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
    })

    it('logs in successfully with valid nama and npm', async () => {
      const result = await store.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')
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
      const result = await store.loginAsStudent('ahmad fauzi', '20241001', 'mahasiswa123')
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
      const promise = store.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('logs in all 15 seeded students successfully', async () => {
      const students = [
        ['Ahmad Fauzi', '20241001', 'mahasiswa123'],
        ['Budi Santoso', '20241002', 'mahasiswa123'],
        ['Citra Dewi', '20241003', 'mahasiswa123'],
        ['Dian Permata', '20241004', 'mahasiswa123'],
        ['Eka Putra', '20241005', 'mahasiswa123'],
        ['Fitri Handayani', '20241006', 'mahasiswa123'],
        ['Gilang Pratama', '20241007', 'mahasiswa123'],
        ['Hesti Wulandari', '20241008', 'mahasiswa123'],
        ['Irfan Hakim', '20241009', 'mahasiswa123'],
        ['Joko Susilo', '20241010', 'mahasiswa123'],
        ['Kartika Sari', '20241011', 'mahasiswa123'],
        ['Lintang Utami', '20241012', 'mahasiswa123'],
        ['Mega Puspita', '20241013', 'mahasiswa123'],
        ['Nanda Kusuma', '20241014', 'mahasiswa123'],
        ['Oscar Rafif', '20241015', 'mahasiswa123'],
      ]
      for (const [nama, npm] of students) {
        const result = await store.loginAsStudent(nama, npm, 'mahasiswa123')
        expect(result).toBe(true)
      }
    })
  })

  // ── Instructor Login ──
  describe('loginAsInstructor', () => {
    beforeEach(() => {
      // Seed instructors array for login tests
      store.instructors = [
        { id: 'i1', nama: 'Dr. Andi Wijaya, M.Kom.', email: 'andi@lms.ac.id' },
        { id: 'i2', nama: 'Dr. Dewi Lestari, M.Pd.', email: 'dewi@lms.ac.id' },
        { id: 'i3', nama: 'Prof. Budi Hartono, Ph.D.', email: 'budi@lms.ac.id' },
      ]
    })

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

    it('allows login without password in demo mode', async () => {
      const result = await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'wrongpass')
      expect(result).toBe(true)
    })

    it('returns false for non-existent instructor', async () => {
      const result = await store.loginAsInstructor('Unknown Person', 'instruktur123')
      expect(result).toBe(false)
      expect(store.error).toBe('Nama instruktur tidak ditemukan.')
    })

    it('logs in all 3 seeded instructors with correct password', async () => {
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

    it('allows login without password in demo mode', async () => {
      const result = await store.loginAsAdmin('Admin LMS', 'wrongpass')
      expect(result).toBe(true)
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
    beforeEach(() => {
      store.students = [{ id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' }]
      store.instructors = [{ id: 'i1', nama: 'Dr. Andi Wijaya, M.Kom.', email: 'andi@lms.ac.id' }]
    })

    it('clears user state after student login', async () => {
      await store.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')
      expect(store.isAuthenticated).toBe(true)

      await store.logout()
      expect(store.user).toBeNull()
      expect(store.role).toBeNull()
      expect(store.error).toBeNull()
    })

    it('clears user state after instructor login', async () => {
      await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'instruktur123')
      expect(store.isAuthenticated).toBe(true)

      await store.logout()
      expect(store.user).toBeNull()
      expect(store.role).toBeNull()
    })

    it('clears user state after admin login', async () => {
      await store.loginAsAdmin('Admin LMS', 'admin123')
      expect(store.isAuthenticated).toBe(true)

      await store.logout()
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
    it('starts with empty student roster (demo accounts removed)', () => {
      expect(store.studentRoster).toEqual([])
    })

    it('starts with empty instructor list (demo accounts removed)', () => {
      expect(store.instructorList).toEqual([])
    })

    it('has exactly 1 admin (kept)', () => {
      expect(store.adminList.length).toBe(1)
      expect(store.adminList[0].id).toBe('a1')
      expect(store.adminList[0].nama).toBe('Admin LMS')
    })
  })

  // ── updateProfile ──
  describe('updateProfile', () => {
    beforeEach(() => {
      store.students = [
        { id: 's3', nama: 'Citra Dewi', npm: '20241003', kelas: '1A', level: 1, session_time: 'morning' },
        { id: 's12', nama: 'Lintang Utami', npm: '20241012', kelas: '4A', level: 4, session_time: 'morning' },
        { id: 's14', nama: 'Nanda Kusuma', npm: '20241014', kelas: '4B', level: 4, session_time: 'evening' },
        { id: 's15', nama: 'Oscar Rafif', npm: '20241015', kelas: '4B', level: 4, session_time: 'evening' },
      ]
      store.instructors = [
        { id: 'i2', nama: 'Dr. Dewi Lestari, M.Pd.', email: 'dewi@lms.ac.id' },
        { id: 'i3', nama: 'Prof. Budi Hartono, Ph.D.', email: 'budi@lms.ac.id' },
      ]
    })

    it('updates student nama successfully', async () => {
      await store.loginAsStudent('Oscar Rafif', '20241015', 'mahasiswa123')
      expect(store.user?.nama).toBe('Oscar Rafif')

      const result = await store.updateProfile({ nama: 'Oscar Update' })
      expect(result).toBe(true)
      expect(store.user?.nama).toBe('Oscar Update')
    })

    it('updates student nama in roster array', async () => {
      await store.loginAsStudent('Nanda Kusuma', '20241014', 'mahasiswa123')
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
      await store.loginAsStudent('Citra Dewi', '20241003', 'mahasiswa123')
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
      await store.loginAsStudent('Lintang Utami', '20241012', 'mahasiswa123')
      const promise = store.updateProfile({ nama: 'Lintang Baru' })
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })
  })
})
