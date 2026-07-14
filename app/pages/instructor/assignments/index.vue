<script setup lang="ts">
/**
 * Instructor Assignments Overview — Shows all assignments across all courses.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const assignmentsStore = useAssignmentsStore()

const myAssignments = computed(() => assignmentsStore.myAssignments as any[])

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getSubmissionCount(assignmentId: string): number {
  return assignmentsStore.submissionsForAssignment(assignmentId).length
}
</script>

<template>
  <div class="assignments-page">
    <div class="page-header">
      <div>
        <h1>Semua Tugas</h1>
        <p class="text-muted">Daftar tugas dari semua mata kuliah yang Anda ampu.</p>
      </div>
    </div>

    <div v-if="myAssignments.length === 0" class="empty-state card">
      <p>Belum ada tugas.</p>
    </div>

    <div v-else class="assignment-list">
      <NuxtLink
        v-for="a in myAssignments"
        :key="a.id"
        :to="`/instructor/courses/${a.course_id}/assignments`"
        class="card assignment-card"
      >
        <div class="assignment-top">
          <div class="assignment-info">
            <h3>{{ a.judul }}</h3>
            <p class="course-label">{{ a.course_kode }} — {{ a.course_name }}</p>
          </div>
          <span class="badge badge-neutral">
            {{ getSubmissionCount(a.id) }} Pengumpulan
          </span>
        </div>
        <div class="assignment-meta">
          <span class="meta-item">
            Deadline: {{ formatDate(a.tenggat_waktu) }}
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

.assignment-meta {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
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
