<script setup lang="ts">
/**
 * Admin Courses — Full CRUD for courses management.
 * Shows all courses grouped by level/session with add, edit, delete actions.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const coursesStore = useCoursesStore()
const auth = useAuthStore()
const notification = useNotification()

const allCourses = computed(() => coursesStore.allCourses)

onMounted(() => {
  coursesStore.init()
  auth.init()
})

// Group by level
const groupedCourses = computed(() => {
  const groups: Record<number, any[]> = {}
  for (const c of allCourses.value) {
    if (!groups[c.level]) groups[c.level] = []
    groups[c.level].push(c)
  }
  return Object.entries(groups)
    .map(([level, list]) => ({
      level: Number(level),
      morning: list.filter((c: any) => c.session_time === 'morning'),
      evening: list.filter((c: any) => c.session_time === 'evening'),
    }))
    .sort((a, b) => a.level - b.level)
})

// ── Form State ──
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const confirmDeleteId = ref<string | null>(null)

const formKode = ref('')
const formNama = ref('')
const formDeskripsi = ref('')
const formLevel = ref<number>(1)
const formSession = ref<'morning' | 'evening'>('morning')
const formInstructorId = ref('')
const formColor = ref('#3b82f6')
const formIcon = ref('📚')

const instructors = computed(() => auth.instructorList)

const colorOptions = [
  { value: '#3b82f6', label: 'Biru' },
  { value: '#8b5cf6', label: 'Ungu' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#f59e0b', label: 'Kuning' },
  { value: '#10b981', label: 'Hijau' },
  { value: '#ef4444', label: 'Merah' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#a855f7', label: 'Violet' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#f97316', label: 'Oranye' },
  { value: '#dc2626', label: 'Merah Tua' },
]

const iconOptions = ['💻', '🔢', '🧠', '🖥️', '📊', '🗄️', '🌐', '📦', '📐', '🌐', '🛠️', '🤖', '🔒']

function openAddForm() {
  editingId.value = null
  formKode.value = ''
  formNama.value = ''
  formDeskripsi.value = ''
  formLevel.value = 1
  formSession.value = 'morning'
  formInstructorId.value = instructors.value[0]?.id || ''
  formColor.value = '#3b82f6'
  formIcon.value = '📚'
  showForm.value = true
}

function openEditForm(c: any) {
  editingId.value = c.id
  formKode.value = c.kode
  formNama.value = c.nama
  formDeskripsi.value = c.deskripsi || ''
  formLevel.value = c.level
  formSession.value = c.session_time
  formInstructorId.value = c.instructor_id
  formColor.value = c.color || '#3b82f6'
  formIcon.value = c.icon || '📚'
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

async function saveCourse() {
  if (!formNama.value.trim()) {
    notification.warning('Nama mata kuliah harus diisi.')
    return
  }
  if (!formKode.value.trim()) {
    notification.warning('Kode mata kuliah harus diisi.')
    return
  }
  if (!formInstructorId.value) {
    notification.warning('Pilih instruktur.')
    return
  }

  saving.value = true
  try {
    const data = {
      kode: formKode.value.trim(),
      nama: formNama.value.trim(),
      deskripsi: formDeskripsi.value.trim(),
      level: formLevel.value,
      session_time: formSession.value,
      instructor_id: formInstructorId.value,
      color: formColor.value,
      icon: formIcon.value,
    }

    if (editingId.value) {
      await coursesStore.updateCourse(editingId.value, data)
      notification.success('Mata kuliah berhasil diperbarui!')
    } else {
      await coursesStore.addCourse(data)
      notification.success('Mata kuliah berhasil ditambahkan!')
    }

    showForm.value = false
    editingId.value = null
  } catch (err: any) {
    notification.error(err.message || 'Gagal menyimpan mata kuliah.')
  } finally {
    saving.value = false
  }
}

function confirmDelete(c: any) {
  confirmDeleteId.value = c.id
}

function cancelDelete() {
  confirmDeleteId.value = null
}

async function executeDelete() {
  if (!confirmDeleteId.value) return
  try {
    await coursesStore.deleteCourse(confirmDeleteId.value)
    notification.success('Mata kuliah berhasil dihapus.')
    confirmDeleteId.value = null
  } catch (err: any) {
    notification.error(err.message || 'Gagal menghapus mata kuliah.')
  }
}

function getInstructorName(id: string): string {
  const match = instructors.value.find((i: any) => i.id === id)
  return match?.nama || id
}

function getLevelLabel(lv: number): string {
  if (lv === 5) return 'Apoteker'
  return `Level ${lv}`
}
</script>

<template>
  <div class="courses-page">
    <div class="page-header">
      <div>
        <h1>Mata Kuliah</h1>
        <p class="text-muted">Kelola seluruh mata kuliah ({{ allCourses.length }}).</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openAddForm">
        + Tambah Mata Kuliah
      </button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm" class="card form-card">
      <h3>{{ editingId ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru' }}</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Kode MK</label>
          <input
            v-model="formKode"
            type="text"
            class="form-input"
            placeholder="Contoh: MK101"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Nama Mata Kuliah</label>
          <input
            v-model="formNama"
            type="text"
            class="form-input"
            placeholder="Nama mata kuliah"
          />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Deskripsi</label>
          <textarea
            v-model="formDeskripsi"
            class="form-textarea"
            rows="2"
            placeholder="Deskripsi mata kuliah"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Level</label>
          <select v-model="formLevel" class="form-select">
            <option :value="1">Level 1</option>
            <option :value="2">Level 2</option>
            <option :value="3">Level 3</option>
            <option :value="4">Level 4</option>
            <option :value="5">Apoteker</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Waktu</label>
          <select v-model="formSession" class="form-select">
            <option value="morning">Pagi</option>
            <option value="evening">Malam</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Instruktur</label>
          <select v-model="formInstructorId" class="form-select">
            <option value="" disabled>Pilih instruktur</option>
            <option
              v-for="inst in instructors"
              :key="inst.id"
              :value="inst.id"
            >
              {{ inst.nama }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ikon</label>
          <select v-model="formIcon" class="form-select">
            <option v-for="icon in iconOptions" :key="icon" :value="icon">
              {{ icon }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Warna</label>
          <div class="color-picker">
            <button
              v-for="c in colorOptions"
              :key="c.value"
              class="color-swatch"
              :class="{ active: formColor === c.value }"
              :style="{ backgroundColor: c.value }"
              :title="c.label"
              @click="formColor = c.value"
            />
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="cancelForm">Batal</button>
        <button
          class="btn btn-primary"
          :disabled="saving"
          @click="saveCourse"
        >
          {{ saving ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan' }}
        </button>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="confirmDeleteId" class="card confirm-card">
      <p>Hapus mata kuliah ini? Semua data terkait (materi, tugas, progress) juga akan dihapus.</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelDelete">Batal</button>
        <button class="btn btn-danger btn-sm" @click="executeDelete">Hapus</button>
      </div>
    </div>

    <!-- Course list -->
    <div v-if="allCourses.length === 0" class="empty-state card">
      <p>Belum ada mata kuliah.</p>
    </div>

    <div v-else class="level-groups">
      <div
        v-for="group in groupedCourses"
        :key="group.level"
        class="level-group"
      >
        <h2 class="level-title">{{ getLevelLabel(group.level) }}</h2>

        <div v-if="group.morning.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-primary">Pagi</span>
            {{ group.morning.length }} Mata Kuliah
          </h3>
          <div class="course-list">
            <div
              v-for="c in group.morning"
              :key="c.id"
              class="card course-card"
            >
              <span
                class="course-icon"
                :style="{ backgroundColor: c.color + '20', color: c.color }"
              >
                {{ c.icon || '📚' }}
              </span>
              <div class="course-info">
                <span class="course-name">{{ c.nama }}</span>
                <span class="course-meta">{{ c.kode }} • {{ getInstructorName(c.instructor_id) }}</span>
              </div>
              <div class="course-actions">
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  title="Edit"
                  @click.stop="openEditForm(c)"
                >
                  ✏️
                </button>
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  title="Hapus"
                  @click.stop="confirmDelete(c)"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="group.evening.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-warning">Malam</span>
            {{ group.evening.length }} Mata Kuliah
          </h3>
          <div class="course-list">
            <div
              v-for="c in group.evening"
              :key="c.id"
              class="card course-card"
            >
              <span
                class="course-icon"
                :style="{ backgroundColor: c.color + '20', color: c.color }"
              >
                {{ c.icon || '📚' }}
              </span>
              <div class="course-info">
                <span class="course-name">{{ c.nama }}</span>
                <span class="course-meta">{{ c.kode }} • {{ getInstructorName(c.instructor_id) }}</span>
              </div>
              <div class="course-actions">
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  title="Edit"
                  @click.stop="openEditForm(c)"
                >
                  ✏️
                </button>
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  title="Hapus"
                  @click.stop="confirmDelete(c)"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.courses-page {
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.text-muted {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0;
}

/* ── Form ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--color-white);
  color: var(--color-neutral-900);
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.color-swatch {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  padding: 0;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  border-color: var(--color-neutral-900);
  transform: scale(1.15);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* ── Level Groups ── */
.level-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.level-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color, #e2e8f0);
}

.session-group {
  margin-bottom: 1rem;
}

.session-title {
  font-size: 0.9375rem;
  font-weight: 500;
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.course-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.75rem;
}

.course-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  text-decoration: none;
  color: inherit;
}

.course-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.course-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.course-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.course-meta {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.btn-icon {
  font-size: 0.875rem;
  padding: 0.25rem 0.375rem;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}

.badge {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-primary {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  font-weight: 600;
  border-radius: var(--radius-md, 0.5rem);
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  font-family: inherit;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--color-primary-500);
  color: white;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-600);
}

.btn-ghost {
  background: transparent;
  color: var(--color-neutral-600);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.btn-ghost:hover {
  background: var(--color-neutral-100);
  color: var(--color-neutral-800);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .course-list {
    grid-template-columns: 1fr;
  }
}
</style>
