<script setup lang="ts">
/**
 * Instructor Dashboard — Overview page for instructors.
 * Shows stats, courses taught, and pending grading tasks.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const auth = useAuthStore()
const coursesStore = useCoursesStore()

const myCourses = computed(() => coursesStore.myCourses)
const userName = computed(() => auth.user?.nama || 'Instruktur')

// Stats
const totalCourses = computed(() => myCourses.value.length)
const totalStudents = computed(() => 15) // hardcoded for demo

// Greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Selamat Pagi'
  if (hour < 15) return 'Selamat Siang'
  if (hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
})
</script>

<template>
  <div class="instructor-dashboard">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>{{ greeting }}, {{ userName }} 👋</h1>
        <p class="text-muted">Panel kontrol instruktur — kelola mata kuliah dan mahasiswa.</p>
      </div>
      <div class="header-badge">
        <span class="badge badge-primary">Instruktur</span>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #dbeafe; color: #1d4ed8;">📖</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalCourses }}</span>
          <span class="stat-label">Mata Kuliah Diampu</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #dcfce7; color: #15803d;">👥</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalStudents }}</span>
          <span class="stat-label">Total Mahasiswa</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #fef3c7; color: #92400e;">📝</div>
        <div class="stat-body">
          <span class="stat-value">{{ myCourses.length > 0 ? 'Aktif' : '—' }}</span>
          <span class="stat-label">Status Perkuliahan</span>
        </div>
      </div>
    </div>

    <!-- My Courses -->
    <section class="section">
      <div class="section-header">
        <h2>Mata Kuliah yang Diampu</h2>
        <NuxtLink to="/instructor/courses" class="btn btn-ghost btn-sm">Kelola</NuxtLink>
      </div>

      <div v-if="myCourses.length === 0" class="empty-state card">
        <p>Belum ada mata kuliah yang diampu.</p>
      </div>

      <div v-else class="course-list">
        <NuxtLink
          v-for="course in myCourses"
          :key="course.id"
          :to="`/instructor/courses/${course.id}`"
          class="card course-card"
        >
          <div class="course-left">
            <span
              class="course-icon"
              :style="{ backgroundColor: course.color + '20', color: course.color }"
            >
              {{ course.icon || '📚' }}
            </span>
            <div class="course-info">
              <span class="course-code">{{ course.kode }}</span>
              <h3 class="course-name">{{ course.nama }}</h3>
              <p v-if="course.deskripsi" class="course-desc">{{ course.deskripsi }}</p>
            </div>
          </div>
          <div class="course-right">
            <span class="badge badge-neutral">Level {{ course.level }}</span>
            <span
              class="badge"
              :class="course.session_time === 'morning' ? 'badge-primary' : 'badge-warning'"
            >
              {{ course.session_time === 'morning' ? 'Pagi' : 'Malam' }}
            </span>
            <span class="arrow">→</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Quick Actions -->
    <section class="section">
      <div class="section-header">
        <h2>Aksi Cepat</h2>
      </div>
      <div class="quick-actions">
        <NuxtLink to="/instructor/courses" class="card action-card">
          <span class="action-icon">📖</span>
          <span class="action-label">Kelola Mata Kuliah</span>
          <span class="action-desc">Atur materi dan daftar mahasiswa</span>
        </NuxtLink>
        <NuxtLink to="/instructor/assignments" class="card action-card">
          <span class="action-icon">📝</span>
          <span class="action-label">Kelola Tugas</span>
          <span class="action-desc">Buat tugas dan nilai submission</span>
        </NuxtLink>
        <NuxtLink to="/instructor/students" class="card action-card">
          <span class="action-icon">👥</span>
          <span class="action-label">Lihat Mahasiswa</span>
          <span class="action-desc">Pantau progress mahasiswa</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.instructor-dashboard {
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

/* ── Course List ────────────────────────── */
.course-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.course-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  gap: 1rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}

.course-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.course-icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
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
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  margin-bottom: 0.125rem;
}

.course-desc {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.arrow {
  color: var(--color-neutral-400);
  font-weight: 600;
  font-size: 1.125rem;
}

/* ── Quick Actions ──────────────────────── */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}

.action-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.action-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-neutral-800);
  margin-bottom: 0.25rem;
}

.action-desc {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
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
  .quick-actions { grid-template-columns: 1fr; }
  .course-card { flex-direction: column; align-items: flex-start; }
  .course-right { align-self: flex-end; }
}
</style>
