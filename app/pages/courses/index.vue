<script setup lang="ts">
/**
 * Courses Page (Student) — Lists enrolled courses with progress.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const coursesStore = useCoursesStore()
const myCourses = computed(() => coursesStore.myCourses)
</script>

<template>
  <div class="courses-page">
    <div class="page-header">
      <div>
        <h1>Mata Kuliah</h1>
        <p class="text-muted">Daftar mata kuliah yang Anda ikuti.</p>
      </div>
    </div>

    <div v-if="myCourses.length === 0" class="empty-state card">
      <p>Belum ada mata kuliah yang didaftarkan.</p>
    </div>

    <div v-else class="course-grid">
      <NuxtLink
        v-for="course in myCourses"
        :key="course.id"
        :to="`/courses/${course.id}`"
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
        <div class="course-progress">
          <div class="progress-header">
            <span class="text-sm">Progress</span>
            <span class="text-sm font-bold">{{ course.progressPercent || 0 }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: (course.progressPercent || 0) + '%' }"
            />
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.courses-page {
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
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.course-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}

.course-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.course-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
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
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.course-desc {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-meta {
  display: flex;
  gap: 0.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.progress-bar {
  height: 0.5rem;
  background-color: var(--color-neutral-200);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-400));
  border-radius: 9999px;
  transition: width 0.5s ease;
}

.empty-state {
  text-align: center;
  padding: 2.5rem;
  color: var(--color-neutral-500);
}

@media (max-width: 768px) {
  .course-grid { grid-template-columns: 1fr; }
}
</style>
