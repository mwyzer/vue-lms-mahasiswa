<script setup lang="ts">
/**
 * Admin Students Management — View, add, edit, and delete students.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()
const notification = useNotification()

const students = computed(() => auth.studentRoster as any[])

onMounted(() => {
  auth.init()
})

// Group by level
const groupedStudents = computed(() => {
  const groups: Record<number, any[]> = {}
  for (const s of students.value) {
    if (!groups[s.level]) groups[s.level] = []
    groups[s.level].push(s)
  }
  return Object.entries(groups)
    .map(([level, list]) => ({
      level: Number(level),
      morning: list.filter((s: any) => s.session_time === 'morning'),
      evening: list.filter((s: any) => s.session_time === 'evening'),
    }))
    .sort((a, b) => a.level - b.level)
})

// Form state
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const formNama = ref('')
const formNpm = ref('')
const formKelas = ref('')
const formLevel = ref<number>(1)
const formSession = ref<'morning' | 'evening'>('morning')
const formPassword = ref('')
const showPassword = ref(false)
const formAvatarUrl = ref('')

function openAddForm() {
  editingId.value = null
  formNama.value = ''
  formNpm.value = ''
  formKelas.value = ''
  formLevel.value = 1
  formSession.value = 'morning'
  formPassword.value = ''
  formAvatarUrl.value = ''
  showForm.value = true
}

function openEditForm(s: any) {
  editingId.value = s.id
  formNama.value = s.nama
  formNpm.value = s.npm
  formKelas.value = s.kelas
  formLevel.value = s.level
  formSession.value = s.session_time
  formPassword.value = ''
  formAvatarUrl.value = s.avatar_url || ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

async function saveStudent() {
  if (!formNama.value.trim()) {
    notification.warning('Nama mahasiswa harus diisi.')
    return
  }
  if (!formNpm.value.trim()) {
    notification.warning('NPM mahasiswa harus diisi.')
    return
  }
  if (!formKelas.value.trim()) {
    notification.warning('Kelas mahasiswa harus diisi.')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      const data: any = {
        nama: formNama.value.trim(),
        npm: formNpm.value.trim(),
        kelas: formKelas.value.trim(),
        level: formLevel.value,
        session_time: formSession.value,
      }
      if (formPassword.value.trim()) {
        data.password = formPassword.value.trim()
      }
      data.avatar_url = formAvatarUrl.value.trim() || null
      const ok = await auth.updateStudent(editingId.value, data)
      if (!ok) {
        notification.error(auth.error || 'Gagal memperbarui data mahasiswa.')
        return
      }
      notification.success('Data mahasiswa berhasil diperbarui!')
    } else {
      const ok = await auth.addStudent({
        nama: formNama.value.trim(),
        npm: formNpm.value.trim(),
        kelas: formKelas.value.trim(),
        level: formLevel.value,
        session_time: formSession.value,
        password: formPassword.value.trim() || undefined,
        avatar_url: formAvatarUrl.value.trim() || undefined,
      })
      if (!ok) {
        notification.error(auth.error || 'Gagal menambahkan mahasiswa.')
        return
      }
      notification.success('Mahasiswa berhasil ditambahkan!')
    }
    showForm.value = false
    editingId.value = null
  } catch {
    notification.error('Terjadi kesalahan saat menyimpan data.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete(s: any) {
  if (!confirm(`Hapus mahasiswa "${s.nama}" (${s.npm})?`)) return
  const ok = await auth.deleteStudent(s.id)
  if (ok) {
    notification.success('Mahasiswa berhasil dihapus.')
  } else {
    notification.error(auth.error || 'Gagal menghapus mahasiswa.')
  }
}
</script>

<template>
  <div class="students-page">
    <div class="page-header">
      <div>
        <h1>Mahasiswa</h1>
        <p class="text-muted">Daftar seluruh mahasiswa terdaftar ({{ students.length }}).</p>
      </div>
      <button v-if="!showForm" class="btn btn-primary btn-sm" @click="openAddForm">
        + Tambah Mahasiswa
      </button>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="card form-card">
      <h3>{{ editingId ? 'Edit Mahasiswa' : 'Tambah Mahasiswa Baru' }}</h3>
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input v-model="formNama" type="text" class="form-input" placeholder="Nama mahasiswa" />
      </div>
      <div class="form-group">
        <label class="form-label">NPM</label>
        <input v-model="formNpm" type="text" class="form-input" placeholder="Nomor Pokok Mahasiswa" />
      </div>
      <div class="form-group">
        <label class="form-label">Kelas</label>
        <input v-model="formKelas" type="text" class="form-input" placeholder="Contoh: A, B, C" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ editingId ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password' }}</label>
        <div class="password-wrapper">
          <input v-model="formPassword" :type="showPassword ? 'text' : 'password'" class="form-input" placeholder="Minimal 6 karakter" />
          <button type="button" class="password-toggle" @click="showPassword = !showPassword" :title="showPassword ? 'Sembunyikan password' : 'Tampilkan password'">
            {{ showPassword ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Foto Profile (URL)</label>
        <input v-model="formAvatarUrl" type="url" class="form-input" placeholder="https://example.com/foto.jpg" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Level</label>
          <select v-model="formLevel" class="form-input">
            <option :value="1">Level 1</option>
            <option :value="2">Level 2</option>
            <option :value="3">Level 3</option>
            <option :value="4">Level 4</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sesi</label>
          <select v-model="formSession" class="form-input">
            <option value="morning">Pagi</option>
            <option value="evening">Malam</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelForm">Batal</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="saving || !formNama.trim() || !formNpm.trim() || !formKelas.trim()"
          @click="saveStudent"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </div>
    </div>

    <div v-if="students.length === 0" class="empty-state card">
      <p>Belum ada mahasiswa terdaftar.</p>
    </div>

    <div v-else class="level-groups">
      <div
        v-for="group in groupedStudents"
        :key="group.level"
        class="level-group"
      >
        <div class="level-header">
          <h2 class="level-title">Level {{ group.level }}</h2>
        </div>

        <!-- Morning session -->
        <div v-if="group.morning.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-primary">Pagi</span>
            {{ group.morning.length }} Mahasiswa
          </h3>
          <div class="student-list">
            <div
              v-for="s in group.morning"
              :key="s.id"
              class="card student-card"
            >
              <img v-if="s.avatar_url" :src="s.avatar_url" class="student-avatar-img" alt="" />
              <div v-else class="student-avatar">{{ s.nama?.charAt(0) || '?' }}</div>
              <div class="student-info">
                <span class="student-name">{{ s.nama }}</span>
                <span class="student-npm">{{ s.npm }} • {{ s.kelas }}</span>
              </div>
              <div class="student-actions">
                <button class="btn btn-ghost btn-sm" @click="openEditForm(s)">Edit</button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(s)">Hapus</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Evening session -->
        <div v-if="group.evening.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-warning">Malam</span>
            {{ group.evening.length }} Mahasiswa
          </h3>
          <div class="student-list">
            <div
              v-for="s in group.evening"
              :key="s.id"
              class="card student-card"
            >
              <img v-if="s.avatar_url" :src="s.avatar_url" class="student-avatar-img" alt="" />
              <div v-else class="student-avatar">{{ s.nama?.charAt(0) || '?' }}</div>
              <div class="student-info">
                <span class="student-name">{{ s.nama }}</span>
                <span class="student-npm">{{ s.npm }} • {{ s.kelas }}</span>
              </div>
              <div class="student-actions">
                <button class="btn btn-ghost btn-sm" @click="openEditForm(s)">Edit</button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(s)">Hapus</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.students-page {
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
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0;
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
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  background: white;
  color: var(--color-neutral-800);
  font-size: 0.875rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
}

.level-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.level-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color, #e2e8f0);
}

.level-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
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

.student-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.75rem;
}

.student-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}

.student-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  flex-shrink: 0;
}

.student-avatar-img {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.student-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.student-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.student-npm {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.student-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
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
</style>
