<script setup lang="ts">
/**
 * Student Dashboard — Overview page for students.
 * Shows stats, enrolled courses with progress, upcoming deadlines.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const auth = useAuthStore()
const coursesStore = useCoursesStore()

const myCourses = computed(() => coursesStore.myCourses)
const userName = computed(() => auth.user?.nama || 'Mahasiswa')
const userLevel = computed(() => auth.user?.level || '-')
const userSession = computed(() => auth.user?.session_time === 'morning' ? 'Pagi' : 'Malam')
const userKelas = computed(() => auth.user?.kelas || '-')

// Stats
const totalCourses = computed(() => myCourses.value.length)
const completedLessons = computed(() =>
  myCourses.value.reduce((sum, c) => sum + (c.completedLessons || 0), 0)
)
const totalLessons = computed(() =>
  myCourses.value.reduce((sum, c) => sum + (c.lessonCount || 0), 0)
)

const overallProgress = computed(() =>
  totalLessons.value > 0 ? Math.round((completedLessons.value / totalLessons.value) * 100) : 0
)

// Greeting based on time
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Selamat Pagi'
  if (hour < 15) return 'Selamat Siang'
  if (hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
})
</script>

<template>
  <div class="dashboard-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>{{ greeting }}, {{ userName }}! 👋</h1>
        <p class="text-muted">
          Kelas {{ userKelas }} • Level {{ userLevel }} • Sesi {{ userSession }}
        </p>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #dbeafe; color: #1d4ed8;">📖</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalCourses }}</span>
          <span class="stat-label">Mata Kuliah Aktif</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #dcfce7; color: #15803d;">✅</div>
        <div class="stat-body">
          <span class="stat-value">{{ completedLessons }} / {{ totalLessons }}</span>
          <span class="stat-label">Materi Selesai</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #fef3c7; color: #92400e;">📊</div>
        <div class="stat-body">
          <span class="stat-value">{{ overallProgress }}%</span>
          <span class="stat-label">Progress Keseluruhan</span>
        </div>
      </div>
    </div>

    <!-- My Courses -->
    <section class="section">
      <div class="section-header">
        <h2>Mata Kuliah Saya</h2>
        <NuxtLink to="/courses" class="btn btn-ghost btn-sm">Lihat Semua</NuxtLink>
      </div>

      <div v-if="myCourses.length === 0" class="empty-state card">
        <p>Belum ada mata kuliah yang didaftarkan.</p>
      </div>

      <div v-else class="course-grid">
        <NuxtLink
          v-for="course in myCourses"
          :key="course.id"
          :to="`/courses/${course.id}`"
          class="card course-card"
        >
          <div class="course-header">
            <span class="course-icon" :style="{ backgroundColor: course.color + '20', color: course.color }">
              {{ course.icon || '📚' }}
            </span>
            <div class="course-info">
              <span class="course-code">{{ course.kode }}</span>
              <h3 class="course-name">{{ course.nama }}</h3>
            </div>
          </div>
          <p v-if="course.deskripsi" class="course-desc">{{ course.deskripsi }}</p>
          <div class="course-meta">
            <span class="badge badge-neutral">Level {{ course.level }}</span>
            <span class="badge" :class="course.session_time === 'morning' ? 'badge-primary' : 'badge-warning'">
              {{ course.session_time === 'morning' ? 'Pagi' : 'Malam' }}
            </span>
          </div>
          <div class="course-progress">
            <div class="progress-header">
              <span class="text-sm">Progress</span>
              <span class="text-sm font-bold">{{ course.progressPercent || 0 }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (course.progressPercent || 0) + '%' }" />
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 960px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.text-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

/* ── Stats ──────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.stat-body {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
}

/* ── Section ────────────────────────────── */
.section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-header h2 {
  font-size: 1.125rem;
}

/* ── Courses ────────────────────────────── */
.course-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.course-card {
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}

.course-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.course-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
  flex-shrink: 0;
}

.course-info {
  display: flex;
  flex-direction: column;
}

.course-code {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  font-weight: 500;
}

.course-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.course-desc {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-meta {
  display: flex;
  gap: 0.5rem;
}

/* ── Progress Bar ───────────────────────── */
.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.progress-bar {
  height: 0.5rem;
  background-color: var(--color-neutral-200);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-400));
  border-radius: 9999px;
  transition: width 0.5s ease;
}

/* ── Empty State ────────────────────────── */
.empty-state {
  text-align: center;
  padding: 2.5rem;
  color: var(--color-neutral-500);
}

/* ── Responsive ─────────────────────────── */
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr; }
  .course-grid { grid-template-columns: 1fr; }
}
</style>
