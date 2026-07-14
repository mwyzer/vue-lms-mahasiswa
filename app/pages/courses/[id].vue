<script setup lang="ts">
/**
 * Course Detail (Student) — Shows course info, lesson list with progress.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const auth = useAuthStore()

const courseId = computed(() => route.params.id as string)

// Set current course on mount
onMounted(() => {
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)
const lessons = computed(() => coursesStore.currentLessons as any[])

const completedCount = computed(() =>
  lessons.value.filter((l: any) => l.progress?.completed).length
)

const progressPercent = computed(() =>
  lessons.value.length > 0
    ? Math.round((completedCount.value / lessons.value.length) * 100)
    : 0
)

// Find instructor name
const instructorName = computed(() => {
  if (!course.value?.instructor_id) return ''
  const instructors = auth.instructorList
  const match = instructors.find((i: any) => i.id === course.value?.instructor_id)
  return match?.nama || ''
})
</script>

<template>
  <div class="course-detail-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali
    </button>

    <!-- Loading state -->
    <div v-if="!course" class="empty-state card">
      <p>Mata kuliah tidak ditemukan.</p>
      <NuxtLink to="/courses" class="btn btn-primary btn-sm mt-1">Kembali ke Daftar</NuxtLink>
    </div>

    <template v-else>
      <!-- Course header -->
      <div class="card course-header-card">
        <div class="course-top">
          <span
            class="course-icon-lg"
            :style="{ backgroundColor: course.color + '20', color: course.color }"
          >
            {{ course.icon || '📚' }}
          </span>
          <div class="course-title-area">
            <span class="course-code">{{ course.kode }}</span>
            <h1>{{ course.nama }}</h1>
            <div class="course-meta">
              <span class="badge badge-neutral">Level {{ course.level }}</span>
              <span
                class="badge"
                :class="course.session_time === 'morning' ? 'badge-primary' : 'badge-warning'"
              >
                {{ course.session_time === 'morning' ? 'Pagi' : 'Malam' }}
              </span>
            </div>
          </div>
        </div>
        <p v-if="course.deskripsi" class="course-desc">{{ course.deskripsi }}</p>
        <p v-if="instructorName" class="instructor-info">
          <span class="text-muted">Instruktur:</span> {{ instructorName }}
        </p>

        <!-- Progress -->
        <div class="course-progress">
          <div class="progress-header">
            <span class="text-sm">Progress Materi</span>
            <span class="text-sm font-bold">
              {{ completedCount }} / {{ lessons.length }} ({{ progressPercent }}%)
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
          </div>
        </div>
      </div>

      <!-- Lesson list -->
      <section class="section">
        <h2>Materi Perkuliahan</h2>

        <div v-if="lessons.length === 0" class="empty-state card">
          <p>Belum ada materi untuk mata kuliah ini.</p>
        </div>

        <div v-else class="lesson-list">
          <NuxtLink
            v-for="lesson in lessons"
            :key="lesson.id"
            :to="`/courses/${course.id}/lessons/${lesson.id}`"
            class="card lesson-card"
            :class="{ completed: lesson.progress?.completed }"
          >
            <div class="lesson-left">
              <span class="lesson-number">{{ lesson.urutan }}</span>
              <div class="lesson-info">
                <span class="lesson-title">{{ lesson.judul }}</span>
                <span class="lesson-status text-sm">
                  {{ lesson.progress?.completed ? '✓ Selesai' : 'Belum dipelajari' }}
                </span>
              </div>
            </div>
            <div class="lesson-right">
              <span v-if="lesson.progress?.completed" class="badge badge-success">Selesai</span>
              <span v-else class="badge badge-neutral">Belum</span>
              <span class="arrow">→</span>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.course-detail-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.course-header-card {
  margin-bottom: 1.5rem;
}

.course-top {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.course-icon-lg {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.course-title-area {
  flex: 1;
}

.course-title-area h1 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.course-code {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.course-meta {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.course-desc {
  color: var(--color-neutral-600);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  line-height: 1.6;
}

.instructor-info {
  font-size: 0.875rem;
  color: var(--color-neutral-700);
  margin-bottom: 1rem;
}

.course-progress {
  margin-top: 0.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.text-sm {
  font-size: 0.8125rem;
}

.font-bold {
  font-weight: 600;
}

.text-muted {
  color: var(--color-neutral-500);
}

.progress-bar {
  height: 8px;
  background-color: var(--color-neutral-200);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary-500);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.section {
  margin-top: 1.5rem;
}

.section h2 {
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.lesson-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lesson-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-decoration: none;
  color: inherit;
  padding: 1rem;
  transition: border-color 0.2s;
}

.lesson-card:hover {
  border-color: var(--color-primary-300);
}

.lesson-card.completed {
  background-color: #f0fdf4;
}

.lesson-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lesson-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-neutral-100);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  flex-shrink: 0;
}

.lesson-card.completed .lesson-number {
  background-color: var(--color-success-100);
  color: var(--color-success-700);
}

.lesson-info {
  display: flex;
  flex-direction: column;
}

.lesson-title {
  font-weight: 500;
  font-size: 0.9375rem;
}

.lesson-status {
  color: var(--color-neutral-500);
  margin-top: 0.125rem;
}

.lesson-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.arrow {
  color: var(--color-neutral-400);
  font-size: 1.125rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

.mt-1 {
  margin-top: 1rem;
}
</style>
