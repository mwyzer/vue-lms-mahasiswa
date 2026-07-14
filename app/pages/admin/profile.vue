<script setup lang="ts">
/**
 * Admin Profile — View profile information.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()

const user = computed(() => auth.user)

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
      <h1>Profil Admin</h1>
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

        <div class="profile-details">
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
              <span class="badge badge-warning">Demo</span>
            </span>
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
