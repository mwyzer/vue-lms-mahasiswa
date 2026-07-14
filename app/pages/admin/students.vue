<script setup lang="ts">
/**
 * Admin Students List — Shows all students grouped by level.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()

const students = computed(() => auth.studentRoster as any[])

onMounted(() => {
  auth.init()
})

// Group by level
const groupedStudents = computed(() => {
  const groups: Record<number, any[]> = {}
  for (const s of students.value) {
    if (!groups[s.level]) groups[s.level] = []
    groups[s.level].push(s)
  }
  return Object.entries(groups)
    .map(([level, list]) => ({
      level: Number(level),
      morning: list.filter((s: any) => s.session_time === 'morning'),
      evening: list.filter((s: any) => s.session_time === 'evening'),
    }))
    .sort((a, b) => a.level - b.level)
})
</script>

<template>
  <div class="students-page">
    <div class="page-header">
      <div>
        <h1>Mahasiswa</h1>
        <p class="text-muted">Daftar seluruh mahasiswa terdaftar ({{ students.length }}).</p>
      </div>
    </div>

    <div v-if="students.length === 0" class="empty-state card">
      <p>Belum ada mahasiswa terdaftar.</p>
    </div>

    <div v-else class="level-groups">
      <div
        v-for="group in groupedStudents"
        :key="group.level"
        class="level-group"
      >
        <h2 class="level-title">Level {{ group.level }}</h2>

        <!-- Morning session -->
        <div v-if="group.morning.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-primary">Pagi</span>
            {{ group.morning.length }} Mahasiswa
          </h3>
          <div class="student-list">
            <div
              v-for="s in group.morning"
              :key="s.id"
              class="card student-card"
            >
              <div class="student-avatar">{{ s.nama?.charAt(0) || '?' }}</div>
              <div class="student-info">
                <span class="student-name">{{ s.nama }}</span>
                <span class="student-npm">{{ s.npm }} • {{ s.kelas }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Evening session -->
        <div v-if="group.evening.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-warning">Malam</span>
            {{ group.evening.length }} Mahasiswa
          </h3>
          <div class="student-list">
            <div
              v-for="s in group.evening"
              :key="s.id"
              class="card student-card"
            >
              <div class="student-avatar">{{ s.nama?.charAt(0) || '?' }}</div>
              <div class="student-info">
                <span class="student-name">{{ s.nama }}</span>
                <span class="student-npm">{{ s.npm }} • {{ s.kelas }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.students-page {
  max-width: 900px;
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

.level-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.level-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color, #e2e8f0);
}

.session-group {
  margin-bottom: 1rem;
}

.session-title {
  font-size: 0.9375rem;
  font-weight: 500;
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.student-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.student-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}

.student-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  flex-shrink: 0;
}

.student-info {
  display: flex;
  flex-direction: column;
}

.student-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.student-npm {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}

.badge {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-primary {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}
</style>
