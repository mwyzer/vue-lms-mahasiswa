<script setup lang="ts">
/**
 * Instructor Profile — View profile information.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const auth = useAuthStore()
const coursesStore = useCoursesStore()

const user = computed(() => auth.user)
const myCourses = computed(() => coursesStore.myCourses)
const courseCount = computed(() => myCourses.value.length)

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
      <h1>Profil Instruktur</h1>
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
            <span class="badge badge-primary">Instruktur</span>
          </div>
        </div>

        <div class="profile-details">
          <div class="detail-row">
            <span class="detail-label">Email</span>
            <span class="detail-value">{{ user.email || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Mata Kuliah Diampu</span>
            <span class="detail-value">{{ courseCount }} MK</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Role</span>
            <span class="detail-value">Instruktur</span>
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

      <!-- Courses summary -->
      <div class="card info-card">
        <h3>Mata Kuliah Diampu</h3>
        <div v-if="myCourses.length === 0" class="text-sm text-muted">
          Belum ada mata kuliah.
        </div>
        <div v-else class="course-list-mini">
          <NuxtLink
            v-for="course in myCourses"
            :key="course.id"
            :to="`/instructor/courses/${course.id}`"
            class="course-mini-item"
          >
            <span class="course-mini-icon">{{ course.icon || '📚' }}</span>
            <div class="course-mini-info">
              <span class="course-mini-name">{{ course.nama }}</span>
              <span class="course-mini-meta text-sm text-muted">
                {{ course.kode }} • Level {{ course.level }}
              </span>
            </div>
            <span class="arrow">→</span>
          </NuxtLink>
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

.course-list-mini {
  display: flex;
  flex-direction: column;
}

.course-mini-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-neutral-100);
  text-decoration: none;
  color: inherit;
}

.course-mini-item:last-child {
  border-bottom: none;
}

.course-mini-item:hover .course-mini-name {
  color: var(--color-primary-600);
}

.course-mini-icon {
  font-size: 1.25rem;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: var(--color-neutral-50);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.course-mini-info {
  flex: 1;
}

.course-mini-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.course-mini-meta {
  margin-top: 0.125rem;
}

.arrow {
  color: var(--color-neutral-400);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

.text-sm {
  font-size: 0.8125rem;
}

.text-muted {
  color: var(--color-neutral-500);
}
</style>
