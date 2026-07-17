<script setup lang="ts">
/**
 * Instructor Quiz Overview — Shows all quizzes across all courses the instructor manages.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

import { useQuizStore } from '~/stores/quiz'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'
import { useNotification } from '~/composables/useNotification'

const quizStore = useQuizStore()
const courseStore = useCoursesStore()
const auth = useAuthStore()
const notification = useNotification()

onMounted(async () => {
  await courseStore.init()
  await quizStore.init()
  await auth.init()
})

const myCourses = computed(() => courseStore.myCourses)

const myCourseIds = computed(() => myCourses.value.map((c: any) => c.id))

/** Quizzes for courses this instructor manages */
const myQuizzes = computed(() =>
  quizStore.allQuizzes.filter(q => myCourseIds.value.includes(q.course_id))
)

function getCourseName(courseId: string): string {
  const c = myCourses.value.find((c: any) => c.id === courseId)
  return c ? `${c.kode} — ${c.nama}` : courseId
}

function getCourseColor(courseId: string): string {
  const c = myCourses.value.find((c: any) => c.id === courseId)
  return c?.color || '#3b82f6'
}

function toggleActive(quizId: string) {
  quizStore.toggleQuizActive(quizId)
  const q = quizStore.quizzes.find(q => q.id === quizId)
  notification.info(q?.is_active ? 'Kuis diaktifkan.' : 'Kuis dinonaktifkan.')
}

function getQuestionCount(quizId: string): number {
  return quizStore.questions.filter(q => q.quiz_id === quizId).length
}

function getAttemptCount(quizId: string): number {
  return quizStore.attempts.filter(a => a.quiz_id === quizId).length
}
</script>

<template>
  <div class="instructor-quiz-overview">
    <div class="page-header">
      <div>
        <h1>Semua Kuis & Ujian</h1>
        <p class="text-muted">Daftar kuis dari semua mata kuliah yang Anda ampu.</p>
      </div>
    </div>

    <div v-if="myQuizzes.length === 0" class="empty-state card">
      <p>Belum ada kuis. Kelola kuis dari halaman detail mata kuliah.</p>
    </div>

    <div v-else class="quiz-list">
      <NuxtLink
        v-for="quiz in myQuizzes"
        :key="quiz.id"
        :to="`/instructor/courses/${quiz.course_id}/quiz`"
        class="card quiz-card"
      >
        <div class="quiz-top">
          <div class="quiz-info">
            <div class="quiz-title-row">
              <span
                class="badge"
                :class="quiz.is_active ? 'badge-success' : 'badge-secondary'"
              >
                {{ quiz.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
              <h3>{{ quiz.judul }}</h3>
            </div>
            <p class="course-label" :style="{ color: getCourseColor(quiz.course_id) }">
              {{ getCourseName(quiz.course_id) }}
            </p>
          </div>
          <div class="quiz-stats">
            <span class="stat-item" title="Jumlah soal">📝 {{ getQuestionCount(quiz.id) }}</span>
            <span class="stat-item" title="Jumlah pengerjaan">👥 {{ getAttemptCount(quiz.id) }}</span>
          </div>
        </div>
        <div class="quiz-meta">
          <span class="meta-item">⏱ {{ quiz.time_limit_minutes }} menit</span>
          <span class="meta-item">📋 Lulus ≥ {{ quiz.passing_score }}%</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.instructor-quiz-overview {
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

.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quiz-card {
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s;
  padding: 1rem 1.25rem;
}

.quiz-card:hover {
  border-color: var(--color-primary-300);
}

.quiz-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.quiz-info {
  flex: 1;
  min-width: 0;
}

.quiz-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.quiz-title-row h3 {
  margin: 0;
  font-size: 1rem;
}

.course-label {
  font-size: 0.8rem;
  font-weight: 500;
  margin: 0;
}

.quiz-stats {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.quiz-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--color-muted);
}

/* Badges */
.badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-success {
  background: var(--color-success-bg, #dcfce7);
  color: var(--color-success, #15803d);
}

.badge-secondary {
  background: var(--color-neutral-100, #f1f5f9);
  color: var(--text-muted, #94a3b8);
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}
</style>
