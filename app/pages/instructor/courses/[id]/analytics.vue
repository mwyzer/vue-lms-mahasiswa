<script setup lang="ts">
/**
 * Student Analytics — Per-student performance aggregation for a course.
 *
 * Shows the weighted overall score (assignments 40%, quiz 30%, attendance 30%),
 * lesson progress, and flags at-risk students (overall score < 60).
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor'],
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const authStore = useAuthStore()
const assignmentsStore = useAssignmentsStore()
const quizStore = useQuizStore()
const attendanceStore = useAttendanceStore()
const analyticsStore = useAnalyticsStore()

const courseId = computed(() => route.params.id as string)

onMounted(async () => {
  await Promise.all([
    coursesStore.init(),
    assignmentsStore.init(),
    quizStore.init(),
    attendanceStore.init(),
    authStore.init(),
  ])
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)

const analytics = computed(() => analyticsStore.courseAnalytics(courseId.value))
const stats = computed(() => analytics.value.stats)
const atRisk = computed(() => analytics.value.students.filter((s) => s.atRisk))

/** Sort students by overall score descending (null last). */
const sortedStudents = computed(() =>
  [...analytics.value.students].sort((a, b) => {
    const aScore = a.overallScore ?? -1
    const bScore = b.overallScore ?? -1
    return bScore - aScore
  })
)

function gradeClass(grade: string | null): string {
  if (grade === 'A') return 'grade-a'
  if (grade === 'B') return 'grade-b'
  if (grade === 'C') return 'grade-c'
  return 'grade-d'
}

function pct(value: number): string {
  return `${Math.round(value)}%`
}

function displayScore(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}`
}

function progressPct(student: { lessonProgress: number }): string {
  return pct(student.lessonProgress * 100)
}

const classAverages = computed(() => [
  { icon: '📝', value: displayScore(stats.value.classAssignmentAvg), label: 'Rata-rata Tugas', variant: 'primary' as const },
  { icon: '❓', value: displayScore(stats.value.classQuizAvg), label: 'Rata-rata Kuis', variant: 'info' as const },
  { icon: '✅', value: stats.value.classAttendanceRate === null ? '—' : pct(stats.value.classAttendanceRate), label: 'Rata-rata Presensi', variant: 'success' as const },
  { icon: '📖', value: stats.value.classCompletionRate === null ? '—' : pct(stats.value.classCompletionRate), label: 'Progress Materi', variant: 'accent' as const },
])

function meetingLabel(student: { totalMeetings: number }): string {
  return `${student.totalMeetings} pertemuan`
}
</script>

<template>
  <div class="instructor-analytics-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali
    </button>

    <div v-if="!course" class="empty-state card">
      <p>Mata kuliah tidak ditemukan.</p>
      <NuxtLink to="/instructor/courses" class="btn btn-primary btn-sm mt-1">
        Kembali ke Daftar
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="analytics-header">
        <div>
          <h1>Analisis Mahasiswa — {{ course.nama }}</h1>
          <span class="course-code">{{ course.kode }}</span>
        </div>
        <div class="header-badges">
          <span class="badge badge-level">Level {{ course.level }}</span>
          <span class="badge badge-warn" v-if="stats.atRiskCount > 0">
            {{ stats.atRiskCount }} perlu perhatian
          </span>
        </div>
      </div>

      <!-- Class averages -->
      <div class="stat-grid">
        <StatCard
          v-for="a in classAverages"
          :key="a.label"
          :icon="a.icon"
          :value="a.value"
          :label="a.label"
          :variant="a.variant"
        />
      </div>

      <!-- At-risk panel -->
      <div class="card at-risk-card" :class="{ 'at-risk-empty': atRisk.length === 0 }">
        <h2>⚠️ Mahasiswa Berisiko</h2>
        <p v-if="atRisk.length === 0" class="text-muted">
          Tidak ada mahasiswa yang perlu perhatian khusus saat ini.
        </p>
        <div v-else class="at-risk-list">
          <div v-for="s in atRisk" :key="s.student_id" class="at-risk-row">
            <div class="student-avatar">{{ s.nama.charAt(0) }}</div>
            <div class="student-info">
              <strong>{{ s.nama }}</strong>
              <span class="text-sm text-muted">
                Nilai akhir {{ displayScore(s.overallScore) }} • Tugas {{ s.assignmentDone }}/{{ s.assignmentTotal }} • Presensi {{ s.attendanceRate === null ? '—' : pct(s.attendanceRate) }}
              </span>
            </div>
            <span class="at-risk-score" :class="gradeClass(s.overallGrade)">{{ s.overallGrade }}</span>
          </div>
        </div>
      </div>

      <!-- Score breakdown legend -->
      <p class="legend text-muted">
        Nilai akhir = 40% tugas + 30% kuis + 30% presensi. Mahasiswa dengan nilai akhir &lt; 60 ditandai berisiko.
      </p>

      <!-- Per-student table -->
      <div class="card table-card">
        <div class="table-header">
          <h2>Rincian Mahasiswa ({{ sortedStudents.length }})</h2>
        </div>
        <div v-if="sortedStudents.length === 0" class="empty-state">
          <p>Belum ada mahasiswa terdaftar untuk mata kuliah ini.</p>
        </div>
        <div v-else class="table-scroll">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Mahasiswa</th>
                <th>NPM</th>
                <th>Tugas</th>
                <th>Kuis</th>
                <th>Presensi</th>
                <th>Materi</th>
                <th>Nilai Akhir</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sortedStudents" :key="s.student_id">
                <td>
                  <div class="cell-student">
                    <div class="student-avatar small">{{ s.nama.charAt(0) }}</div>
                    <strong>{{ s.nama }}</strong>
                  </div>
                </td>
                <td class="text-muted cell-npm">{{ s.npm || '—' }}</td>
                <td>
                  <div v-if="s.assignmentAvg === null" class="text-muted">—</div>
                  <div v-else>
                    <strong>{{ displayScore(s.assignmentAvg) }}</strong>
                    <span class="text-xs text-muted">/ {{ s.assignmentDone }}/{{ s.assignmentTotal }}</span>
                  </div>
                </td>
                <td>
                  <div v-if="s.quizAvg === null" class="text-muted">—</div>
                  <div v-else>
                    <strong>{{ displayScore(s.quizAvg) }}</strong>
                    <span class="text-xs text-muted">/ {{ s.quizAttempts }}</span>
                  </div>
                </td>
                <td>
                  <div v-if="s.attendanceRate === null" class="text-muted">—</div>
                  <div v-else>
                    <strong>{{ pct(s.attendanceRate) }}</strong>
                    <span class="text-xs text-muted">({{ s.hadirCount }}/{{ meetingLabel(s) }})</span>
                  </div>
                </td>
                <td>
                  <div class="progress-cell">
                    <div class="progress-track">
                      <div class="progress-fill" :style="{ width: progressPct(s) }" />
                    </div>
                    <span class="text-xs text-muted">{{ progressPct(s) }}</span>
                  </div>
                </td>
                <td>
                  <strong>{{ displayScore(s.overallScore) }}</strong>
                </td>
                <td>
                  <span
                    v-if="s.overallGrade"
                    class="grade-badge"
                    :class="gradeClass(s.overallGrade)"
                  >{{ s.overallGrade }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.instructor-analytics-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.back-btn {
  align-self: flex-start;
}

.analytics-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.analytics-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.course-code {
  color: var(--color-neutral-500);
  font-size: 0.85rem;
}

.header-badges {
  display: flex;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-level {
  background: var(--color-accent-soft);
  color: var(--color-accent-deep);
}

.badge-warn {
  background: oklch(92% 0.10 60 / 0.4);
  color: oklch(42% 0.16 55);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.at-risk-card {
  padding: 1.25rem;
  border-left: 4px solid oklch(70% 0.17 55);
}

.at-risk-card.at-risk-empty {
  border-left-color: var(--color-accent-soft);
}

.at-risk-card h2,
.table-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.at-risk-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.at-risk-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  background: oklch(96% 0.02 55 / 0.4);
}

.student-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: var(--color-accent);
  flex-shrink: 0;
}

.student-avatar.small {
  width: 2rem;
  height: 2rem;
  font-size: 0.85rem;
}

.student-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.at-risk-score {
  font-weight: 800;
  font-size: 1.1rem;
}

.legend {
  font-size: 0.8rem;
}

.table-card {
  padding: 1.25rem;
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.analytics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.analytics-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 2px solid var(--color-neutral-100);
  color: var(--color-neutral-500);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.analytics-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-neutral-100);
  vertical-align: middle;
}

.cell-student {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.cell-npm {
  white-space: nowrap;
}

.text-muted {
  color: var(--color-neutral-500);
}

.text-xs {
  font-size: 0.75rem;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 110px;
}

.progress-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--color-neutral-100);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-accent);
}

.grade-badge,
.grade-a,
.grade-b,
.grade-c,
.grade-d {
  font-weight: 800;
}

.grade-a { color: oklch(45% 0.15 150); }
.grade-b { color: oklch(50% 0.14 190); }
.grade-c { color: oklch(50% 0.13 85); }
.grade-d,
.grade-e { color: oklch(50% 0.16 25); }

.grade-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--color-neutral-100);
}
</style>
