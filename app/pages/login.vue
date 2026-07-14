<script setup lang="ts">
/**
 * Login Page — Multi-step role-based authentication.
 *
 * Flow:
 *   1. Choose role (Student / Instructor)
 *   2a. Student → Choose Level → Choose Session → Pick name+NPM from roster
 *   2b. Instructor → Pick name from list → Enter password
 */
definePageMeta({
  layout: 'default',
  middleware: 'guest'
})

const auth = useAuthStore()
const router = useRouter()

// ── Step management ──
const step = ref<'role' | 'level' | 'session' | 'roster' | 'instructor-list' | 'instructor-password'>('role')
const selectedRole = ref<'student' | 'instructor' | null>(null)
const selectedLevel = ref<number | null>(null)
const selectedSession = ref<'morning' | 'evening' | null>(null)
const selectedInstructorId = ref<string | null>(null)
const instructorPassword = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)

// ── Computed ──
const levels = [1, 2, 3, 4]

const sessions = [
  { value: 'morning' as const, label: 'Pagi', icon: '🌅' },
  { value: 'evening' as const, label: 'Malam', icon: '🌙' },
]

const filteredStudents = computed(() => {
  if (!selectedLevel.value || !selectedSession.value) return []
  return auth.studentRoster.filter(
    (s) => s.level === selectedLevel.value && s.session_time === selectedSession.value
  )
})

const instructors = computed(() => auth.instructorList)

const selectedInstructorName = computed(() => {
  if (!selectedInstructorId.value) return ''
  return instructors.value.find((i) => i.id === selectedInstructorId.value)?.nama || ''
})

// ── Demo mode banner ──
const isDemoMode = computed(() => auth.isDemoMode)

// ── Actions ──
function selectRole(role: 'student' | 'instructor') {
  selectedRole.value = role
  loginError.value = ''

  if (role === 'student') {
    step.value = 'level'
  } else {
    step.value = 'instructor-list'
  }
}

function selectLevel(level: number) {
  selectedLevel.value = level
  loginError.value = ''
  step.value = 'session'
}

function selectSession(session: 'morning' | 'evening') {
  selectedSession.value = session
  loginError.value = ''
  step.value = 'roster'
}

function selectInstructor(id: string) {
  selectedInstructorId.value = id
  instructorPassword.value = ''
  loginError.value = ''
  step.value = 'instructor-password'
}

function loginAsStudent(studentId: string, nama: string, npm: string) {
  loginError.value = ''
  isLoggingIn.value = true

  // Small delay to show loading state
  setTimeout(() => {
    const success = auth.loginAsStudent(nama, npm)
    isLoggingIn.value = false

    if (success) {
      router.push('/dashboard')
    } else {
      loginError.value = auth.error || 'Login gagal. Silakan coba kembali.'
    }
  }, 500)
}

function loginAsInstructor() {
  if (!selectedInstructorId.value || !instructorPassword.value) {
    loginError.value = 'Silakan masukkan password.'
    return
  }

  loginError.value = ''
  isLoggingIn.value = true

  const nama = instructors.value.find((i) => i.id === selectedInstructorId.value)?.nama || ''

  setTimeout(() => {
    const success = auth.loginAsInstructor(nama, instructorPassword.value)
    isLoggingIn.value = false

    if (success) {
      router.push('/instructor/dashboard')
    } else {
      loginError.value = auth.error || 'Password salah. Silakan coba kembali.'
    }
  }, 500)
}

function goBack() {
  loginError.value = ''
  if (step.value === 'level') { step.value = 'role'; selectedRole.value = null }
  else if (step.value === 'session') { step.value = 'level'; selectedLevel.value = null }
  else if (step.value === 'roster') { step.value = 'session'; selectedSession.value = null }
  else if (step.value === 'instructor-list') { step.value = 'role'; selectedRole.value = null }
  else if (step.value === 'instructor-password') { step.value = 'instructor-list'; selectedInstructorId.value = null; instructorPassword.value = '' }
}

function resetLogin() {
  step.value = 'role'
  selectedRole.value = null
  selectedLevel.value = null
  selectedSession.value = null
  selectedInstructorId.value = null
  instructorPassword.value = ''
  loginError.value = ''
}
</script>

<template>
  <div class="login-page">
    <div class="container">
      <div class="login-card">
        <!-- Demo Mode Banner -->
        <div v-if="isDemoMode" class="demo-banner">
          🔧 <strong>Mode Demo</strong> — Data bersifat lokal, tidak perlu koneksi database.
        </div>

        <!-- Back button -->
        <button v-if="step !== 'role'" class="btn-back" @click="goBack">
          ← Kembali
        </button>

        <!-- ══════ STEP 1: Role Selection ══════ -->
        <template v-if="step === 'role'">
          <div class="login-header">
            <div class="login-icon">🔐</div>
            <h1>Masuk ke LMS</h1>
            <p>Pilih peran Anda untuk melanjutkan.</p>
          </div>

          <div class="role-cards">
            <button class="role-card" @click="selectRole('student')">
              <span class="role-icon">👨‍🎓</span>
              <span class="role-title">Mahasiswa</span>
              <span class="role-desc">Akses mata kuliah, materi, dan tugas</span>
            </button>
            <button class="role-card" @click="selectRole('instructor')">
              <span class="role-icon">👨‍🏫</span>
              <span class="role-title">Instruktur</span>
              <span class="role-desc">Kelola kelas, materi, dan penilaian</span>
            </button>
          </div>
        </template>

        <!-- ══════ STEP 2a: Level Selection (Student) ══════ -->
        <template v-if="step === 'level'">
          <div class="login-header">
            <div class="login-icon">📊</div>
            <h1>Pilih Level Kelas</h1>
            <p>Pilih level kelas Anda (1–4).</p>
          </div>

          <div class="level-grid">
            <button
              v-for="level in levels"
              :key="level"
              class="level-btn"
              @click="selectLevel(level)"
            >
              <span class="level-num">{{ level }}</span>
              <span class="level-label">Level {{ level }}</span>
            </button>
          </div>
        </template>

        <!-- ══════ STEP 3a: Session Selection (Student) ══════ -->
        <template v-if="step === 'session'">
          <div class="login-header">
            <div class="login-icon">⏰</div>
            <h1>Pilih Waktu Kelas</h1>
            <p>Pilih sesi perkuliahan Anda.</p>
          </div>

          <div class="session-grid">
            <button
              v-for="s in sessions"
              :key="s.value"
              class="session-btn"
              @click="selectSession(s.value)"
            >
              <span class="session-icon">{{ s.icon }}</span>
              <span class="session-label">{{ s.label }}</span>
            </button>
          </div>
        </template>

        <!-- ══════ STEP 4a: Student Roster ══════ -->
        <template v-if="step === 'roster'">
          <div class="login-header">
            <div class="login-icon">👥</div>
            <h1>Pilih Identitas</h1>
            <p>
              Level {{ selectedLevel }} •
              {{ selectedSession === 'morning' ? 'Pagi' : 'Malam' }}
              — {{ filteredStudents.length }} mahasiswa
            </p>
          </div>

          <div v-if="isLoggingIn" class="loading-state">
            <div class="spinner" />
            <p>Memproses login...</p>
          </div>

          <div v-else class="roster-list">
            <button
              v-for="student in filteredStudents"
              :key="student.id"
              class="roster-item"
              @click="loginAsStudent(student.id, student.nama, student.npm)"
            >
              <span class="roster-avatar">{{ student.nama.charAt(0) }}</span>
              <div class="roster-info">
                <span class="roster-name">{{ student.nama }}</span>
                <span class="roster-npm">{{ student.npm }} • {{ student.kelas }}</span>
              </div>
            </button>

            <div v-if="filteredStudents.length === 0" class="empty-state">
              <p>Tidak ada mahasiswa di kelas ini.</p>
              <button class="btn btn-secondary btn-sm" @click="resetLogin">
                Coba kelas lain
              </button>
            </div>
          </div>
        </template>

        <!-- ══════ STEP 2b: Instructor List ══════ -->
        <template v-if="step === 'instructor-list'">
          <div class="login-header">
            <div class="login-icon">👨‍🏫</div>
            <h1>Pilih Instruktur</h1>
            <p>Pilih nama Anda dari daftar instruktur.</p>
          </div>

          <div class="instructor-list">
            <button
              v-for="inst in instructors"
              :key="inst.id"
              class="instructor-item"
              @click="selectInstructor(inst.id)"
            >
              <span class="instructor-avatar">{{ inst.nama.charAt(0) }}</span>
              <div class="instructor-info">
                <span class="instructor-name">{{ inst.nama }}</span>
                <span v-if="inst.email" class="instructor-email">{{ inst.email }}</span>
              </div>
            </button>
          </div>
        </template>

        <!-- ══════ STEP 3b: Instructor Password ══════ -->
        <template v-if="step === 'instructor-password'">
          <div class="login-header">
            <div class="login-icon">🔑</div>
            <h1>Selamat datang,</h1>
            <p class="instructor-greeting">{{ selectedInstructorName }}</p>
          </div>

          <form class="password-form" @submit.prevent="loginAsInstructor">
            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                v-model="instructorPassword"
                type="password"
                placeholder="Masukkan password"
                autocomplete="current-password"
              />
            </div>

            <div v-if="loginError" class="error-msg">
              {{ loginError }}
            </div>

            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isLoggingIn || !instructorPassword"
            >
              {{ isLoggingIn ? 'Memproses...' : 'Masuk' }}
            </button>
          </form>
        </template>

        <!-- Error message (for roster/level steps) -->
        <div v-if="loginError && step !== 'instructor-password'" class="error-msg">
          {{ loginError }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: calc(100vh - var(--header-height) * 2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
  background-color: var(--color-neutral-50);
}

.login-card {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-neutral-200);
  padding: 2.5rem 2rem;
  position: relative;
}

.demo-banner {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  padding: 0.625rem 1rem;
  font-size: 0.8rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-neutral-500);
  margin-bottom: 1rem;
  padding: 0.25rem 0;
}

.btn-back:hover {
  color: var(--color-neutral-800);
}

/* ── Header ──────────────────────────────── */
.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.login-header h1 {
  font-size: 1.5rem;
  margin-bottom: 0.375rem;
}

.login-header p {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.instructor-greeting {
  font-size: 1rem !important;
  font-weight: 600;
  color: var(--color-primary-700) !important;
}

/* ── Role Cards ──────────────────────────── */
.role-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.role-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border: 2px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  background: white;
}

.role-card:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}

.role-icon {
  font-size: 2rem;
}

.role-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.role-desc {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
  display: block;
  margin-top: 0.125rem;
}

/* ── Level Grid ──────────────────────────── */
.level-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.level-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  border: 2px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.level-btn:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}

.level-num {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-primary-600);
}

.level-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

/* ── Session Grid ────────────────────────── */
.session-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.session-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  border: 2px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.session-btn:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}

.session-icon {
  font-size: 2rem;
}

.session-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

/* ── Roster List ─────────────────────────── */
.roster-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 340px;
  overflow-y: auto;
}

.roster-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
  background: white;
}

.roster-item:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}

.roster-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.roster-info {
  display: flex;
  flex-direction: column;
}

.roster-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-neutral-800);
}

.roster-npm {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
}

/* ── Instructor List ─────────────────────── */
.instructor-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.instructor-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
  background: white;
}

.instructor-item:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}

.instructor-avatar {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background-color: #fef3c7;
  color: #92400e;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.instructor-info {
  display: flex;
  flex-direction: column;
}

.instructor-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-neutral-800);
}

.instructor-email {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
}

/* ── Password Form ───────────────────────── */
.password-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

/* ── Error ───────────────────────────────── */
.error-msg {
  background-color: #fce4ec;
  color: #c62828;
  border: 1px solid #f8bbd0;
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  margin-top: 1rem;
}

/* ── Loading ─────────────────────────────── */
.loading-state {
  text-align: center;
  padding: 2rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-neutral-200);
  border-top-color: var(--color-primary-600);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}
</style>
