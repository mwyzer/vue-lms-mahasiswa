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
}

.meta-item {
  color: var(--color-neutral-700);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}
</style>
