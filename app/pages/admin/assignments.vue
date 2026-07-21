<script setup lang="ts">
/**
 * Admin Assignments — Full CRUD for assignments across all courses.
 * Add, edit, delete assignments with course + instructor assignment.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

import type { Assignment } from '~/types/database'

const assignmentsStore = useAssignmentsStore()
const coursesStore = useCoursesStore()
const auth = useAuthStore()
const notification = useNotification()

onMounted(async () => {
  await coursesStore.init()
  await auth.init()
  await assignmentsStore.init()
})

const allCourses = computed(() => coursesStore.allCourses)
const instructors = computed(() => auth.instructorList)

/** Reactive view of all assignments with course info joined */
const allAssignments = computed(() => {
  if (assignmentsStore.isDemoMode) {
    return assignmentsStore.assignments.map((a: any) => ({
      ...a,
      course_name: coursesStore.allCourses.find((c: any) => c.id === a.course_id)?.nama || '',
      course_kode: coursesStore.allCourses.find((c: any) => c.id === a.course_id)?.kode || '',
    }))
  }
  return assignmentsStore.sbAssignments.map((a: any) => ({
    ...a,
    course_name: assignmentsStore.sbCourseNames[a.course_id]?.nama || '',
    course_kode: assignmentsStore.sbCourseNames[a.course_id]?.kode || '',
  }))
})

// Access demo assignments directly (imported from store module)
// We need a reactive reference. The getter myAssignments is filter-only.
// For admin view, use the raw assignments with course info joined.
const groupedAssignments = computed(() => {
  const groups: Record<string, { course: any; items: any[] }> = {}
  for (const a of allAssignments.value) {
    const cid = a.course_id
    if (!groups[cid]) {
      const course = allCourses.value.find((c: any) => c.id === cid)
      groups[cid] = {
        course: course || { id: cid, nama: cid, kode: '', icon: '📝', color: '#64748b' },
        items: [],
      }
    }
    groups[cid].items.push(a)
  }
  return Object.entries(groups)
    .map(([, group]) => group)
    .sort((a, b) => (a.course.nama || '').localeCompare(b.course.nama || ''))
})

// ── Form State ──
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const confirmDeleteId = ref<string | null>(null)

const formCourseId = ref('')
const formJudul = ref('')
const formDeskripsi = ref('')
const formTenggat = ref('')

function openAddForm() {
  editingId.value = null
  formCourseId.value = allCourses.value[0]?.id || ''
  formJudul.value = ''
  formDeskripsi.value = ''
  formTenggat.value = ''
  showForm.value = true
}

function openEditForm(a: any) {
  editingId.value = a.id
  formCourseId.value = a.course_id
  formJudul.value = a.judul
  formDeskripsi.value = a.deskripsi || ''
  formTenggat.value = a.tenggat_waktu
    ? new Date(a.tenggat_waktu).toISOString().slice(0, 16)
    : ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

async function saveAssignment() {
  if (!formJudul.value.trim()) {
    notification.warning('Judul tugas harus diisi.')
    return
  }
  if (!formCourseId.value) {
    notification.warning('Pilih mata kuliah.')
    return
  }

  saving.value = true
  try {
    const tenggatIso = formTenggat.value
      ? new Date(formTenggat.value).toISOString()
      : ''

    if (editingId.value) {
      await assignmentsStore.updateAssignment(editingId.value, {
        judul: formJudul.value.trim(),
        deskripsi: formDeskripsi.value.trim() || undefined,
        tenggat_waktu: tenggatIso || undefined,
      })
      notification.success('Tugas berhasil diperbarui!')
    } else {
      // Get instructor from selected course
      const course = allCourses.value.find((c: any) => c.id === formCourseId.value)
      await assignmentsStore.addAssignment(
        formCourseId.value,
        formJudul.value.trim(),
        formDeskripsi.value.trim() || '',
        tenggatIso,
        course?.instructor_id,
      )
      notification.success('Tugas berhasil ditambahkan!')
    }

    showForm.value = false
    editingId.value = null
  } catch (err: any) {
    notification.error(err.message || 'Gagal menyimpan tugas.')
  } finally {
    saving.value = false
  }
}

function confirmDelete(a: any) {
  confirmDeleteId.value = a.id
}

function cancelDelete() {
  confirmDeleteId.value = null
}

async function executeDelete() {
  if (!confirmDeleteId.value) return
  try {
    await assignmentsStore.deleteAssignment(confirmDeleteId.value)
    notification.success('Tugas berhasil dihapus.')
    confirmDeleteId.value = null
  } catch (err: any) {
    notification.error(err.message || 'Gagal menghapus tugas.')
  }
}

function getCourseInfo(cid: string) {
  const c = allCourses.value.find((c: any) => c.id === cid)
  return c ? { kode: c.kode, nama: c.nama, icon: c.icon, color: c.color } : { kode: cid, nama: cid, icon: '📝', color: '#64748b' }
}

function getInstructorName(id: string): string {
  const match = instructors.value.find((i: any) => i.id === id)
  return match?.nama || id
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="assignments-page">
    <div class="page-header">
      <div>
        <h1>Tugas</h1>
        <p class="text-muted">Kelola seluruh tugas dari semua mata kuliah ({{ allAssignments.length }}).</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openAddForm">
        + Tambah Tugas
      </button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm" class="card form-card">
      <h3>{{ editingId ? 'Edit Tugas' : 'Tambah Tugas Baru' }}</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Mata Kuliah</label>
          <select v-model="formCourseId" class="form-select" :disabled="!!editingId">
            <option value="" disabled>Pilih mata kuliah</option>
            <option
              v-for="c in allCourses"
              :key="c.id"
              :value="c.id"
            >
              {{ c.kode }} — {{ c.nama }}
            </option>
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Judul Tugas</label>
          <input
            v-model="formJudul"
            type="text"
            class="form-input"
            placeholder="Contoh: Tugas 1: Hello World"
          />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Deskripsi (opsional)</label>
          <textarea
            v-model="formDeskripsi"
            class="form-textarea"
            rows="3"
            placeholder="Deskripsi tugas..."
          />
        </div>
        <div class="form-group">
          <label class="form-label">Tenggat Waktu (opsional)</label>
          <input
            v-model="formTenggat"
            type="datetime-local"
            class="form-input"
          />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelForm">Batal</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="saving || !formJudul.trim() || !formCourseId"
          @click="saveAssignment"
        >
          {{ saving ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan' }}
        </button>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="confirmDeleteId" class="card confirm-card">
      <p>Hapus tugas ini? Semua pengumpulan dan nilai terkait juga akan dihapus.</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelDelete">Batal</button>
        <button class="btn btn-danger btn-sm" @click="executeDelete">Hapus</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="allAssignments.length === 0" class="empty-state card">
      <p>Belum ada tugas. Klik "Tambah Tugas" untuk membuat tugas baru.</p>
    </div>

    <!-- Grouped by Course -->
    <div v-else class="course-groups">
      <div
        v-for="group in groupedAssignments"
        :key="group.course.id"
        class="course-group"
      >
        <h2 class="course-group-title">
          <span class="course-badge" :style="{ background: group.course.color || '#64748b' }">
            {{ group.course.kode }}
          </span>
          {{ group.course.nama }}
          <span class="count-badge">{{ group.items.length }} tugas</span>
        </h2>

        <div class="assignment-list">
          <div
            v-for="a in group.items"
            :key="a.id"
            class="card assignment-card"
          >
            <div class="assignment-left">
              <span class="assignment-icon">{{ group.course.icon || '📝' }}</span>
              <div class="assignment-info">
                <span class="assignment-title">{{ a.judul }}</span>
                <div class="assignment-meta">
                  <span v-if="a.tenggat_waktu" class="assignment-deadline">
                    ⏰ {{ formatDate(a.tenggat_waktu) }}
                  </span>
                  <span class="assignment-deskripsi" v-if="a.deskripsi">
                    {{ a.deskripsi.length > 80 ? a.deskripsi.slice(0, 80) + '...' : a.deskripsi }}
                  </span>
                </div>
              </div>
            </div>
            <div class="assignment-actions">
              <button class="btn btn-ghost btn-sm" @click="openEditForm(a)">Edit</button>
              <button class="btn btn-danger btn-sm" @click="confirmDelete(a)">Hapus</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assignments-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.text-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
  margin: 0;
}

/* ── Form grid ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-grid .full-width {
  grid-column: 1 / -1;
}

/* ── Course groups ── */
.course-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.course-group-title {
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-neutral-200);
}

.course-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: white;
}

.count-badge {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-neutral-500);
  margin-left: auto;
}

/* ── Assignment cards ── */
.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.assignment-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.125rem;
}

.assignment-left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}

.assignment-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.assignment-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.assignment-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-neutral-800);
}

.assignment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.assignment-deadline {
  color: var(--color-warning);
  font-weight: 500;
}

.assignment-deskripsi {
  color: var(--color-neutral-400);
}

.assignment-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
  margin-left: 0.75rem;
}

/* ── Empty ── */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-neutral-500);
}
</style>
