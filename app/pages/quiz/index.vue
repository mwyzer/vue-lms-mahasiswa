<script setup lang="ts">
/**
 * Quiz Index Page — Lists all available quizzes for the student.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

import { useAuthStore } from '~/stores/auth'
import { useQuizStore } from '~/stores/quiz'

const auth = useAuthStore()
const quizStore = useQuizStore()
quizStore.init()

const router = useRouter()

const quizzes = computed(() => {
  if (!auth.user || auth.user.role !== 'student') return []
  return quizStore.allQuizzes.filter(q => q.is_active)
})

const attemptedQuizzes = computed(() => {
  if (!auth.user) return new Set<string>()
  return new Set(
    quizStore.attempts
      .filter(a => a.student_id === auth.user!.id)
      .map(a => a.quiz_id)
  )
})

function getAttemptScore(quizId: string): number | null {
  if (!auth.user) return null
  const attempt = quizStore.studentAttemptForQuiz(quizId, auth.user.id)
  return attempt?.percentage ?? null
}

function startQuiz(quizId: string) {
  router.push(`/quiz/${quizId}`)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function getCourseName(quiz: any): string {
  return quizStore.getCourseName(quiz.course_id)
}
</script>

<template>
  <div class="quiz-index-page">
    <PageHeader title="Kuis & Ujian" subtitle="Ikuti kuis dan ujian interaktif" />

    <div v-if="quizzes.length === 0" class="card empty-state">
      <p>Tidak ada kuis atau ujian yang tersedia saat ini.</p>
    </div>

    <div v-else class="quiz-list">
      <div
        v-for="quiz in quizzes"
        :key="quiz.id"
        class="card quiz-card"
        :class="{ 'attempted': attemptedQuizzes.has(quiz.id) }"
      >
        <div class="quiz-card-header">
          <div class="quiz-icon">
            {{ quiz.time_limit_minutes > 60 ? '📋' : '✍️' }}
          </div>
          <div class="quiz-meta">
            <h3>{{ quiz.judul }}</h3>
            <div class="quiz-badges">
              <span class="badge badge-course">{{ getCourseName(quiz) }}</span>
              <span class="badge badge-time">
                ⏱ {{ quiz.time_limit_minutes }} menit
              </span>
              <span class="badge badge-passing">
                Lulus ≥ {{ quiz.passing_score }}%
              </span>
            </div>
          </div>
        </div>

        <p v-if="quiz.deskripsi" class="quiz-desc">{{ quiz.deskripsi }}</p>

        <div class="quiz-card-footer">
          <div class="quiz-info">
            <span>{{ quiz.questionCount || 0 }} soal</span>
            <span v-if="attemptedQuizzes.has(quiz.id)" class="attempt-badge">
              Nilai: {{ getAttemptScore(quiz.id) }}%
            </span>
          </div>
          <button
            class="btn btn-primary btn-sm"
            :disabled="attemptedQuizzes.has(quiz.id)"
            @click="startQuiz(quiz.id)"
          >
            {{ attemptedQuizzes.has(quiz.id) ? 'Selesai' : 'Mulai Kuis' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz-index-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quiz-card {
  padding: 1.25rem;
  transition: border-color 0.2s;
}

.quiz-card.attempted {
  opacity: 0.75;
  border-color: var(--color-border);
}

.quiz-card:not(.attempted) {
  border-color: var(--color-primary);
  border-width: 2px;
}

.quiz-card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.quiz-icon {
  font-size: 2rem;
  line-height: 1;
}

.quiz-meta h3 {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}

.quiz-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.badge-course {
  background: var(--color-primary);
  color: #fff;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.badge-time {
  background: #f0f9ff;
  color: #0369a1;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.badge-passing {
  background: #f0fdf4;
  color: #15803d;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.quiz-desc {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.quiz-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quiz-info {
  display: flex;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.attempt-badge {
  color: var(--color-success, #15803d);
  font-weight: 600;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--color-muted);
}
</style>
