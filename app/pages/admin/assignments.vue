<script setup lang="ts">
/**
 * Admin Assignments List — Shows all assignments across all courses.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const assignmentsStore = useAssignmentsStore()

onMounted(() => {
  assignmentsStore.init()
})

// For admin, we show all assignments from demo data
const allAssignments = computed(() => {
  const store = assignmentsStore
  const assignments = store.isDemoMode
    ? ([
        { id: 'a1', course_id: 'c1', judul: 'Tugas 1: Hello World', course_name: 'Pemrograman Dasar' },
        { id: 'a2', course_id: 'c1', judul: 'Tugas 2: Kalkulator Sederhana', course_name: 'Pemrograman Dasar' },
        { id: 'a3', course_id: 'c2', judul: 'Tugas 1: Diagram Venn', course_name: 'Matematika Diskrit' },
        { id: 'a4', course_id: 'c5', judul: 'Tugas 1: Implementasi Array', course_name: 'Struktur Data' },
        { id: 'a5', course_id: 'c8', judul: 'Tugas 1: Class & Object', course_name: 'Pemrograman Berorientasi Objek' },
      ])
    : store.sbAssignments.map((a: any) => ({
        ...a,
        course_name: store.sbCourseNames[a.course_id]?.nama || '',
      }))
  return assignments
})
</script>

<template>
  <div class="assignments-page">
    <div class="page-header">
      <div>
        <h1>Tugas</h1>
        <p class="text-muted">Seluruh tugas dari semua mata kuliah ({{ allAssignments.length }}).</p>
      </div>
    </div>

    <div v-if="allAssignments.length === 0" class="empty-state card">
      <p>Belum ada tugas.</p>
    </div>

    <div v-else class="assignment-list">
      <div
        v-for="a in allAssignments"
        :key="a.id"
        class="card assignment-card"
      >
        <div class="assignment-left">
          <span class="assignment-icon">📝</span>
          <div class="assignment-info">
            <span class="assignment-title">{{ a.judul }}</span>
            <span class="assignment-course">{{ a.course_name }}</span>
          </div>
        </div>
        <span class="assignment-id">ID: {{ a.id }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assignments-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
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

.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.assignment-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
}

.assignment-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.assignment-icon {
  font-size: 1.25rem;
}

.assignment-info {
  display: flex;
  flex-direction: column;
}

.assignment-title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.assignment-course {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.assignment-id {
  font-size: 0.6875rem;
  color: var(--text-muted, #94a3b8);
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}
</style>
