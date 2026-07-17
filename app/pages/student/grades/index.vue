<script setup lang="ts">
/**
 * Student Grades / Hasil Penilaian — Shows all graded assignment results.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const assignmentsStore = useAssignmentsStore()

onMounted(() => {
  assignmentsStore.init()
})

// Get all assignments and filter graded ones
const myAssignments = computed(() => assignmentsStore.myAssignments as any[])

const gradedAssignments = computed(() =>
  myAssignments.value.filter((a: any) => a.submission?.nilai != null)
)

// Group by course
const gradedByCourse = computed(() => {
  const map: Record<string, { courseName: string; courseKode: string; assignments: any[] }> = {}
  for (const a of gradedAssignments.value) {
    const key = a.course_id
    if (!map[key]) {
      map[key] = { courseName: a.course_name, courseKode: a.course_kode, assignments: [] }
    }
    map[key].assignments.push(a)
  }
  return Object.values(map)
})

// Stats
const totalGraded = computed(() => gradedAssignments.value.length)
const averageScore = computed(() => {
  if (totalGraded.value === 0) return 0
  const sum = gradedAssignments.value.reduce((acc: number, a: any) => acc + (a.submission?.nilai || 0), 0)
  return Math.round(sum / totalGraded.value)
})
const highestScore = computed(() => {
  if (totalGraded.value === 0) return 0
  return Math.max(...gradedAssignments.value.map((a: any) => a.submission?.nilai || 0))
})
const lowestScore = computed(() => {
  if (totalGraded.value === 0) return 0
  return Math.min(...gradedAssignments.value.map((a: any) => a.submission?.nilai || 0))
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getScoreColor(nilai: number): string {
  if (nilai >= 80) return 'var(--color-success)'
  if (nilai >= 60) return 'var(--color-warning)'
  return 'var(--color-error)'
}
</script>

<template>
  <div class="grades-page">
    <div class="page-header">
      <div>
        <h1>Hasil Penilaian</h1>
        <p class="text-muted">Nilai tugas yang telah dinilai oleh instruktur.</p>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="totalGraded > 0" class="stats-row">
      <div class="card stat-card">
        <span class="stat-label">Rata-rata</span>
        <span class="stat-value" :style="{ color: getScoreColor(averageScore) }">{{ averageScore }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Tertinggi</span>
        <span class="stat-value" style="color: var(--color-success)">{{ highestScore }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Terendah</span>
        <span class="stat-value" :style="{ color: lowestScore < 60 ? 'var(--color-error)' : 'var(--color-warning)' }">{{ lowestScore }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Total Dinilai</span>
        <span class="stat-value" style="color: var(--color-primary-600)">{{ totalGraded }}</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="totalGraded === 0" class="empty-state card">
      <div class="empty-icon">📝</div>
      <p>Belum ada tugas yang dinilai.</p>
      <p class="text-sm text-muted">Tugas yang sudah dinilai oleh instruktur akan muncul di sini.</p>
      <NuxtLink to="/assignments" class="btn btn-primary btn-sm mt-1">Lihat Semua Tugas</NuxtLink>
    </div>

    <!-- Grades by course -->
    <div v-for="course in gradedByCourse" :key="course.courseKode" class="course-section">
      <div class="course-header">
        <h2>{{ course.courseKode }} — {{ course.courseName }}</h2>
        <span class="badge badge-primary">{{ course.assignments.length }} Tugas</span>
      </div>

      <div class="grades-list">
        <div
          v-for="a in course.assignments"
          :key="a.id"
          class="card grade-card"
        >
          <div class="grade-top">
            <div class="grade-info">
              <NuxtLink :to="`/assignments/${a.id}`" class="grade-title">
                {{ a.judul }}
              </NuxtLink>
              <span class="text-xs text-muted">Deadline: {{ formatDate(a.tenggat_waktu) }}</span>
            </div>
            <div class="grade-score" :style="{ borderColor: getScoreColor(a.submission.nilai) }">
              <span class="score-value" :style="{ color: getScoreColor(a.submission.nilai) }">
                {{ a.submission.nilai }}
              </span>
              <span class="score-label">/ 100</span>
            </div>
          </div>

          <div class="grade-meta">
            <span class="text-xs text-muted">
              Dikumpulkan: {{ formatDate(a.submission.submitted_at) }}
            </span>
            <span v-if="a.submission.graded_at" class="text-xs text-muted">
              Dinilai: {{ formatDate(a.submission.graded_at) }}
            </span>
          </div>

          <div v-if="a.submission.feedback" class="feedback-box">
            <span class="feedback-label">💬 Feedback Instruktur:</span>
            <p class="feedback-text">{{ a.submission.feedback }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grades-page {
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

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  text-align: center;
  padding: 1rem 0.75rem;
}

.stat-label {
  display: block;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-neutral-500);
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
}

/* Course section */
.course-section {
  margin-bottom: 1.5rem;
}

.course-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.course-header h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-800);
}

.grades-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

/* Grade card */
.grade-card {
  padding: 1rem;
}

.grade-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.375rem;
}

.grade-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.grade-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-primary-700);
  text-decoration: none;
}

.grade-title:hover {
  text-decoration: underline;
}

.grade-score {
  display: flex;
  align-items: baseline;
  gap: 0.125rem;
  border: 2px solid;
  border-radius: 10px;
  padding: 0.375rem 0.75rem;
  flex-shrink: 0;
}

.score-value {
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
}

.score-label {
  font-size: 0.6875rem;
  color: var(--color-neutral-400);
}

.grade-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

/* Feedback */
.feedback-box {
  background-color: var(--color-neutral-50);
  border-left: 3px solid var(--color-primary-300);
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  margin-top: 0.375rem;
}

.feedback-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-600);
}

.feedback-text {
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  margin-top: 0.25rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.mt-1 {
  margin-top: 0.5rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-sm {
  font-size: 0.8125rem;
}

.text-muted {
  color: var(--color-neutral-500);
}

.badge-primary {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-weight: 500;
}
</style>
