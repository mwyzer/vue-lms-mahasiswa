<script setup lang="ts">
/**
 * Assignments List (Student) — Lists all assignments for enrolled courses.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const assignmentsStore = useAssignmentsStore()

const myAssignments = computed(() => assignmentsStore.myAssignments as any[])

// Stats
const pendingCount = computed(() =>
  myAssignments.value.filter((a: any) => !a.submission && new Date(a.tenggat_waktu) >= new Date()).length
)
const submittedCount = computed(() =>
  myAssignments.value.filter((a: any) => a.submission && a.submission.nilai == null).length
)
const gradedCount = computed(() =>
  myAssignments.value.filter((a: any) => a.submission?.nilai != null).length
)

onMounted(() => {
  assignmentsStore.init()
})

function getTimeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  if (diff <= 0) return ''
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}h lagi`
  if (hours > 0) return `${hours}j lagi`
  return 'Segera'
}

function getStatusLabel(a: any): { label: string; class: string } {
  const now = new Date()
  const due = new Date(a.tenggat_waktu)

  if (a.submission?.nilai != null) {
    return { label: `Dinilai: ${a.submission.nilai}`, class: 'badge-success' }
  }
  if (a.submission?.submitted) {
    return { label: 'Dikumpulkan', class: 'badge-primary' }
  }
  if (a.submission) {
    return { label: 'Dikirim', class: 'badge-primary' }
  }
  if (due < now) {
    return { label: 'Terlewat', class: 'badge-danger' }
  }
  return { label: 'Belum Dikerjakan', class: 'badge-neutral' }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="assignments-page">
    <div class="page-header">
      <div>
        <h1>Tugas</h1>
        <p class="text-muted">Daftar tugas dari mata kuliah yang Anda ikuti.</p>
      </div>
    </div>

    <!-- Stats summary -->
    <div v-if="myAssignments.length > 0" class="stats-row">
      <div class="stat-item pending">
        <span class="stat-count">{{ pendingCount }}</span>
        <span class="stat-label">Belum</span>
      </div>
      <div class="stat-item submitted">
        <span class="stat-count">{{ submittedCount }}</span>
        <span class="stat-label">Dikumpulkan</span>
      </div>
      <div class="stat-item graded">
        <span class="stat-count">{{ gradedCount }}</span>
        <span class="stat-label">Dinilai</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="myAssignments.length === 0" class="empty-state card">
      <p>Belum ada tugas.</p>
    </div>

    <!-- Assignment list -->
    <div v-else class="assignment-list">
      <NuxtLink
        v-for="a in myAssignments"
        :key="a.id"
        :to="`/assignments/${a.id}`"
        class="card assignment-card"
      >
        <div class="assignment-top">
          <div class="assignment-info">
            <h3>{{ a.judul }}</h3>
            <p class="course-label">{{ a.course_kode }} — {{ a.course_name }}</p>
          </div>
          <span class="badge" :class="getStatusLabel(a).class">
            {{ getStatusLabel(a).label }}
          </span>
        </div>
        <p v-if="a.deskripsi" class="assignment-desc">{{ a.deskripsi }}</p>
        <div class="assignment-meta">
          <span class="meta-item">
            <span class="text-muted">Deadline:</span>
            {{ formatDate(a.tenggat_waktu) }}
          </span>
          <span
            v-if="!a.submission && getTimeRemaining(a.tenggat_waktu)"
            class="time-badge"
          >⏳ {{ getTimeRemaining(a.tenggat_waktu) }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.assignments-page {
  max-width: 720px;
}

.page-header {
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

.stats-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.stat-item {
  flex: 1;
  background: white;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
}

.stat-count {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-neutral-800);
}

.stat-label {
  font-size: 0.6875rem;
  color: var(--color-neutral-500);
  font-weight: 500;
}

.stat-item.pending .stat-count { color: var(--color-warning); }
.stat-item.submitted .stat-count { color: var(--color-primary-600); }
.stat-item.graded .stat-count { color: var(--color-success); }

.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.assignment-card {
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s;
}

.assignment-card:hover {
  border-color: var(--color-primary-300);
}

.assignment-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.assignment-info h3 {
  font-size: 1rem;
  margin-bottom: 0.125rem;
}

.course-label {
  font-size: 0.8125rem;
  color: var(--color-primary-600);
  font-weight: 500;
}

.assignment-desc {
  font-size: 0.875rem;
  color: var(--color-neutral-600);
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.assignment-meta {
  font-size: 0.8125rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-item {
  color: var(--color-neutral-700);
}

.time-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-warning);
  background: #fef3c7;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}
</style>
