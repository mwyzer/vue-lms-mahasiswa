<script setup lang="ts">
/**
 * Instructor Course Detail — Shows course info, enrolled students, management links.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const announcementsStore = useAnnouncementsStore()
const notification = useNotification()
const auth = useAuthStore()

const courseId = computed(() => route.params.id as string)
const students = computed(() => auth.studentRoster as any[])

onMounted(async () => {
  await coursesStore.init()
  coursesStore.setCurrentCourse(courseId.value)
  await announcementsStore.init()
})

const course = computed(() => coursesStore.currentCourse)

// ── Announcements ──
const courseAnnouncements = computed(() =>
  announcementsStore.announcementsByCourse(courseId.value)
)

const showAnnouncementForm = ref(false)
const annJudul = ref('')
const annKonten = ref('')
const savingAnnouncement = ref(false)

function openAnnouncementForm() {
  annJudul.value = ''
  annKonten.value = ''
  showAnnouncementForm.value = true
}

function cancelAnnouncement() {
  showAnnouncementForm.value = false
  annJudul.value = ''
  annKonten.value = ''
}

async function saveAnnouncement() {
  if (!annJudul.value.trim()) {
    notification.warning('Judul pengumuman harus diisi.')
    return
  }
  if (!annKonten.value.trim()) {
    notification.warning('Konten pengumuman harus diisi.')
    return
  }

  savingAnnouncement.value = true
  const ok = await announcementsStore.createAnnouncement(
    courseId.value,
    annJudul.value,
    annKonten.value
  )
  savingAnnouncement.value = false

  if (ok) {
    notification.success('Pengumuman berhasil dibuat!')
    showAnnouncementForm.value = false
  } else {
    notification.error(announcementsStore.error || 'Gagal membuat pengumuman.')
  }
}

async function deleteAnnouncement(id: string) {
  const ok = await announcementsStore.deleteAnnouncement(id)
  if (ok) {
    notification.success('Pengumuman berhasil dihapus.')
  } else {
    notification.error('Gagal menghapus pengumuman.')
  }
}

// Find enrolled students using reverse lookup from DEMO_ENROLLMENTS
const enrolledStudents = computed(() => {
  if (!course.value) return []
  return students.value.filter(
    (s: any) => s.level === course.value?.level && s.session_time === course.value?.session_time
  )
})

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}
</script>

<template>
  <div class="instructor-course-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali
    </button>

    <div v-if="!course" class="empty-state card">
      <p>Mata kuliah tidak ditemukan.</p>
      <NuxtLink to="/instructor/courses" class="btn btn-primary btn-sm mt-1">
        Kembali ke Daftar
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Course info -->
      <div class="card course-header-card">
        <div class="course-top">
          <div class="course-icon">{{ course.icon }}</div>
          <div class="course-meta">
            <span class="course-code">{{ course.kode }}</span>
            <h1>{{ course.nama }}</h1>
            <div class="course-badges">
              <span class="badge badge-level">Level {{ course.level }}</span>
              <span class="badge badge-session">{{
                course.session_time === 'morning' ? 'Pagi' : 'Malam'
              }}</span>
            </div>
          </div>
        </div>
        <p class="course-desc">{{ course.deskripsi }}</p>
      </div>

      <!-- Quick Actions -->
      <div class="action-cards">
        <NuxtLink
          :to="`/instructor/courses/${course.id}/lessons`"
          class="card action-card"
        >
          <div class="action-icon">📖</div>
          <div class="action-text">
            <strong>Materi</strong>
            <span>Kelola materi perkuliahan</span>
          </div>
          <span class="action-arrow">→</span>
        </NuxtLink>

        <NuxtLink
          :to="`/instructor/courses/${course.id}/assignments`"
          class="card action-card"
        >
          <div class="action-icon">📝</div>
          <div class="action-text">
            <strong>Tugas</strong>
            <span>Kelola tugas dan penilaian</span>
          </div>
          <span class="action-arrow">→</span>
        </NuxtLink>

        <NuxtLink
          :to="`/instructor/courses/${course.id}/quiz`"
          class="card action-card"
        >
          <div class="action-icon">✍️</div>
          <div class="action-text">
            <strong>Kuis & Ujian</strong>
            <span>Buat kuis interaktif dan ujian</span>
          </div>
          <span class="action-arrow">→</span>
        </NuxtLink>
      </div>

      <!-- Enrolled Students -->
      <div class="card students-card">
        <h2>Mahasiswa Terdaftar ({{ enrolledStudents.length }})</h2>
        <div v-if="enrolledStudents.length === 0" class="empty-state">
          <p>Belum ada mahasiswa terdaftar.</p>
        </div>
        <div v-else class="student-list">
          <div
            v-for="s in enrolledStudents"
            :key="s.id"
            class="student-row"
          >
            <div class="student-avatar">
              {{ s.nama?.charAt(0) || '?' }}
            </div>
            <div class="student-info">
              <strong>{{ s.nama }}</strong>
              <span class="text-sm text-muted"
                >{{ s.npm }} • {{ s.level }}{{ s.session_time === 'morning' ? 'A' : 'B' }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Announcements Management -->
      <div class="card announcements-card">
        <div class="announcements-header">
          <h2>Pengumuman ({{ courseAnnouncements.length }})</h2>
          <button class="btn btn-primary btn-sm" @click="openAnnouncementForm">
            + Pengumuman
          </button>
        </div>

        <!-- New announcement form -->
        <div v-if="showAnnouncementForm" class="announcement-form">
          <input
            v-model="annJudul"
            type="text"
            class="form-input"
            placeholder="Judul pengumuman"
          />
          <textarea
            v-model="annKonten"
            class="form-textarea"
            rows="3"
            placeholder="Isi pengumuman..."
          />
          <div class="form-actions">
            <button class="btn btn-ghost btn-sm" @click="cancelAnnouncement">Batal</button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="savingAnnouncement"
              @click="saveAnnouncement"
            >
              {{ savingAnnouncement ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>

        <!-- Announcement list -->
        <div v-if="courseAnnouncements.length === 0 && !showAnnouncementForm" class="empty-state">
          <p>Belum ada pengumuman untuk mata kuliah ini.</p>
        </div>

        <div v-else class="announcement-list">
          <div
            v-for="ann in courseAnnouncements"
            :key="ann.id"
            class="announcement-item"
          >
            <div class="announcement-body">
              <div class="announcement-head">
                <strong>{{ ann.judul }}</strong>
                <span class="text-xs text-muted">{{ formatDate(ann.created_at) }}</span>
              </div>
              <p class="announcement-text">{{ ann.konten }}</p>
            </div>
            <button
              class="btn btn-ghost btn-sm btn-danger"
              title="Hapus pengumuman"
              @click="deleteAnnouncement(ann.id)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.instructor-course-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.course-header-card {
  margin-bottom: 1rem;
}

.course-top {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.course-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.course-meta h1 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.course-code {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.course-badges {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.badge-level {
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
}

.badge-session {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-600);
}

.course-desc {
  color: var(--color-neutral-500);
  font-size: 0.9375rem;
}

/* ── Action Cards ─────────────────────────── */
.action-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s, transform 0.15s;
}

.action-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.action-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.action-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.action-text strong {
  font-size: 0.9375rem;
}

.action-text span {
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.action-arrow {
  color: var(--color-neutral-400);
  font-size: 1.25rem;
}

/* ── Students Card ────────────────────────── */
.students-card h2 {
  font-size: 1rem;
  margin-bottom: 1rem;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.student-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-neutral-100);
}

.student-row:last-child {
  border-bottom: none;
}

.student-avatar {
  width: 36px;
  height: 36px;
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

.student-info {
  display: flex;
  flex-direction: column;
}

.student-info strong {
  font-size: 0.875rem;
}

.text-muted {
  color: var(--color-neutral-500);
}

.text-sm {
  font-size: 0.8125rem;
}

.mt-1 {
  margin-top: 0.5rem;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-neutral-500);
}

/* ── Announcements ─────────────────────────── */
.announcements-card {
  margin-top: 1.5rem;
}

.announcements-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.announcements-header h2 {
  font-size: 1rem;
}

.announcement-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--color-white);
  color: var(--color-neutral-900);
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--color-white);
  color: var(--color-neutral-900);
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.announcement-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--color-neutral-50);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary-400);
}

.announcement-body {
  flex: 1;
  min-width: 0;
}

.announcement-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.announcement-head strong {
  font-size: 0.875rem;
  color: var(--color-neutral-800);
}

.announcement-text {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  line-height: 1.5;
  margin: 0;
}

.btn-danger {
  color: var(--color-red-500);
  opacity: 0.6;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.btn-danger:hover {
  opacity: 1;
  color: var(--color-red-600);
}
</style>
