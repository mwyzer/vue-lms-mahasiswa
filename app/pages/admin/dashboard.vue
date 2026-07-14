<script setup lang="ts">
/**
 * Admin Dashboard — System overview for administrators.
 * Shows stats across all students, instructors, courses, and assignments.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()
const coursesStore = useCoursesStore()
const assignmentsStore = useAssignmentsStore()

onMounted(() => {
  coursesStore.init()
  assignmentsStore.init()
})

const userName = computed(() => auth.user?.nama || 'Admin')

// Stats
const totalStudents = computed(() => auth.studentRoster.length)
const totalInstructors = computed(() => auth.instructorList.length)
const totalCourses = computed(() => coursesStore.allCourses.length)
const totalAssignments = computed(() => assignmentsStore.assignments.length || 5)

// Students by level
const studentsByLevel = computed(() => {
  const levels: Record<number, number> = {}
  for (const s of auth.studentRoster) {
    levels[s.level] = (levels[s.level] || 0) + 1
  }
  return Object.entries(levels)
    .map(([level, count]) => ({ level: Number(level), count }))
    .sort((a, b) => a.level - b.level)
})

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
  <div class="admin-dashboard">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>{{ greeting }}, {{ userName }} 🛡️</h1>
        <p class="text-muted">Panel administrasi sistem — kelola seluruh data LMS.</p>
      </div>
      <div class="header-badge">
        <span class="badge badge-danger">Administrator</span>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #dbeafe; color: #1d4ed8;">👥</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalStudents }}</span>
          <span class="stat-label">Total Mahasiswa</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #dcfce7; color: #15803d;">👨‍🏫</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalInstructors }}</span>
          <span class="stat-label">Total Instruktur</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #fef3c7; color: #92400e;">📖</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalCourses }}</span>
          <span class="stat-label">Mata Kuliah</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon" style="background-color: #fce7f3; color: #be185d;">📝</div>
        <div class="stat-body">
          <span class="stat-value">{{ totalAssignments }}</span>
          <span class="stat-label">Total Tugas</span>
        </div>
      </div>
    </div>

    <!-- Quick Links -->
    <section class="section">
      <div class="section-header">
        <h2>Menu Cepat</h2>
      </div>

      <div class="quick-links">
        <NuxtLink to="/admin/students" class="card quick-link-card">
          <div class="ql-icon" style="background-color: #dbeafe;">👥</div>
          <div class="ql-content">
            <h3>Kelola Mahasiswa</h3>
            <p>Lihat daftar seluruh mahasiswa terdaftar</p>
          </div>
          <span class="ql-arrow">→</span>
        </NuxtLink>

        <NuxtLink to="/admin/instructors" class="card quick-link-card">
          <div class="ql-icon" style="background-color: #dcfce7;">👨‍🏫</div>
          <div class="ql-content">
            <h3>Kelola Instruktur</h3>
            <p>Lihat daftar seluruh instruktur</p>
          </div>
          <span class="ql-arrow">→</span>
        </NuxtLink>

        <NuxtLink to="/admin/courses" class="card quick-link-card">
          <div class="ql-icon" style="background-color: #fef3c7;">📖</div>
          <div class="ql-content">
            <h3>Kelola Mata Kuliah</h3>
            <p>Lihat seluruh mata kuliah yang tersedia</p>
          </div>
          <span class="ql-arrow">→</span>
        </NuxtLink>

        <NuxtLink to="/admin/assignments" class="card quick-link-card">
          <div class="ql-icon" style="background-color: #fce7f3;">📝</div>
          <div class="ql-content">
            <h3>Kelola Tugas</h3>
            <p>Lihat seluruh tugas dan submission</p>
          </div>
          <span class="ql-arrow">→</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Students by Level -->
    <section class="section">
      <div class="section-header">
        <h2>Mahasiswa per Level</h2>
        <NuxtLink to="/admin/students" class="btn btn-ghost btn-sm">Lihat Semua</NuxtLink>
      </div>

      <div class="level-stats">
        <div
          v-for="item in studentsByLevel"
          :key="item.level"
          class="card level-stat-card"
        >
          <div class="level-stat-header">
            <span class="level-stat-num">Level {{ item.level }}</span>
            <span class="level-stat-count">{{ item.count }} Mahasiswa</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: (item.count / totalStudents) * 100 + '%',
                backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'][item.level - 1]
              }"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-dashboard {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  border-radius: 0.75rem;
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
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

/* Quick Links */
.quick-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.quick-link-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  cursor: pointer;
}

.quick-link-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.ql-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.ql-content {
  flex: 1;
}

.ql-content h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.ql-content p {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
  margin: 0;
}

.ql-arrow {
  font-size: 1.25rem;
  color: var(--text-muted, #94a3b8);
}

/* Section */
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
  font-weight: 600;
  margin: 0;
}

/* Level Stats */
.level-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.level-stat-card {
  padding: 1.25rem;
}

.level-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.level-stat-num {
  font-weight: 600;
  font-size: 0.9375rem;
}

.level-stat-count {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
}

.progress-bar {
  height: 0.5rem;
  background: var(--bg-hover, #f1f5f9);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}

/* Badge */
.badge.badge-danger {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .quick-links {
    grid-template-columns: 1fr;
  }
}
</style>
