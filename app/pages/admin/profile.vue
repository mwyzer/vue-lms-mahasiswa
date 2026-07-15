<script setup lang="ts">
/**
 * Admin Profile — View and edit profile information.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()
const notification = useNotification()

const user = computed(() => auth.user)

// ── Edit mode ──
const isEditing = ref(false)
const editNama = ref('')
const editEmail = ref('')
const saving = ref(false)

function startEdit() {
  editNama.value = user.value?.nama || ''
  editEmail.value = user.value?.email || ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editNama.value = ''
  editEmail.value = ''
}

async function saveProfile() {
  if (!editNama.value.trim()) {
    notification.warning('Nama harus diisi.')
    return
  }
  if (editNama.value.trim().length < 2) {
    notification.warning('Nama minimal 2 karakter.')
    return
  }

  const payload: any = { nama: editNama.value.trim() }

  if (editEmail.value.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editEmail.value)) {
      notification.warning('Format email tidak valid.')
      return
    }
    payload.email = editEmail.value.trim()
  } else {
    payload.email = ''
  }

  saving.value = true
  const success = await auth.updateProfile(payload)

  if (success) {
    notification.success('Profil berhasil diperbarui!')
    isEditing.value = false
  } else {
    notification.error(auth.error || 'Gagal menyimpan profil.')
  }
  saving.value = false
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}
</script>

<template>
  <div class="profile-page">
    <div class="page-header">
      <div>
        <h1>Profil Admin</h1>
        <p class="text-muted">Data diri administrator.</p>
      </div>
      <div v-if="!isEditing">
        <button class="btn btn-primary btn-sm" @click="startEdit">
          ✏️ Edit Profil
        </button>
      </div>
    </div>

    <div v-if="!user" class="empty-state card">
      <p>Data pengguna tidak tersedia.</p>
    </div>

    <template v-else>
      <!-- Profile card -->
      <div class="card profile-card">
        <div class="profile-avatar-section">
          <div class="profile-avatar">
            {{ user.nama?.charAt(0) || '?' }}
          </div>
          <div class="profile-name-section">
            <h2>{{ user.nama }}</h2>
            <span class="badge badge-danger">Administrator</span>
          </div>
        </div>

        <!-- View mode -->
        <div v-if="!isEditing" class="profile-details">
          <div class="detail-row">
            <span class="detail-label">Email</span>
            <span class="detail-value">{{ user.email || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Role</span>
            <span class="detail-value">Administrator Sistem</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Bergabung</span>
            <span class="detail-value">{{ formatDate(user.created_at) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mode</span>
            <span class="detail-value">
              <span :class="auth.isDemoMode ? 'badge badge-warning' : 'badge badge-success'">
                {{ auth.isDemoMode ? 'Demo' : 'Production' }}
              </span>
            </span>
          </div>
        </div>

        <!-- Edit mode -->
        <div v-else class="profile-edit-form">
          <div class="form-group">
            <label class="form-label" for="edit-nama">Nama Lengkap</label>
            <input
              id="edit-nama"
              v-model="editNama"
              type="text"
              class="form-input"
              placeholder="Masukkan nama lengkap"
              :disabled="saving"
              @keyup.enter="saveProfile"
            />
            <p class="form-hint">Minimal 2 karakter.</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-email">Email</label>
            <input
              id="edit-email"
              v-model="editEmail"
              type="email"
              class="form-input"
              placeholder="nama@email.com"
              :disabled="saving"
              @keyup.enter="saveProfile"
            />
          </div>

          <div class="form-actions">
            <button class="btn btn-ghost" :disabled="saving" @click="cancelEdit">
              Batal
            </button>
            <button class="btn btn-primary" :disabled="saving" @click="saveProfile">
              {{ saving ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info card -->
      <div class="card info-card">
        <h3>Informasi Akun</h3>
        <div class="detail-row">
          <span class="detail-label">Role</span>
          <span class="detail-value">Administrator</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">ID Akun</span>
          <span class="detail-value">{{ user.id }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Akses</span>
          <span class="detail-value">Penuh — seluruh data sistem</span>
        </div>
      </div>
    </template>
  </div>
</template>
