<script setup lang="ts">
/**
 * Admin Courses List — Shows all courses grouped by level.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const coursesStore = useCoursesStore()

const allCourses = computed(() => coursesStore.allCourses)

onMounted(() => {
  coursesStore.init()
})

// Group by level
const groupedCourses = computed(() => {
  const groups: Record<number, any[]> = {}
  for (const c of allCourses.value) {
    if (!groups[c.level]) groups[c.level] = []
    groups[c.level].push(c)
  }
  return Object.entries(groups)
    .map(([level, list]) => ({
      level: Number(level),
      morning: list.filter((c: any) => c.session_time === 'morning'),
      evening: list.filter((c: any) => c.session_time === 'evening'),
    }))
    .sort((a, b) => a.level - b.level)
})
</script>

<template>
  <div class="courses-page">
    <div class="page-header">
      <div>
        <h1>Mata Kuliah</h1>
        <p class="text-muted">Seluruh mata kuliah yang tersedia ({{ allCourses.length }}).</p>
      </div>
    </div>

    <div v-if="allCourses.length === 0" class="empty-state card">
      <p>Belum ada mata kuliah.</p>
    </div>

    <div v-else class="level-groups">
      <div
        v-for="group in groupedCourses"
        :key="group.level"
        class="level-group"
      >
        <h2 class="level-title">Level {{ group.level }}</h2>

        <div v-if="group.morning.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-primary">Pagi</span>
            {{ group.morning.length }} Mata Kuliah
          </h3>
          <div class="course-list">
            <div
              v-for="c in group.morning"
              :key="c.id"
              class="card course-card"
            >
              <span
                class="course-icon"
                :style="{ backgroundColor: c.color + '20', color: c.color }"
              >
                {{ c.icon || '📚' }}
              </span>
              <div class="course-info">
                <span class="course-name">{{ c.nama }}</span>
                <span class="course-meta">{{ c.kode }} • {{ c.instructor_id }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="group.evening.length > 0" class="session-group">
          <h3 class="session-title">
            <span class="badge badge-warning">Malam</span>
            {{ group.evening.length }} Mata Kuliah
          </h3>
          <div class="course-list">
            <div
              v-for="c in group.evening"
              :key="c.id"
              class="card course-card"
            >
              <span
                class="course-icon"
                :style="{ backgroundColor: c.color + '20', color: c.color }"
              >
                {{ c.icon || '📚' }}
              </span>
              <div class="course-info">
                <span class="course-name">{{ c.nama }}</span>
                <span class="course-meta">{{ c.kode }} • {{ c.instructor_id }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.courses-page {
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

.course-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
}

.course-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  text-decoration: none;
  color: inherit;
}

.course-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.course-info {
  display: flex;
  flex-direction: column;
}

.course-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.course-meta {
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
