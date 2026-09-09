<script setup lang="ts">
/**
 * Admin Dashboard — System overview for administrators.
 * Shows stats across all students, instructors, courses, and assignments.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

import { useDashboard } from '~/composables/useDashboard'
import { useAiUsage } from '~/composables/useAiUsage'
import { useCampusStore, filterByCampus, demoUserCampusResolver, demoCourseCampusResolver, rosterCampusResolver, courseRowCampusResolver, campusNameOf } from '~/stores/campus'

const auth = useAuthStore()
const ui = useUiStore()
const coursesStore = useCoursesStore()
const assignmentsStore = useAssignmentsStore()
const campusStore = useCampusStore()
const { data: aiUsage, loading: aiUsageLoading, error: aiUsageError, fetch: fetchAiUsage } = useAiUsage()
const { greeting: getGreeting } = useDashboard()

const greeting = computed(() => getGreeting())
const isDemo = computed(() => ui.isDemoMode)
const switchingData = ref(false)

async function toggleDataSource() {
  switchingData.value = true
  try {
    await ui.toggleDemoMode()
  } finally {
    switchingData.value = false
  }
}

onMounted(() => {
  auth.init()
  coursesStore.init()
  assignmentsStore.init()
  campusStore.init()
  fetchAiUsage()
})

const userName = computed(() => auth.user?.nama || 'Admin')

// ── Campus scoping ──
const campusFilter = ref('')
const selectedCampusName = computed(() =>
  campusFilter.value ? campusNameOf(campusStore.allCampuses, campusFilter.value) : 'Semua Kampus'
)

const userResolver = computed(() =>
  ui.isDemoMode ? demoUserCampusResolver : rosterCampusResolver
)
const courseResolver = computed(() =>
  ui.isDemoMode ? demoCourseCampusResolver : courseRowCampusResolver
)

const scopedStudents = computed(() =>
  filterByCampus(auth.studentRoster, campusFilter.value || null, userResolver.value)
)
const scopedInstructors = computed(() =>
  filterByCampus(auth.instructorList, campusFilter.value || null, userResolver.value)
)
const scopedCourses = computed(() =>
  filterByCampus(coursesStore.allCourses, campusFilter.value || null, courseResolver.value)
)

// Stats
const totalStudents = computed(() => scopedStudents.value.length)
const totalInstructors = computed(() => scopedInstructors.value.length)
const totalCourses = computed(() => scopedCourses.value.length)
const totalAssignments = computed(() => assignmentsStore.assignments.length || 5)

// Students by level
const studentsByLevel = computed(() => {
  const levels: Record<number, number> = {}
  for (const s of scopedStudents.value) {
    levels[s.level] = (levels[s.level] || 0) + 1
  }
  return Object.entries(levels)
    .map(([level, count]) => ({ level: Number(level), count }))
    .sort((a, b) => a.level - b.level)
})

// Per-campus overview
const campusCounts = computed(() => campusStore.campusCounts)
</script>

<template>
  <div class="admin-dashboard">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>{{ greeting }}, {{ userName }} 🛡️</h1>
        <p class="text-muted">Panel administrasi sistem — kelola seluruh data LMS.</p>
      </div>
      <div class="header-actions">
        <div class="campus-filter-wrap">
          <label class="campus-filter-label" for="campus-filter">🏛️</label>
          <select
            id="campus-filter"
            v-model="campusFilter"
            class="campus-filter"
            :title="'Filter kampus: ' + selectedCampusName"
          >
            <option value="">Semua Kampus</option>
            <option v-for="c in campusStore.allCampuses" :key="c.id" :value="c.id">
              {{ c.nama }}
            </option>
          </select>
        </div>
        <button
          class="data-toggle-btn"
          :class="isDemo ? 'data-toggle-demo' : 'data-toggle-live'"
          :disabled="switchingData"
          :title="isDemo ? 'Menggunakan data demo lokal. Klik untuk beralih ke Supabase.' : 'Menggunakan data Supabase. Klik untuk beralih ke data demo.'"
          @click="toggleDataSource"
        >
          <span v-if="switchingData" class="toggle-spinner" />
          <span v-else class="toggle-icon">{{ isDemo ? '🗄️' : '☁️' }}</span>
          <span class="toggle-label">
            <span class="toggle-state">{{ isDemo ? 'Demo Mode' : 'Live Mode' }}</span>
            <span class="toggle-source">{{ isDemo ? 'Data lokal' : 'Supabase' }}</span>
          </span>
        </button>
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

    <!-- AI Usage -->
    <section class="section">
      <div class="section-header">
        <h2>🤖 Penggunaan AI Assistant Hari Ini</h2>
        <span class="badge" :class="aiUsage ? (aiUsage.budgetPercent > 80 ? 'badge-warning' : 'badge-success') : ''">
          {{ aiUsage?.date || '-' }}
        </span>
      </div>

      <div v-if="aiUsageLoading" class="card loading-card">
        <p>Memuat data penggunaan AI...</p>
      </div>

      <div v-else-if="aiUsageError" class="card error-card">
        <p>⚠️ {{ aiUsageError }}</p>
      </div>

      <div v-else-if="aiUsage" class="ai-usage-grid">
        <div class="card stat-card ai-stat">
          <div class="stat-icon mini" style="background-color: #e0f2fe; color: #0369a1;">🪙</div>
          <div class="stat-body">
            <span class="stat-value">{{ aiUsage.totalTokens.toLocaleString() }}</span>
            <span class="stat-label">Token Dipakai</span>
          </div>
        </div>

        <div class="card stat-card ai-stat">
          <div class="stat-icon mini" style="background-color: #f0fdf4; color: #15803d;">📨</div>
          <div class="stat-body">
            <span class="stat-value">{{ aiUsage.requestCount }}</span>
            <span class="stat-label">Total Request</span>
          </div>
        </div>

        <div class="card stat-card ai-stat">
          <div class="stat-icon mini" style="background-color: #fffbeb; color: #92400e;">📤</div>
          <div class="stat-body">
            <span class="stat-value">{{ aiUsage.promptTokens.toLocaleString() }}</span>
            <span class="stat-label">Prompt Tokens</span>
          </div>
        </div>

        <div class="card stat-card ai-stat">
          <div class="stat-icon mini" style="background-color: #fdf2f8; color: #be185d;">📥</div>
          <div class="stat-body">
            <span class="stat-value">{{ aiUsage.completionTokens.toLocaleString() }}</span>
            <span class="stat-label">Completion Tokens</span>
          </div>
        </div>

        <div class="card budget-card">
          <div class="budget-header">
            <span class="budget-title">Budget Harian</span>
            <span class="budget-value">{{ aiUsage.budgetRemaining.toLocaleString() }} / {{ aiUsage.budgetTotal.toLocaleString() }} token</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: aiUsage.budgetPercent + '%',
                backgroundColor: aiUsage.budgetPercent > 80 ? '#ef4444' : aiUsage.budgetPercent > 50 ? '#f59e0b' : '#10b981'
              }"
            />
          </div>
          <p class="budget-note">
            {{ aiUsage.budgetPercent > 80 ? '⚠️ Hampir mencapai batas harian!' : '✅ Masih dalam batas aman' }}
          </p>
        </div>
      </div>

      <div v-else class="card empty-card">
        <p>Belum ada penggunaan AI hari ini.</p>
      </div>
    </section>

    <!-- Campus Overview -->
    <section class="section">
      <div class="section-header">
        <h2>🏛️ Sebaran Kampus</h2>
        <div class="section-actions">
          <span class="text-muted">Filter aktif: {{ selectedCampusName }}</span>
          <button v-if="campusFilter" class="btn btn-ghost btn-sm" @click="campusFilter = ''">
            Reset
          </button>
          <NuxtLink to="/admin/campuses" class="btn btn-ghost btn-sm">Kelola Kampus</NuxtLink>
        </div>
      </div>

      <div v-if="campusCounts.length === 0" class="card empty-card">
        <p>Belum ada kampus. Tambahkan kampus di halaman Kelola Kampus.</p>
      </div>

      <div v-else class="campus-overview">
        <div
          v-for="row in campusCounts"
          :key="row.campusId"
          class="card campus-ov-card"
          :class="{ 'campus-ov-active': campusFilter === row.campusId }"
          @click="campusFilter = campusFilter === row.campusId ? '' : row.campusId"
        >
          <div class="campus-ov-header">
            <span class="campus-ov-name">{{ campusNameOf(campusStore.allCampuses, row.campusId) }}</span>
            <span class="campus-ov-kode">{{ campusStore.allCampuses.find((c) => c.id === row.campusId)?.kode }}</span>
          </div>
          <div class="campus-ov-stats">
            <span>👥 {{ row.students }} mhs</span>
            <span>👨‍🏫 {{ row.instructors }} dosen</span>
            <span>📖 {{ row.courses }} mk</span>
          </div>
        </div>
      </div>
    </section>

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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.campus-filter-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 999px;
  background: var(--bg-card, #ffffff);
}

.campus-filter-label {
  font-size: 0.875rem;
}

.campus-filter {
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  outline: none;
  cursor: pointer;
  max-width: 140px;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Campus overview */
.campus-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.campus-ov-card {
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
  border-width: 2px;
}

.campus-ov-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.campus-ov-active {
  border-color: var(--color-primary, #2563eb);
}

.campus-ov-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.campus-ov-name {
  font-weight: 600;
  font-size: 0.9375rem;
}

.campus-ov-kode {
  font-size: 0.6875rem;
  font-weight: 700;
  background: #eef2ff;
  color: #4338ca;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.campus-ov-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
}

.data-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-card, #ffffff);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.data-toggle-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.05));
}

.data-toggle-btn:disabled {
  opacity: 0.6;
  cursor: progress;
}

.data-toggle-demo {
  background-color: #fef3c7;
  border-color: #fde68a;
  color: #92400e;
}

.data-toggle-live {
  background-color: #e0f2fe;
  border-color: #bae6fd;
  color: #0369a1;
}

.toggle-icon {
  font-size: 1rem;
}

.toggle-label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}

.toggle-state {
  font-weight: 700;
}

.toggle-source {
  font-size: 0.625rem;
  font-weight: 500;
  opacity: 0.75;
}

.toggle-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin-ts 0.6s linear infinite;
}

@keyframes spin-ts {
  to { transform: rotate(360deg); }
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

/* AI Usage */
.ai-usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.875rem;
}

.ai-stat {
  padding: 1rem;
}

.stat-icon.mini {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 1.125rem;
  border-radius: 0.5rem;
}

.budget-card {
  grid-column: 1 / -1;
  padding: 1.25rem;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.budget-title {
  font-weight: 600;
  font-size: 0.9375rem;
}

.budget-value {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
}

.budget-note {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
}

.loading-card,
.error-card,
.empty-card {
  padding: 1.5rem;
  text-align: center;
}

.loading-card p,
.error-card p,
.empty-card p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted, #94a3b8);
}

.error-card {
  border-color: #fecaca !important;
  background-color: #fef2f2;
}

.error-card p {
  color: #dc2626;
}

.badge-success {
  background-color: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-warning {
  background-color: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
