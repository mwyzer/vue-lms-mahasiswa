<script setup lang="ts">
/**
 * Instructor Lessons Management — View, add, and delete lessons.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const notification = useNotification()

const courseId = computed(() => route.params.id as string)
const showAddForm = ref(false)
const newJudul = ref('')
const newKonten = ref('')
const saving = ref(false)

onMounted(() => {
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)
const lessons = computed(() => coursesStore.lessons)

function openAddForm() {
  newJudul.value = ''
  newKonten.value = ''
  showAddForm.value = true
}

function cancelAdd() {
  showAddForm.value = false
  newJudul.value = ''
  newKonten.value = ''
}

function addLesson() {
  if (!newJudul.value.trim()) {
    notification.warning('Judul materi harus diisi.')
    return
  }
  saving.value = true
  setTimeout(() => {
    coursesStore.addLesson(courseId.value, newJudul.value.trim(), newKonten.value.trim())
    notification.success('Materi berhasil ditambahkan!')
    showAddForm.value = false
    saving.value = false
  }, 200)
}

function confirmDelete(lessonId: string, judul: string) {
  if (confirm(`Hapus materi "${judul}"?`)) {
    coursesStore.deleteLesson(lessonId)
    notification.success('Materi berhasil dihapus.')
  }
}
</script>

<template>
  <div class="instructor-lessons-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali ke Mata Kuliah
    </button>

    <div v-if="!course" class="empty-state card">
      <p>Mata kuliah tidak ditemukan.</p>
    </div>

    <template v-else>
      <div class="page-header">
        <div>
          <h1>Materi: {{ course.nama }}</h1>
          <p class="text-muted">{{ course.kode }} • Kelola materi perkuliahan</p>
        </div>
        <button v-if="!showAddForm" class="btn btn-primary btn-sm" @click="openAddForm">
          + Tambah Materi
        </button>
      </div>

      <!-- Add lesson form -->
      <div v-if="showAddForm" class="card form-card">
        <h3>Tambah Materi Baru</h3>
        <div class="form-group">
          <label class="form-label">Judul Materi</label>
          <input
            v-model="newJudul"
            type="text"
            class="form-input"
            placeholder="Contoh: Pengantar Pemrograman"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Konten</label>
          <textarea
            v-model="newKonten"
            class="form-textarea"
            rows="4"
            placeholder="Tulis konten materi di sini..."
          />
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost btn-sm" @click="cancelAdd">Batal</button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="saving || !newJudul.trim()"
            @click="addLesson"
          >
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>

      <!-- Lesson list -->
      <div v-if="lessons.length === 0" class="empty-state card">
        <p>Belum ada materi. Klik "Tambah Materi" untuk memulai.</p>
      </div>

      <div v-else class="lesson-list">
        <div
          v-for="lesson in lessons"
          :key="lesson.id"
          class="card lesson-card"
        >
          <div class="lesson-left">
            <span class="lesson-number">{{ lesson.urutan }}</span>
            <div class="lesson-info">
              <span class="lesson-title">{{ lesson.judul }}</span>
              <span v-if="lesson.konten" class="lesson-preview text-sm text-muted">
                {{ lesson.konten.substring(0, 80) }}{{ lesson.konten.length > 80 ? '...' : '' }}
              </span>
            </div>
          </div>
          <div class="lesson-actions">
            <button
              class="btn btn-danger btn-sm"
              @click="confirmDelete(lesson.id, lesson.judul)"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.instructor-lessons-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.text-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.form-card {
  margin-bottom: 1rem;
}

.form-card h3 {
  font-size: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 0.375rem;
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  background-color: white;
  color: var(--color-neutral-800);
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
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  background-color: white;
  color: var(--color-neutral-800);
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lesson-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
}

.lesson-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.lesson-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-neutral-100);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  flex-shrink: 0;
}

.lesson-info {
  display: flex;
  flex-direction: column;
}

.lesson-title {
  font-weight: 500;
  font-size: 0.9375rem;
}

.lesson-preview {
  margin-top: 0.125rem;
}

.lesson-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}
</style>
