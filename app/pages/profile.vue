<script setup lang="ts">
/**
 * Student Profile — View profile information.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const auth = useAuthStore()

const user = computed(() => auth.user)

const levelLabel = computed(() => `Level ${user.value?.level || '-'}`)
const sessionLabel = computed(() =>
  user.value?.session_time === 'morning' ? 'Pagi' : (user.value?.session_time === 'evening' ? 'Malam' : '-')
)

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
      <h1>Profil</h1>
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
            <span class="badge badge-primary">Mahasiswa</span>
          </div>
        </div>

        <div class="profile-details">
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
</style>
