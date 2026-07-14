<script setup lang="ts">
/**
 * Instructor Courses List — Lists courses taught by the instructor.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const coursesStore = useCoursesStore()
const myCourses = computed(() => coursesStore.myCourses)
</script>

<template>
  <div class="instructor-courses-page">
    <div class="page-header">
      <div>
        <h1>Mata Kuliah</h1>
        <p class="text-muted">Daftar mata kuliah yang Anda ampu.</p>
      </div>
    </div>

    <div v-if="myCourses.length === 0" class="empty-state card">
      <p>Belum ada mata kuliah yang diampu.</p>
    </div>

    <div v-else class="course-grid">
      <NuxtLink
        v-for="course in myCourses"
        :key="course.id"
        :to="`/instructor/courses/${course.id}`"
        class="card course-card"
      >
        <div class="course-header">
          <span
            class="course-icon"
            :style="{ backgroundColor: course.color + '20', color: course.color }"
          >
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
          <span
            class="badge"
            :class="course.session_time === 'morning' ? 'badge-primary' : 'badge-warning'"
          >
            {{ course.session_time === 'morning' ? 'Pagi' : 'Malam' }}
          </span>
        </div>
        <div class="card-footer">
          <span class="text-sm text-muted">Kelola →</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.instructor-courses-page {
  max-width: 960px;
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

.course-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.course-card {
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s;
}

.course-card:hover {
  border-color: var(--color-primary-300);
}

.course-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.course-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.course-info {
  flex: 1;
}

.course-code {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.course-name {
  font-size: 1rem;
  margin-top: 0.125rem;
}

.course-desc {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.card-footer {
  border-top: 1px solid var(--color-neutral-100);
  padding-top: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

@media (max-width: 640px) {
  .course-grid {
    grid-template-columns: 1fr;
  }
}
</style>
