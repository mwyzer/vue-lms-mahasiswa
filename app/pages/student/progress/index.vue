<script setup lang="ts">
/**
 * Student Progress & Gamification — /student/progress (Prioritas 3 · W2).
 * Daily streak + heatmap, counters, badges, per-course progress with
 * certificate download (PDF, client-side) and recent activity.
 */
import { ACTIVITY_LABELS } from '~/lib/progress'
import { useProgressStore } from '~/stores/progress'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student'],
})

useHead({ title: 'Progres & Badge — LMS Mahasiswa' })

const auth = useAuthStore()
const progress = useProgressStore()
const downloading = ref<string | null>(null)

onMounted(() => {
  progress.init()
})

const streak = computed(() => progress.streak)
const stats = computed(() => progress.stats)
const courses = computed(() => progress.courseProgress)
const recent = computed(() => progress.activities.slice(0, 10))
const earnedCount = computed(() => progress.earnedBadges.length)

const ACTIVITY_ICONS: Record<string, string> = {
  lesson_completed: '📄',
  quiz_submitted: '✍️',
  assignment_submitted: '📝',
  flashcard_reviewed: '🗂️',
  forum_post: '💬',
}

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function issued(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function download(courseId: string) {
  downloading.value = courseId
  try {
    await progress.downloadCertificate(courseId)
  } finally {
    downloading.value = null
  }
}
</script>

<template>
  <div class="progress-page">
    <PageHeader title="Progres & Badge" subtitle="Streak belajar harian, pencapaian, dan sertifikat mata kuliah." />

    <!-- Progress is per-user client state (localStorage / Supabase session): render on the client only. -->
    <ClientOnly>
    <p v-if="progress.loading && !progress.initialized" class="muted">Memuat progres…</p>
    <p v-if="progress.error" class="alert" role="status">
      Riwayat aktivitas/badge belum bisa dimuat dari server ({{ progress.error }}). Progres dari materi, kuis, dan tugas tetap ditampilkan.
    </p>

    <!-- Streak -->
    <section class="panel streak-panel" aria-labelledby="streak-title">
      <div class="streak-main">
        <span class="streak-flame" :class="{ dim: !streak.activeToday }" aria-hidden="true">🔥</span>
        <div>
          <h2 id="streak-title" class="streak-num" data-testid="streak-current">{{ streak.current }} hari</h2>
          <p class="muted">
            Streak saat ini ·
            {{ streak.activeToday ? 'sudah belajar hari ini ✓' : streak.current > 0 ? 'belajar hari ini agar tidak terputus' : 'selesaikan satu aktivitas untuk memulai' }}
          </p>
          <div class="streak-meta">
            <span><strong>{{ streak.longest }}</strong> hari terpanjang</span>
            <span><strong>{{ streak.activeDays }}</strong> hari aktif</span>
          </div>
        </div>
      </div>
      <div class="streak-heatmap">
        <p class="panel-label">28 hari terakhir</p>
        <StreakHeatmap :days="progress.heatmap" />
      </div>
    </section>

    <!-- Counters -->
    <div class="counter-grid">
      <StatCard icon="📄" :value="stats.lessonsCompleted" label="Materi selesai" variant="primary" />
      <StatCard icon="✍️" :value="stats.quizzesSubmitted" label="Kuis dikerjakan" variant="info" />
      <StatCard icon="📝" :value="stats.assignmentsSubmitted" label="Tugas dikumpulkan" variant="success" />
      <StatCard icon="💬" :value="stats.forumPosts" label="Post forum" variant="warning" />
      <StatCard icon="🗂️" :value="stats.flashcardReviews" label="Flashcard direview" variant="accent" />
    </div>

    <!-- Badges -->
    <section class="panel" aria-labelledby="badge-title">
      <div class="panel-head">
        <h2 id="badge-title" class="panel-title">Badge</h2>
        <span class="muted">{{ earnedCount }} dari {{ progress.badges.length }} didapat</span>
      </div>
      <BadgeGrid :badges="progress.badges" />
    </section>

    <!-- Per course -->
    <section class="panel" aria-labelledby="course-title">
      <div class="panel-head">
        <h2 id="course-title" class="panel-title">Progres per Mata Kuliah</h2>
      </div>
      <p v-if="courses.length === 0" class="muted">Belum ada mata kuliah.</p>
      <ul v-else class="course-list">
        <li v-for="c in courses" :key="c.course_id" class="course-row" :data-course="c.course_id">
          <div class="course-row__head">
            <span class="course-row__icon" aria-hidden="true">{{ c.icon }}</span>
            <div class="course-row__title">
              <span class="course-row__code">{{ c.kode }}</span>
              <NuxtLink :to="`/courses/${c.course_id}`" class="course-row__name">{{ c.nama }}</NuxtLink>
            </div>
            <span v-if="c.completed" class="badge badge-success">Tuntas</span>
          </div>

          <ProgressBar :value="c.percent" :label="`Materi ${c.completedLessons}/${c.lessonCount}`" />

          <div class="course-row__meta">
            <span>✍️ Kuis {{ c.quizzesDone }}/{{ c.quizzesTotal }}</span>
            <span>📝 Tugas {{ c.assignmentsDone }}/{{ c.assignmentsTotal }}</span>
          </div>

          <div class="course-row__cert">
            <template v-if="c.certificate">
              <span class="cert-info">
                Sertifikat terbit {{ issued(c.certificate.issued_at) }} · kode
                <code data-testid="cert-code">{{ c.certificate.verification_code }}</code>
              </span>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="downloading === c.course_id"
                :data-testid="`cert-download-${c.course_id}`"
                @click="download(c.course_id)"
              >
                {{ downloading === c.course_id ? 'Membuat PDF…' : '⬇️ Unduh Sertifikat' }}
              </button>
            </template>
            <span v-else-if="c.lessonCount === 0" class="muted">Belum ada materi di mata kuliah ini.</span>
            <span v-else class="muted">🔒 Sertifikat tersedia setelah semua materi selesai ({{ c.lessonCount - c.completedLessons }} lagi).</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- Recent activity -->
    <section class="panel" aria-labelledby="activity-title">
      <div class="panel-head">
        <h2 id="activity-title" class="panel-title">Aktivitas Terbaru</h2>
      </div>
      <p v-if="recent.length === 0" class="muted">Belum ada aktivitas. Selesaikan materi, kuis, atau tugas untuk memulai streak.</p>
      <ul v-else class="activity-list">
        <li v-for="a in recent" :key="a.id" class="activity-row">
          <span aria-hidden="true">{{ ACTIVITY_ICONS[a.tipe] || '•' }}</span>
          <span class="activity-row__label">
            {{ ACTIVITY_LABELS[a.tipe] }}
            <template v-if="a.tipe === 'quiz_submitted' && a.meta?.percentage !== undefined"> · {{ a.meta.percentage }}%</template>
            <template v-if="a.tipe === 'flashcard_reviewed' && a.meta?.count"> · {{ a.meta.count }} kartu</template>
          </span>
          <time class="activity-row__time" :datetime="a.created_at">{{ when(a.created_at) }}</time>
        </li>
      </ul>
    </section>

    <p v-if="!auth.isStudent" class="muted">Halaman ini menampilkan progres akun mahasiswa.</p>
      <template #fallback>
        <p class="muted">Memuat progres…</p>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.progress-page {
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.progress-page :deep(.page-header) {
  margin-bottom: 0;
}

.muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--tint-warning-border, var(--color-warning));
  background: var(--tint-warning-bg, var(--color-neutral-100));
  color: var(--tint-warning-fg, var(--color-neutral-800));
  font-size: 0.875rem;
}

.panel {
  padding: 1.25rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-neutral-900);
}

.panel-label {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  margin-bottom: 0.5rem;
}

.streak-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.streak-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.streak-flame {
  font-size: 3.25rem;
  line-height: 1;
}

.streak-flame.dim {
  filter: grayscale(0.8);
  opacity: 0.6;
}

.streak-num {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-neutral-900);
}

.streak-meta {
  display: flex;
  gap: 1rem;
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
}

.streak-heatmap {
  flex: 1;
  min-width: 16rem;
  max-width: 26rem;
}

.counter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

.course-list,
.activity-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.course-row {
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.course-row__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.course-row__icon {
  font-size: 1.5rem;
}

.course-row__title {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.course-row__code {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  color: var(--color-neutral-500);
}

.course-row__name {
  font-weight: 600;
  color: var(--color-neutral-800);
}

.course-row__meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
}

.course-row__cert {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.625rem;
  border-top: 1px dashed var(--color-neutral-200);
}

.cert-info {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
}

.cert-info code {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
  background: var(--color-neutral-100);
  color: var(--color-neutral-800);
}

.activity-list {
  gap: 0;
}

.activity-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-neutral-100);
  font-size: 0.875rem;
}

.activity-row:last-child {
  border-bottom: none;
}

.activity-row__label {
  flex: 1;
  color: var(--color-neutral-700);
}

.activity-row__time {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  white-space: nowrap;
}

@media (max-width: 820px) {
  .counter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 540px) {
  .counter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .streak-heatmap {
    min-width: 100%;
  }
}
</style>
