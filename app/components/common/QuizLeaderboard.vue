<script setup lang="ts">
/**
 * QuizLeaderboard — Ranks student attempts for a quiz.
 *
 * Props:
 * - quizId: The quiz to rank
 * - limit: Max number of rows to show (default 10). Pass 0 to show all.
 *
 * Highlights the current user's row. Ranks by best percentage, then shortest duration.
 */
import { useAuthStore } from '~/stores/auth'
import { useQuizStore } from '~/stores/quiz'

const props = withDefaults(defineProps<{
  quizId: string
  limit?: number
}>(), {
  limit: 10,
})

const quizStore = useQuizStore()
const auth = useAuthStore()

const rows = computed(() => {
  const list = quizStore.leaderboardForQuiz(props.quizId)
  return props.limit > 0 ? list.slice(0, props.limit) : list
})

function studentName(studentId: string): string {
  return auth.studentRoster.find(s => s.id === studentId)?.nama || studentId
}

function studentNpm(studentId: string): string {
  return auth.studentRoster.find(s => s.id === studentId)?.npm || ''
}

function medal(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}
</script>

<template>
  <div class="leaderboard">
    <div v-if="rows.length === 0" class="empty-state">
      <p class="text-sm text-muted">Belum ada yang mengerjakan kuis ini.</p>
    </div>

    <div v-else class="rank-list">
      <div
        v-for="row in rows"
        :key="row.id"
        class="rank-row"
        :class="{ 'self-row': auth.user?.id === row.student_id }"
      >
        <span class="rank-medal" :class="`rank-${row.rank}`">{{ medal(row.rank) }}</span>
        <div class="rank-user">
          <span class="rank-name">
            {{ studentName(row.student_id) }}
            <span v-if="auth.user?.id === row.student_id" class="self-badge">Kamu</span>
          </span>
          <span class="rank-npm">{{ studentNpm(row.student_id) }}</span>
        </div>
        <div class="rank-score">
          <span class="rank-pct" :class="{ passed: row.percentage >= 60 }">
            {{ row.percentage }}%
          </span>
          <span class="rank-count">{{ row.score }}/{{ row.total_questions }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leaderboard {
  width: 100%;
}

.empty-state {
  padding: 1.5rem;
  text-align: center;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background: var(--color-bg-secondary, #f8fafc);
}

.rank-row.self-row {
  background: var(--color-primary-bg, #eff6ff);
  border: 1px solid var(--color-primary-200, #bfdbfe);
}

.rank-medal {
  width: 2rem;
  text-align: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.rank-1, .rank-2, .rank-3 {
  font-size: 1.25rem;
}

.rank-user {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.rank-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.rank-npm {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.self-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  background: var(--color-primary-100, #dbeafe);
  color: var(--color-primary-700, #1d4ed8);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
}

.rank-score {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex-shrink: 0;
}

.rank-pct {
  font-weight: 800;
  font-size: 1rem;
  color: var(--color-neutral-600, #64748b);
}

.rank-pct.passed {
  color: var(--color-success, #15803d);
}

.rank-count {
  font-size: 0.7rem;
  color: var(--color-muted);
}
</style>