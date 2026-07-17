<script setup lang="ts">
/**
 * Lesson Detail (Student) — Shows lesson content with sidebar navigation,
 * mark-complete toggle, prev/next buttons, and keyboard shortcuts.
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
const showSidebar = ref(false)

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

function toggleComplete() {
  if (!currentLesson.value) return
  coursesStore.toggleLessonCompleted(currentLesson.value.id)
  if (isCompleted.value) {
    notification.info('Materi ditandai belum selesai.')
  } else {
    notification.success('Materi ditandai sebagai selesai!')
  }
}

function goToLesson(id: string) {
  showSidebar.value = false
  router.push(`/courses/${courseId.value}/lessons/${id}`)
}

function goBack() {
  router.push(`/courses/${courseId.value}`)
}

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' && nextLesson.value) {
    goToLesson(nextLesson.value.id)
  } else if (e.key === 'ArrowLeft' && prevLesson.value) {
    goToLesson(prevLesson.value.id)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="lesson-layout">
    <!-- Sidebar overlay (mobile) -->
    <Transition name="slide">
      <div v-if="showSidebar" class="sidebar-overlay" @click.self="showSidebar = false">
        <LessonSidebar
          :course-id="courseId"
          :lessons="lessons"
          :current-lesson-id="lessonId"
          :course-name="course?.nama"
          :course-kode="course?.kode"
          @navigate="goToLesson"
          @close="showSidebar = false"
        />
      </div>
    </Transition>

    <!-- Desktop sidebar -->
    <LessonSidebar
      class="sidebar-desktop"
      :course-id="courseId"
      :lessons="lessons"
      :current-lesson-id="lessonId"
      :course-name="course?.nama"
      :course-kode="course?.kode"
      @navigate="goToLesson"
      @close="showSidebar = false"
    />

    <!-- Main content -->
    <div class="lesson-main">
      <!-- Loading / Error -->
      <div v-if="!currentLesson" class="empty-state card">
        <p>Materi tidak ditemukan.</p>
        <button class="btn btn-primary btn-sm mt-1" @click="goBack">
          Kembali ke Mata Kuliah
        </button>
      </div>

      <template v-else>
        <!-- Top bar -->
        <div class="lesson-topbar">
          <button class="btn btn-ghost btn-sm sidebar-toggle" @click="showSidebar = true">
            ☰ Materi
          </button>
          <button class="btn btn-ghost btn-sm back-btn" @click="goBack">
            ← Mata Kuliah
          </button>
        </div>

        <!-- Lesson header -->
        <div class="card lesson-header">
          <div class="breadcrumb text-sm text-muted">
            {{ course?.kode }} — {{ course?.nama }}
          </div>
          <div class="lesson-meta-row">
            <span class="lesson-number-badge">
              Materi {{ currentIndex + 1 }} dari {{ lessons.length }}
            </span>
            <button
              class="toggle-complete-btn"
              :class="isCompleted ? 'completed' : 'incomplete'"
              @click="toggleComplete"
            >
              <span v-if="isCompleted">✓ Selesai</span>
              <span v-else>○ Tandai Selesai</span>
            </button>
          </div>
          <h1>{{ currentLesson.judul }}</h1>
        </div>

        <!-- Lesson content -->
        <div class="card lesson-body">
          <div v-if="currentLesson.konten" class="content-text">
            {{ currentLesson.konten }}
          </div>
          <div v-else class="empty-state-inner">
            <p>Belum ada konten untuk materi ini.</p>
          </div>
        </div>

        <!-- Bottom navigation -->
        <div class="lesson-nav-bottom">
          <button
            v-if="prevLesson"
            class="btn btn-ghost nav-btn nav-prev"
            @click="goToLesson(prevLesson.id)"
          >
            <span class="nav-arrow">←</span>
            <span class="nav-content">
              <span class="nav-label">Sebelumnya</span>
              <span class="nav-title">{{ prevLesson.judul }}</span>
            </span>
          </button>
          <div v-else class="nav-spacer" />

          <button
            v-if="nextLesson"
            class="btn btn-ghost nav-btn nav-next"
            @click="goToLesson(nextLesson.id)"
          >
            <span class="nav-content">
              <span class="nav-label">Selanjutnya</span>
              <span class="nav-title">{{ nextLesson.judul }}</span>
            </span>
            <span class="nav-arrow">→</span>
          </button>
          <div v-else class="nav-spacer" />
        </div>

        <!-- Keyboard hint -->
        <p class="keyboard-hint text-xs text-muted">
          Gunakan ← → untuk navigasi antar materi
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lesson-layout {
  display: flex;
  min-height: calc(100vh - var(--header-height, 64px));
  max-width: 1200px;
  margin: 0 auto;
}

/* ── Sidebar ── */
.sidebar-desktop {
  display: none;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
}

.sidebar-overlay :deep(.lesson-sidebar) {
  height: 100%;
  box-shadow: var(--shadow-lg);
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease;
}
.slide-enter-active :deep(.lesson-sidebar),
.slide-leave-active :deep(.lesson-sidebar) {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}
.slide-enter-from :deep(.lesson-sidebar) {
  transform: translateX(-100%);
}
.slide-leave-to :deep(.lesson-sidebar) {
  transform: translateX(-100%);
}

/* ── Main ── */
.lesson-main {
  flex: 1;
  min-width: 0;
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

/* ── Top bar ── */
.lesson-topbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.sidebar-toggle {
  font-size: 0.8125rem;
}

/* ── Lesson header ── */
.lesson-header {
  margin-bottom: 1rem;
}

.breadcrumb {
  margin-bottom: 0.375rem;
}

.lesson-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.lesson-number-badge {
  font-size: 0.75rem;
  color: var(--color-primary-600);
  font-weight: 600;
}

.toggle-complete-btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-neutral-300);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.2s ease;
  color: var(--color-neutral-600);
}

.toggle-complete-btn:hover {
  border-color: var(--color-primary-400);
  color: var(--color-primary-600);
}

.toggle-complete-btn.completed {
  background-color: #dcfce7;
  border-color: var(--color-success);
  color: #15803d;
  font-weight: 600;
}

.toggle-complete-btn.completed:hover {
  background-color: #fef2f2;
  border-color: var(--color-error);
  color: var(--color-error);
}

.lesson-header h1 {
  font-size: 1.25rem;
  line-height: 1.4;
}

/* ── Lesson body ── */
.lesson-body {
  margin-bottom: 1.5rem;
  min-height: 200px;
}

.content-text {
  font-size: 0.9375rem;
  line-height: 1.85;
  color: var(--color-neutral-800);
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state-inner {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

/* ── Bottom nav ── */
.lesson-nav-bottom {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.nav-btn {
  flex: 1;
  max-width: 48%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  text-align: left;
  transition: border-color 0.15s, background-color 0.15s;
  text-decoration: none;
  color: inherit;
}

.nav-btn:hover {
  border-color: var(--color-primary-300);
  background-color: var(--color-primary-50);
  text-decoration: none;
}

.nav-spacer {
  flex: 1;
  max-width: 48%;
}

.nav-prev {
  justify-content: flex-start;
}

.nav-next {
  justify-content: flex-end;
}

.nav-arrow {
  font-size: 1.25rem;
  color: var(--color-primary-500);
  flex-shrink: 0;
}

.nav-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.nav-label {
  font-size: 0.6875rem;
  color: var(--color-neutral-500);
  font-weight: 500;
}

.nav-title {
  font-size: 0.8125rem;
  color: var(--color-neutral-800);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.keyboard-hint {
  text-align: center;
  opacity: 0.5;
  margin-top: 0.5rem;
}

/* ── Shared ── */
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

.text-xs {
  font-size: 0.6875rem;
}

.text-muted {
  color: var(--color-neutral-500);
}

/* ── Desktop ── */
@media (min-width: 768px) {
  .sidebar-desktop {
    display: flex;
    position: sticky;
    top: 0;
    height: calc(100vh - var(--header-height, 64px));
  }

  .sidebar-toggle {
    display: none;
  }

  .sidebar-overlay {
    display: none;
  }

  .lesson-main {
    padding: 1.5rem 2rem;
  }
}
</style>
