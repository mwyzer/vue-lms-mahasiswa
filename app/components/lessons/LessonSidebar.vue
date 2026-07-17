<script setup lang="ts">
/**
 * LessonSidebar — Sidebar navigation showing all lessons for a course with
 * completion status. Used in the lesson detail viewer.
 */
const props = defineProps<{
  courseId: string
  lessons: any[]
  currentLessonId: string
  courseName?: string
  courseKode?: string
}>()

const emit = defineEmits<{
  navigate: [lessonId: string]
  close: []
}>()

const completedCount = computed(() =>
  props.lessons.filter((l: any) => l.progress?.completed).length
)

const progressPercent = computed(() =>
  props.lessons.length > 0
    ? Math.round((completedCount.value / props.lessons.length) * 100)
    : 0
)
</script>

<template>
  <aside class="lesson-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <div class="sidebar-course-info">
        <span v-if="courseKode" class="sidebar-course-kode">{{ courseKode }}</span>
        <h3 v-if="courseName" class="sidebar-course-name">{{ courseName }}</h3>
      </div>
      <button class="sidebar-close-btn btn btn-ghost btn-sm" @click="emit('close')">
        ✕
      </button>
    </div>

    <!-- Progress -->
    <div class="sidebar-progress">
      <div class="progress-header">
        <span class="text-xs text-muted">Progress</span>
        <span class="text-xs font-bold">{{ completedCount }}/{{ lessons.length }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </div>
    </div>

    <!-- Lesson list -->
    <nav class="sidebar-lesson-list">
      <button
        v-for="(lesson, idx) in lessons"
        :key="lesson.id"
        class="sidebar-lesson-item"
        :class="{
          active: lesson.id === currentLessonId,
          completed: lesson.progress?.completed,
        }"
        @click="emit('navigate', lesson.id)"
      >
        <span class="lesson-item-number">
          <span v-if="lesson.progress?.completed" class="check-icon">✓</span>
          <span v-else>{{ idx + 1 }}</span>
        </span>
        <span class="lesson-item-title">{{ lesson.judul }}</span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.lesson-sidebar {
  width: 280px;
  min-width: 280px;
  height: 100%;
  background: var(--color-neutral-50);
  border-right: 1px solid var(--color-neutral-200);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
  gap: 0.5rem;
}

.sidebar-course-info {
  flex: 1;
  min-width: 0;
}

.sidebar-course-kode {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-primary-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sidebar-course-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-800);
  margin-top: 0.125rem;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sidebar-close-btn {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  line-height: 1;
}

.sidebar-progress {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.progress-bar {
  height: 6px;
  background-color: var(--color-neutral-200);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary-500);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.sidebar-lesson-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.sidebar-lesson-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  transition: background-color 0.15s, color 0.15s;
  font-family: inherit;
}

.sidebar-lesson-item:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.sidebar-lesson-item.active {
  background-color: var(--color-primary-50);
  color: var(--color-primary-700);
  font-weight: 600;
  border-right: 3px solid var(--color-primary-500);
}

.sidebar-lesson-item.completed .lesson-item-title {
  color: var(--color-success);
}

.lesson-item-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 600;
  flex-shrink: 0;
  transition: background-color 0.15s, color 0.15s;
}

.sidebar-lesson-item.active .lesson-item-number {
  background-color: var(--color-primary-500);
  color: white;
}

.sidebar-lesson-item.completed .lesson-item-number {
  background-color: var(--color-success);
  color: white;
}

.check-icon {
  font-size: 0.75rem;
  font-weight: 700;
}

.lesson-item-title {
  flex: 1;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text-xs {
  font-size: 0.6875rem;
}

.text-muted {
  color: var(--color-neutral-500);
}

.font-bold {
  font-weight: 600;
}
</style>
