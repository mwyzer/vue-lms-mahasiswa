<script setup lang="ts">
/**
 * Quiz Attempt Page — Take an interactive quiz with timer and auto-grading.
 */
import { useAuthStore } from '~/stores/auth'
import { useQuizStore } from '~/stores/quiz'
import { useNotification } from '~/composables/useNotification'

const auth = useAuthStore()
const quizStore = useQuizStore()
quizStore.init()
const notification = useNotification()

const router = useRouter()
const route = useRoute()
const quizId = route.params.id as string

const quiz = computed(() => quizStore.quizzes.find(q => q.id === quizId))
const questions = computed(() => quizStore.questionsForQuiz(quizId))

// Timer state
const timeLeft = ref(0)
const timerInterval = ref<ReturnType<typeof setInterval> | null>(null)
const timeUp = ref(false)

// Submission state
const submitting = ref(false)
const result = ref<{ score: number; total: number; percentage: number; passed: boolean } | null>(null)

// Check if already attempted
const attempted = computed(() => {
  if (!auth.user) return false
  return quizStore.hasAttempted(quizId, auth.user.id)
})

// Redirect if already attempted
if (attempted.value) {
  router.replace('/quiz')
}

// Start the quiz session
onMounted(() => {
  if (!quiz.value || !auth.user || attempted.value) return

  quizStore.startQuiz(quizId)
  timeLeft.value = quiz.value.time_limit_minutes * 60

  timerInterval.value = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      timeUp.value = true
      handleSubmit()
    }
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
})

function selectAnswer(questionId: string, jawaban: 'a' | 'b' | 'c' | 'd') {
  quizStore.answerQuestion(questionId, jawaban)
}

function handleSubmit() {
  if (submitting.value || !auth.user) return
  submitting.value = true

  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }

  // Short delay for UX
  setTimeout(() => {
    const attempt = quizStore.submitQuiz(auth.user!.id)
    if (attempt) {
      result.value = {
        score: attempt.score,
        total: attempt.total_questions,
        percentage: attempt.percentage,
        passed: attempt.percentage >= (quiz.value?.passing_score || 60),
      }
    }
    submitting.value = false
  }, 300)
}

function goBack() {
  router.push('/quiz')
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getTimerClass(): string {
  if (timeLeft <= 60) return 'timer-danger'
  if (timeLeft <= 300) return 'timer-warning'
  return ''
}
</script>

<template>
  <div class="quiz-attempt-page">
    <!-- Quiz info header -->
    <div v-if="quiz && !result" class="quiz-header">
      <div class="quiz-header-left">
        <button class="btn btn-ghost btn-sm" @click="goBack">← Kembali</button>
        <h2>{{ quiz.judul }}</h2>
      </div>
      <div class="timer" :class="getTimerClass()">
        ⏱ {{ formatTime(timeLeft) }}
      </div>
    </div>

    <!-- Result screen -->
    <div v-if="result" class="card result-card">
      <div class="result-icon">{{ result.passed ? '🎉' : '😞' }}</div>
      <h2>{{ result.passed ? 'Selamat!' : 'Belum Berhasil' }}</h2>
      <p class="result-subtitle">
        {{ result.passed ? 'Kamu lulus kuis ini!' : 'Coba lagi lain waktu.' }}
      </p>

      <div class="score-circle" :class="{ passed: result.passed }">
        <span class="score-value">{{ result.percentage }}%</span>
      </div>

      <div class="score-details">
        <div class="score-item">
          <span class="score-label">Benar</span>
          <span class="score-num correct">{{ result.score }}</span>
        </div>
        <div class="score-divider" />
        <div class="score-item">
          <span class="score-label">Total</span>
          <span class="score-num">{{ result.total }}</span>
        </div>
      </div>

      <button class="btn btn-primary" @click="goBack">
        Kembali ke Daftar Kuis
      </button>
    </div>

    <!-- Questions -->
    <div v-else-if="quiz" class="questions-area">
      <div class="progress-info">
        <span>Soal {{ quizStore.answeredCount + 1 }}/{{ quizStore.totalQuestionsCurrent }}</span>
        <div class="progress-bar-mini">
          <div
            class="progress-fill"
            :style="{ width: (quizStore.answeredCount / quizStore.totalQuestionsCurrent * 100) + '%' }"
          />
        </div>
      </div>

      <div
        v-for="(q, idx) in questions"
        :key="q.id"
        class="card question-card"
        :class="{ active: quizStore.currentAnswers[q.id] !== undefined }"
      >
        <div class="question-number">Soal {{ idx + 1 }}</div>
        <p class="question-text">{{ q.pertanyaan }}</p>

        <div class="options-list">
          <label
            class="option-item"
            :class="{ selected: quizStore.currentAnswers[q.id] === 'a' }"
          >
            <input
              type="radio"
              :name="q.id"
              value="a"
              :checked="quizStore.currentAnswers[q.id] === 'a'"
              @change="selectAnswer(q.id, 'a')"
            />
            <span class="option-label">A.</span>
            <span class="option-text">{{ q.pilihan_a }}</span>
          </label>

          <label
            class="option-item"
            :class="{ selected: quizStore.currentAnswers[q.id] === 'b' }"
          >
            <input
              type="radio"
              :name="q.id"
              value="b"
              :checked="quizStore.currentAnswers[q.id] === 'b'"
              @change="selectAnswer(q.id, 'b')"
            />
            <span class="option-label">B.</span>
            <span class="option-text">{{ q.pilihan_b }}</span>
          </label>

          <label
            class="option-item"
            :class="{ selected: quizStore.currentAnswers[q.id] === 'c' }"
          >
            <input
              type="radio"
              :name="q.id"
              value="c"
              :checked="quizStore.currentAnswers[q.id] === 'c'"
              @change="selectAnswer(q.id, 'c')"
            />
            <span class="option-label">C.</span>
            <span class="option-text">{{ q.pilihan_c }}</span>
          </label>

          <label
            class="option-item"
            :class="{ selected: quizStore.currentAnswers[q.id] === 'd' }"
          >
            <input
              type="radio"
              :name="q.id"
              value="d"
              :checked="quizStore.currentAnswers[q.id] === 'd'"
              @change="selectAnswer(q.id, 'd')"
            />
            <span class="option-label">D.</span>
            <span class="option-text">{{ q.pilihan_d }}</span>
          </label>
        </div>
      </div>

      <div class="submit-area">
        <button
          class="btn btn-primary btn-lg"
          :disabled="submitting || quizStore.answeredCount === 0"
          @click="handleSubmit"
        >
          {{ submitting ? 'Mengirim...' : 'Kumpulkan Jawaban' }}
        </button>
        <p class="text-xs text-muted">
          {{ quizStore.answeredCount }} dari {{ quizStore.totalQuestionsCurrent }} soal terjawab
        </p>
      </div>
    </div>

    <!-- Not found -->
    <div v-else class="card empty-state">
      <p>Kuis tidak ditemukan.</p>
      <NuxtLink to="/quiz" class="btn btn-primary btn-sm mt-1">Kembali</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.quiz-attempt-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}

.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.quiz-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.quiz-header-left h2 {
  margin: 0;
  font-size: 1.1rem;
}

.timer {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  background: #f0f9ff;
  color: #0369a1;
  white-space: nowrap;
}

.timer.timer-warning {
  background: #fef3c7;
  color: #b45309;
}

.timer.timer-danger {
  background: #fef2f2;
  color: #dc2626;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Progress bar */
.progress-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.progress-bar-mini {
  flex: 1;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Questions */
.question-card {
  padding: 1.25rem;
  margin-bottom: 1rem;
  border: 2px solid var(--color-border);
  transition: border-color 0.2s;
}

.question-card.active {
  border-color: var(--color-primary);
}

.question-number {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.question-text {
  font-size: 1.05rem;
  font-weight: 500;
  margin-bottom: 1rem;
  line-height: 1.5;
}

/* Options */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.85rem;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-item:hover {
  border-color: var(--color-primary-light, #93c5fd);
  background: #f8fafc;
}

.option-item.selected {
  border-color: var(--color-primary);
  background: #eff6ff;
}

.option-item input[type="radio"] {
  accent-color: var(--color-primary);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.option-label {
  font-weight: 600;
  color: var(--color-muted);
  flex-shrink: 0;
}

.option-text {
  font-size: 0.95rem;
}

/* Submit area */
.submit-area {
  text-align: center;
  padding: 1.5rem 0;
}

/* Result card */
.result-card {
  text-align: center;
  padding: 2.5rem;
  margin-top: 2rem;
}

.result-icon {
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
}

.result-subtitle {
  color: var(--color-muted);
  margin-bottom: 1.5rem;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #fef2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  border: 4px solid #fca5a5;
}

.score-circle.passed {
  background: #f0fdf4;
  border-color: #86efac;
}

.score-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
}

.score-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.score-label {
  font-size: 0.8rem;
  color: var(--color-muted);
}

.score-num {
  font-size: 1.5rem;
  font-weight: 700;
}

.score-num.correct {
  color: var(--color-success, #15803d);
}

.score-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border);
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--color-muted);
}
</style>
