/**
 * Auth Store — CRUD + Login Integration Tests
 *
 * Verifies that students/instructors added or updated via admin CRUD
 * can successfully log in with their credentials.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, DEMO_STUDENT_PASSWORDS, DEMO_INSTRUCTOR_PASSWORDS, DEMO_ADMIN_PASSWORDS } from '~/stores/auth'
import type { StudentRosterEntry, InstructorEntry } from '~/types/roster'

/** Default password map entries to restore between tests */
const DEFAULT_STUDENT_PASSWORDS: Record<string, string> = {
  's1': 'mahasiswa123', 's2': 'mahasiswa123', 's3': 'mahasiswa123',
  's4': 'mahasiswa123', 's5': 'mahasiswa123', 's6': 'mahasiswa123',
  's7': 'mahasiswa123', 's8': 'mahasiswa123', 's9': 'mahasiswa123',
  's10': 'mahasiswa123', 's11': 'mahasiswa123', 's12': 'mahasiswa123',
  's13': 'mahasiswa123', 's14': 'mahasiswa123', 's15': 'mahasiswa123',
}
const DEFAULT_INSTRUCTOR_PASSWORDS: Record<string, string> = {
  'i1': 'instruktur123', 'i2': 'instruktur123', 'i3': 'instruktur123',
}
const DEFAULT_ADMIN_PASSWORDS: Record<string, string> = { 'a1': 'admin123' }

/** Seed the auth store's students array with known test users */
function seedStudents(): void {
  const s = useAuthStore()
  s.students = [
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
}

/** Seed the auth store's instructors array with known test users */
function seedInstructors(): void {
  const s = useAuthStore()
  s.instructors = [
    { id: 'i1', nama: 'Dr. Andi Wijaya, M.Kom.', email: 'andi@lms.ac.id' },
    { id: 'i2', nama: 'Dr. Dewi Lestari, M.Pd.', email: 'dewi@lms.ac.id' },
    { id: 'i3', nama: 'Prof. Budi Hartono, Ph.D.', email: 'budi@lms.ac.id' },
  ]
}

describe.sequential('Auth Store — CRUD + Login', () => {
  let store: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    store = useAuthStore()
    seedStudents()
    seedInstructors()
    // Restore module-level password maps to defaults
    for (const key of Object.keys(DEMO_STUDENT_PASSWORDS)) delete DEMO_STUDENT_PASSWORDS[key]
    for (const key of Object.keys(DEMO_INSTRUCTOR_PASSWORDS)) delete DEMO_INSTRUCTOR_PASSWORDS[key]
    for (const key of Object.keys(DEMO_ADMIN_PASSWORDS)) delete DEMO_ADMIN_PASSWORDS[key]
    Object.assign(DEMO_STUDENT_PASSWORDS, DEFAULT_STUDENT_PASSWORDS)
    Object.assign(DEMO_INSTRUCTOR_PASSWORDS, DEFAULT_INSTRUCTOR_PASSWORDS)
    Object.assign(DEMO_ADMIN_PASSWORDS, DEFAULT_ADMIN_PASSWORDS)
  })

  // ── Student: Add then Login ──
  describe('addStudent + loginAsStudent', () => {
    it('can login as a newly added student with password', async () => {
      const added = await store.addStudent({
        nama: 'Test Student',
        npm: '20999999',
        kelas: 'Z',
        level: 1,
        session_time: 'morning',
        password: 'testpass123',
      })
      expect(added).toBe(true)

      // Logout first (init populates demo students, login later might interfere)
      await store.logout()

      const result = await store.loginAsStudent('Test Student', '20999999', 'testpass123')
      expect(result).toBe(true)
      expect(store.isStudent).toBe(true)
      expect(store.user?.nama).toBe('Test Student')
      expect(store.user?.npm).toBe('20999999')
    })

    it('allows login with any password in demo mode', async () => {
      await store.addStudent({
        nama: 'Another Student',
        npm: '20888888',
        kelas: 'A',
        level: 2,
        session_time: 'evening',
        password: 'secret456',
      })

      await store.logout()
      const result = await store.loginAsStudent('Another Student', '20888888', 'wrongpass')
      expect(result).toBe(true)
    })

    it('can login as a newly added student without password (no password check)', async () => {
      await store.addStudent({
        nama: 'NoPass Student',
        npm: '20777777',
        kelas: 'B',
        level: 1,
        session_time: 'morning',
      })

      await store.logout()

      // No password set → login should succeed even without password
      const result = await store.loginAsStudent('NoPass Student', '20777777')
      expect(result).toBe(true)
      expect(store.isStudent).toBe(true)
    })
  })

  // ── Student: Update Password then Login ──
  describe('updateStudent password + loginAsStudent', () => {
    it('can login with updated password for existing student', async () => {
      // Update an existing demo student's password
      const updated = await store.updateStudent('s1', {
        nama: 'Ahmad Fauzi',
        npm: '20241001',
        kelas: 'A',
        level: 1,
        session_time: 'morning',
        password: 'newpassword456',
      })
      expect(updated).toBe(true)

      await store.logout()

      // Login with new password
      const result = await store.loginAsStudent('Ahmad Fauzi', '20241001', 'newpassword456')
      expect(result).toBe(true)
      expect(store.isStudent).toBe(true)
      expect(store.user?.nama).toBe('Ahmad Fauzi')
    })

    it('allows old password in demo mode (no password verification)', async () => {
      await store.updateStudent('s2', {
        nama: 'Budi Santoso',
        npm: '20241002',
        kelas: 'A',
        level: 1,
        session_time: 'morning',
        password: 'brandnewpass',
      })

      await store.logout()

      // In demo mode, any password works
      const result = await store.loginAsStudent('Budi Santoso', '20241002', 'mahasiswa123')
      expect(result).toBe(true)
    })

    it('keeps old password when update does not include password field', async () => {
      await store.updateStudent('s3', {
        nama: 'Citra Dewi',
        npm: '20241003',
        kelas: 'A',
        level: 1,
        session_time: 'morning',
        // No password field
      })

      await store.logout()

      // Should still work with original password
      const result = await store.loginAsStudent('Citra Dewi', '20241003', 'mahasiswa123')
      expect(result).toBe(true)
    })
  })

  // ── Instructor: Add then Login ──
  describe('addInstructor + loginAsInstructor', () => {
    it('can login as a newly added instructor with password', async () => {
      const added = await store.addInstructor({
        nama: 'Dr. Test Instructor',
        email: 'test.inst@lms.ac.id',
        password: 'instrpass789',
      })
      expect(added).toBe(true)

      await store.logout()

      const result = await store.loginAsInstructor('Dr. Test Instructor', 'instrpass789')
      expect(result).toBe(true)
      expect(store.isInstructor).toBe(true)
      expect(store.user?.nama).toBe('Dr. Test Instructor')
    })

    it('defaults to instruktur123 when adding instructor without password', async () => {
      await store.addInstructor({
        nama: 'Dr. Default Pass',
        email: 'default@lms.ac.id',
      })

      await store.logout()

      const result = await store.loginAsInstructor('Dr. Default Pass', 'instruktur123')
      expect(result).toBe(true)
    })
  })

  // ── Instructor: Update Password then Login ──
  describe('updateInstructor password + loginAsInstructor', () => {
    it('can login with updated password for existing instructor', async () => {
      await store.updateInstructor('i1', {
        nama: 'Dr. Andi Wijaya, M.Kom.',
        password: 'andinEWpass',
      })

      await store.logout()

      const result = await store.loginAsInstructor('Dr. Andi Wijaya, M.Kom.', 'andinEWpass')
      expect(result).toBe(true)
    })

    it('allows old password in demo mode (no password verification)', async () => {
      await store.updateInstructor('i2', {
        nama: 'Dr. Dewi Lestari, M.Pd.',
        password: 'dewiNEWpass',
      })

      await store.logout()

      // In demo mode, any password works
      const result = await store.loginAsInstructor('Dr. Dewi Lestari, M.Pd.', 'instruktur123')
      expect(result).toBe(true)
    })
  })
})
