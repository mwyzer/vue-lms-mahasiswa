<script setup lang="ts">
/**
 * Admin Instructors Management — View, add, edit, and delete instructors.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()
const notification = useNotification()

const instructors = computed(() => auth.instructorList)

onMounted(() => {
  auth.init()
})

// Form state
const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const formNama = ref('')
const formEmail = ref('')
const formPassword = ref('')
const formAvatarUrl = ref('')

function openAddForm() {
  editingId.value = null
  formNama.value = ''
  formEmail.value = ''
  formPassword.value = ''
  formAvatarUrl.value = ''
  showForm.value = true
}

function openEditForm(inst: any) {
  editingId.value = inst.id
  formNama.value = inst.nama
  formEmail.value = inst.email || ''
  formPassword.value = ''
  formAvatarUrl.value = inst.avatar_url || ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
}

function saveInstructor() {
  if (!formNama.value.trim()) {
    notification.warning('Nama instruktur harus diisi.')
    return
  }
  if (!editingId.value && !formPassword.value.trim()) {
    notification.warning('Password instruktur harus diisi.')
    return
  }

  saving.value = true
  setTimeout(() => {
    if (editingId.value) {
      const data: any = { nama: formNama.value.trim(), email: formEmail.value.trim() }
      if (formPassword.value.trim()) {
        data.password = formPassword.value.trim()
      }
      data.avatar_url = formAvatarUrl.value.trim() || null
      auth.updateInstructor(editingId.value, data)
      notification.success('Data instruktur berhasil diperbarui!')
    } else {
      auth.addInstructor({
        nama: formNama.value.trim(),
        email: formEmail.value.trim(),
        password: formPassword.value.trim(),
        avatar_url: formAvatarUrl.value.trim() || undefined,
      })
      notification.success('Instruktur berhasil ditambahkan!')
    }
    showForm.value = false
    editingId.value = null
    saving.value = false
  }, 200)
}

function confirmDelete(inst: any) {
  if (confirm(`Hapus instruktur "${inst.nama}"?`)) {
    auth.deleteInstructor(inst.id)
    notification.success('Instruktur berhasil dihapus.')
  }
}
</script>

<template>
  <div class="instructors-page">
    <div class="page-header">
      <div>
        <h1>Instruktur</h1>
        <p class="text-muted">Daftar seluruh instruktur ({{ instructors.length }}).</p>
      </div>
      <button v-if="!showForm" class="btn btn-primary btn-sm" @click="openAddForm">
        + Tambah Instruktur
      </button>
    </div>

    <!-- Add/Edit form -->
    <div v-if="showForm" class="card form-card">
      <h3>{{ editingId ? 'Edit Instruktur' : 'Tambah Instruktur Baru' }}</h3>
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input v-model="formNama" type="text" class="form-input" placeholder="Nama instruktur" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input v-model="formEmail" type="email" class="form-input" placeholder="email@contoh.com" />
      </div>
      <div class="form-group">
        <label class="form-label">
          {{ editingId ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password' }}
        </label>
        <input v-model="formPassword" type="password" class="form-input" placeholder="Minimal 6 karakter" />
      </div>
      <div class="form-group">
        <label class="form-label">Foto Profile (URL)</label>
        <input v-model="formAvatarUrl" type="url" class="form-input" placeholder="https://example.com/foto.jpg" />
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelForm">Batal</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="saving || !formNama.trim() || (!editingId && !formPassword.trim())"
          @click="saveInstructor"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </div>
    </div>

    <div v-if="instructors.length === 0" class="empty-state card">
      <p>Belum ada instruktur terdaftar.</p>
    </div>

    <div v-else class="instructor-grid">
      <div
        v-for="inst in instructors"
        :key="inst.id"
        class="card instructor-card"
      >
        <img v-if="inst.avatar_url" :src="inst.avatar_url" class="instructor-avatar-img" alt="" />
        <div v-else class="instructor-avatar">{{ inst.nama.charAt(0) }}</div>
        <div class="instructor-info">
          <span class="instructor-name">{{ inst.nama }}</span>
          <span class="instructor-email">{{ inst.email || '—' }}</span>
          <span class="instructor-id">ID: {{ inst.id }}</span>
        </div>
        <div class="instructor-actions">
          <button class="btn btn-ghost btn-sm" @click="openEditForm(inst)">Edit</button>
          <button class="btn btn-danger btn-sm" @click="confirmDelete(inst)">Hapus</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.instructors-page {
  max-width: 800px;
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

.form-card {
  margin-bottom: 1.5rem;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
}

.instructor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.instructor-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.instructor-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #dcfce7;
  color: #15803d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.instructor-avatar-img {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.instructor-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.instructor-name {
  font-size: 0.9375rem;
  font-weight: 600;
}

.instructor-email {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.instructor-id {
  font-size: 0.6875rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.instructor-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}
</style>
