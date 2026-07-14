<script setup lang="ts">
/**
 * Lesson Detail (Student) — Shows lesson content with mark-complete and navigation.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const notification = useNotification()

const courseId = computed(() => route.params.courseId as string)
const lessonId = computed(() => route.params.lessonId as string)

onMounted(() => {
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)
const lessons = computed(() => coursesStore.currentLessons as any[])

const currentLesson = computed(() =>
  lessons.value.find((l: any) => l.id === lessonId.value) || null
)

const currentIndex = computed(() =>
  lessons.value.findIndex((l: any) => l.id === lessonId.value)
)

const prevLesson = computed(() =>
  currentIndex.value > 0 ? lessons.value[currentIndex.value - 1] : null
)

const nextLesson = computed(() =>
  currentIndex.value < lessons.value.length - 1 ? lessons.value[currentIndex.value + 1] : null
)

const isCompleted = computed(() =>
  currentLesson.value?.progress?.completed || false
)

function markComplete() {
  if (!currentLesson.value) return
  coursesStore.markLessonCompleted(currentLesson.value.id)
  notification.success('Materi ditandai sebagai selesai!')
}

function goToLesson(lessonId: string) {
  router.push(`/courses/${courseId.value}/lessons/${lessonId}`)
}
</script>

<template>
  <div class="lesson-detail-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali ke Materi
    </button>

    <!-- Loading / Error -->
    <div v-if="!currentLesson" class="empty-state card">
      <p>Materi tidak ditemukan.</p>
      <NuxtLink :to="`/courses/${courseId}`" class="btn btn-primary btn-sm mt-1">
        Kembali ke Mata Kuliah
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Lesson header -->
      <div class="card lesson-header">
        <div class="breadcrumb text-sm text-muted">
          {{ course?.kode }} — {{ course?.nama }}
        </div>
        <div class="lesson-number-badge">
          Materi {{ currentIndex + 1 }} dari {{ lessons.length }}
        </div>
        <h1>{{ currentLesson.judul }}</h1>
      </div>

      <!-- Lesson content -->
      <div class="card lesson-content">
        <div v-if="currentLesson.konten" class="content-text">
          {{ currentLesson.konten }}
        </div>
        <div v-else class="empty-state">
          <p>Belum ada konten untuk materi ini.</p>
        </div>

        <!-- Mark complete button -->
        <div class="complete-section">
          <button
            v-if="!isCompleted"
            class="btn btn-primary"
            @click="markComplete"
          >
            ✓ Tandai Selesai
          </button>
          <div v-else class="completed-badge">
            <span class="badge badge-success">✓ Selesai</span>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="lesson-nav">
        <button
          v-if="prevLesson"
          class="btn btn-ghost"
          @click="goToLesson(prevLesson.id)"
        >
          ← {{ prevLesson.judul }}
        </button>
        <div v-else />

        <button
          v-if="nextLesson"
          class="btn btn-ghost"
          @click="goToLesson(nextLesson.id)"
        >
          {{ nextLesson.judul }} →
        </button>
        <div v-else />
      </div>
    </template>
  </div>
</template>

<style scoped>
.lesson-detail-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.lesson-header {
  margin-bottom: 1rem;
}

.breadcrumb {
  margin-bottom: 0.5rem;
}

.lesson-number-badge {
  font-size: 0.75rem;
  color: var(--color-primary-600);
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.lesson-header h1 {
  font-size: 1.25rem;
}

.lesson-content {
  margin-bottom: 1rem;
}

.content-text {
  font-size: 0.9375rem;
  line-height: 1.8;
  color: var(--color-neutral-800);
  white-space: pre-wrap;
}

.complete-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-neutral-200);
  text-align: center;
}

.completed-badge {
  display: flex;
  justify-content: center;
}

.lesson-nav {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

.mt-1 {
  margin-top: 1rem;
}

.text-sm {
  font-size: 0.8125rem;
}

.text-muted {
  color: var(--color-neutral-500);
}
</style>
