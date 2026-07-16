<script setup lang="ts">
/**
 * Student Profile — View and edit profile information.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const auth = useAuthStore()
const notification = useNotification()

const user = computed(() => auth.user)

const levelLabel = computed(() => `Level ${user.value?.level || '-'}`)
const sessionLabel = computed(() =>
  user.value?.session_time === 'morning' ? 'Pagi' : (user.value?.session_time === 'evening' ? 'Malam' : '-')
)

// ── Edit mode ──
const isEditing = ref(false)
const editNama = ref('')
const saving = ref(false)

// ── Photo upload ──
const fileInput = ref<HTMLInputElement>()
const uploadingPhoto = ref(false)

function triggerPhotoUpload() {
  fileInput.value?.click()
}

async function handlePhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    notification.warning('Hanya file gambar yang diizinkan.')
    return
  }

  // Validate size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    notification.warning('Ukuran foto maksimal 2MB.')
    return
  }

  uploadingPhoto.value = true
  try {
    const base64 = await fileToBase64(file)
    const success = await auth.updateProfile({ avatar_url: base64 })
    if (success) {
      notification.success('Foto profil berhasil diperbarui!')
    } else {
      notification.error(auth.error || 'Gagal menyimpan foto.')
    }
  } catch {
    notification.error('Gagal membaca file gambar.')
  }
  uploadingPhoto.value = false
  // Reset so re-selecting same file triggers change
  input.value = ''
}

async function removePhoto() {
  uploadingPhoto.value = true
  const success = await auth.updateProfile({ avatar_url: null })
  if (success) {
    notification.success('Foto profil berhasil dihapus.')
  } else {
    notification.error(auth.error || 'Gagal menghapus foto.')
  }
  uploadingPhoto.value = false
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function startEdit() {
  editNama.value = user.value?.nama || ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editNama.value = ''
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

  saving.value = true
  const success = await auth.updateProfile({ nama: editNama.value.trim() })

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
        <h1>Profil</h1>
        <p class="text-muted">Data diri mahasiswa.</p>
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
          <div class="profile-avatar" :class="{ 'has-photo': user.avatar_url }" @click="triggerPhotoUpload">
            <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.nama" class="avatar-img" />
            <span v-else>{{ user.nama?.charAt(0) || '?' }}</span>
            <div class="avatar-overlay">
              <span v-if="uploadingPhoto" class="avatar-spinner"></span>
              <span v-else>📷</span>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handlePhotoSelected"
          />
          <div class="profile-name-section">
            <h2>{{ user.nama }}</h2>
            <span class="badge badge-primary">Mahasiswa</span>
            <button v-if="user.avatar_url" class="btn btn-ghost btn-xs photo-remove-btn" @click.stop="removePhoto">
              Hapus Foto
            </button>
          </div>
        </div>

        <!-- View mode -->
        <div v-if="!isEditing" class="profile-details">
          <div class="detail-row">
            <span class="detail-label">NPM</span>
            <span class="detail-value">{{ user.npm || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Kelas</span>
            <span class="detail-value">{{ user.kelas || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Level</span>
            <span class="detail-value">{{ levelLabel }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Sesi</span>
            <span class="detail-value">{{ sessionLabel }}</span>
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

          <!-- Read-only fields shown for reference -->
          <div class="form-readonly">
            <div class="readonly-row">
              <span class="readonly-label">NPM</span>
              <span class="readonly-value">{{ user.npm || '-' }}</span>
            </div>
            <div class="readonly-row">
              <span class="readonly-label">Kelas</span>
              <span class="readonly-value">{{ user.kelas || '-' }}</span>
            </div>
            <div class="readonly-row">
              <span class="readonly-label">Level</span>
              <span class="readonly-value">{{ levelLabel }}</span>
            </div>
            <div class="readonly-row">
              <span class="readonly-label">Sesi</span>
              <span class="readonly-value">{{ sessionLabel }}</span>
            </div>
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
          <span class="detail-value">Mahasiswa</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Mode</span>
          <span class="detail-value">
            <span class="badge badge-warning">Demo</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 640px;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
}

.profile-card {
  margin-bottom: 1rem;
}

.profile-avatar-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-name-section h2 {
  font-size: 1.25rem;
  margin-bottom: 0.375rem;
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-neutral-100);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.875rem;
  color: var(--color-neutral-500);
  font-weight: 500;
}

.detail-value {
  font-size: 0.9375rem;
  color: var(--color-neutral-800);
  font-weight: 500;
}

.info-card {
  margin-bottom: 1rem;
}

.info-card h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

/* ── Photo upload ── */
.profile-avatar {
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 1.25rem;
}

.profile-avatar:hover .avatar-overlay {
  opacity: 1;
}

.hidden-input {
  display: none;
}

.photo-remove-btn {
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  margin-top: 0.25rem;
  color: var(--color-danger, #ef4444);
}

.avatar-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
