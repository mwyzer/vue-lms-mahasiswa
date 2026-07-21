<script setup lang="ts">
/**
 * Student Dashboard — Overview page for students.
 *
 * Macrostructure: Bento Grid — each content cluster gets a distinct
 * visual weight and position; sections don't repeat the same pattern.
 *
 * Theme: Scholar (light · academic-serif + sans · deep-indigo)
 * Enrichment: Tier-A reveal primitives (staggered entrance, counter tick-up)
 * Motion: staggered reveal via IntersectionObserver, respects reduced-motion
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

import { useDashboard } from '~/composables/useDashboard'

const auth = useAuthStore()
const coursesStore = useCoursesStore()
const assignmentsStore = useAssignmentsStore()
const announcementsStore = useAnnouncementsStore()
const calendarStore = useCalendarStore()
const quizStore = useQuizStore()

const { formatDate, isCloseToDeadline, eventTypeClass, initRevealAnimations } = useDashboard()

// Wrapped in computed for reactive template binding
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Selamat Pagi'
  if (hour < 15) return 'Selamat Siang'
  if (hour < 18) return 'Selamat Sore'
  return 'Selamat Malam'
})

const myCourses = computed(() => coursesStore.myCourses)

onMounted(() => {
  coursesStore.init()
  assignmentsStore.init()
  announcementsStore.init()
  calendarStore.init()
  quizStore.init()
  initRevealAnimations()
})

const userName = computed(() => auth.user?.nama || 'Mahasiswa')
const userLevel = computed(() => auth.user?.level || '-')
const userSession = computed(() => auth.user?.session_time === 'morning' ? 'Pagi' : 'Malam')
const userKelas = computed(() => auth.user?.kelas || '-')

// Stats
const totalCourses = computed(() => myCourses.value.length)
const completedLessons = computed(() =>
  myCourses.value.reduce((sum, c) => sum + (c.completedLessons || 0), 0)
)
const totalLessons = computed(() =>
  myCourses.value.reduce((sum, c) => sum + (c.lessonCount || 0), 0)
)

const overallProgress = computed(() =>
  totalLessons.value > 0 ? Math.round((completedLessons.value / totalLessons.value) * 100) : 0
)

// Upcoming calendar events (next 5)
const upcomingEvents = computed(() => calendarStore.upcomingEvents.slice(0, 5))

// Quiz attempts (recent)
const myQuizAttempts = computed(() => {
  if (!auth.user) return []
  return quizStore.attemptsByStudent(auth.user.id).slice(0, 5)
})

// Upcoming assignments (next 5)
const upcomingAssignments = computed(() =>
  (assignmentsStore.myAssignments as any[])
    .filter((a: any) => new Date(a.tenggat_waktu) >= new Date() || !a.submission)
    .sort((a: any, b: any) => new Date(a.tenggat_waktu).getTime() - new Date(b.tenggat_waktu).getTime())
    .slice(0, 5)
)
</script>

<template>
  <div class="dashboard-page">
    <!--
      Hallmark · macrostructure: Bento Grid
      theme: Scholar · enrichment: Tier-A counter tick-up on stats
      motion: staggered reveal · axes: light / academic-serif+sans / deep-indigo
    -->

    <!-- ── BENTO HEADER ── -->
    <header class="bento-header reveal" style="--i:0">
      <div>
        <p class="bento-header__greeting">{{ greeting }},</p>
        <h1 class="bento-header__name">{{ userName }}</h1>
      </div>
      <div class="bento-header__meta">
        <span class="meta-chip">Kelas {{ userKelas }}</span>
        <span class="meta-chip">Level {{ userLevel }}</span>
        <span class="meta-chip">Sesi {{ userSession }}</span>
      </div>
    </header>

    <!-- ── BENTO GRID ── -->
    <div class="bento-grid">

      <!-- ── Stats row ── -->
      <div class="bento-tile reveal" style="--i:1">
        <StatCard icon="📖" :value="totalCourses" label="Mata Kuliah Aktif" variant="primary" />
      </div>

      <div class="bento-tile reveal" style="--i:2">
        <StatCard icon="✅" :value="`${completedLessons} / ${totalLessons}`" label="Materi Selesai" variant="success" />
      </div>

      <div class="bento-tile reveal" style="--i:3">
        <StatCard icon="📊" :value="`${overallProgress}%`" label="Progress Keseluruhan" variant="warning" />
      </div>

      <!-- ── Courses (span 2 cols — weightier) ── -->
      <div class="bento-tile bento-tile--span-2 reveal" style="--i:4">
        <div class="tile-header">
          <h2 class="tile-title">Mata Kuliah Saya</h2>
          <NuxtLink to="/courses" class="tile-action">Lihat Semua →</NuxtLink>
        </div>

        <div v-if="myCourses.length === 0" class="empty-state">
          <p>Belum ada mata kuliah yang didaftarkan.</p>
        </div>

        <div v-else class="bento-course-grid">
          <NuxtLink
            v-for="course in myCourses"
            :key="course.id"
            :to="`/courses/${course.id}`"
            class="course-card"
          >
            <div class="course-card__head">
              <span
                class="course-card__icon"
                :style="{ backgroundColor: course.color + '20', color: course.color }"
              >{{ course.icon || '📚' }}</span>
              <div>
                <span class="course-card__code">{{ course.kode }}</span>
                <h3 class="course-card__name">{{ course.nama }}</h3>
              </div>
            </div>
            <p v-if="course.deskripsi" class="course-card__desc">{{ course.deskripsi }}</p>
            <div class="course-card__badges">
              <span class="badge badge-neutral">Level {{ course.level }}</span>
              <span
                class="badge"
                :class="course.session_time === 'morning' ? 'badge-primary' : 'badge-warning'"
              >{{ course.session_time === 'morning' ? 'Pagi' : 'Malam' }}</span>
            </div>
            <div class="course-card__progress">
              <span class="progress-label">Progress</span>
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :style="{ width: (course.progressPercent || 0) + '%' }"
                />
              </div>
              <span class="progress-pct">{{ course.progressPercent || 0 }}%</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- ── Assignments (span 1 col — tighter) ── -->
      <div class="bento-tile reveal" style="--i:5">
        <div class="tile-header">
          <h2 class="tile-title">Tugas Mendatang</h2>
          <NuxtLink to="/assignments" class="tile-action">Lihat →</NuxtLink>
        </div>

        <div v-if="upcomingAssignments.length === 0" class="empty-state">
          <p>Belum ada tugas mendatang.</p>
        </div>

        <div v-else class="assignment-stack">
          <NuxtLink
            v-for="a in upcomingAssignments"
            :key="a.id"
            :to="`/assignments/${a.id}`"
            class="assignment-row"
          >
            <div class="assignment-row__body">
              <span class="assignment-row__course">{{ a.course_kode }}</span>
              <span class="assignment-row__title">{{ a.judul }}</span>
            </div>
            <div class="assignment-row__meta">
              <span class="assignment-row__date">{{ formatDate(a.tenggat_waktu) }}</span>
              <span
                v-if="a.submission"
                class="badge badge-primary badge-sm"
              >✓</span>
              <span
                v-else-if="isCloseToDeadline(a.tenggat_waktu)"
                class="badge badge-danger badge-sm"
              >Segera!</span>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- ── Announcements ── -->
      <div class="bento-tile reveal" style="--i:6">
        <div class="tile-header">
          <h2 class="tile-title">Pengumuman</h2>
        </div>

        <div v-if="announcementsStore.loading" class="empty-state">
          <p>Memuat pengumuman...</p>
        </div>

        <div v-else-if="announcementsStore.recentAnnouncements.length === 0" class="empty-state">
          <p>Belum ada pengumuman.</p>
        </div>

        <div v-else class="announcement-stack">
          <div
            v-for="ann in announcementsStore.recentAnnouncements"
            :key="ann.id"
            class="announcement-row"
          >
            <div class="announcement-row__head">
              <span class="announcement-row__icon">📢</span>
              <div>
                <span class="announcement-row__title">{{ ann.judul }}</span>
                <span class="announcement-row__date">{{ formatDate(ann.created_at) }}</span>
              </div>
            </div>
            <p class="announcement-row__body">{{ ann.konten }}</p>
          </div>
        </div>
      </div>

      <!-- ── Events ── -->
      <div class="bento-tile reveal" style="--i:7">
        <div class="tile-header">
          <h2 class="tile-title">📅 Event</h2>
          <NuxtLink to="/calendar" class="tile-action">Kalender →</NuxtLink>
        </div>

        <div v-if="upcomingEvents.length === 0" class="empty-state">
          <p>Tidak ada event mendatang.</p>
        </div>

        <div v-else class="event-stack">
          <NuxtLink
            v-for="ev in upcomingEvents"
            :key="ev.id"
            to="/calendar"
            class="event-row"
          >
            <span
              class="event-row__dot"
              :class="eventTypeClass(ev.tipe)"
            />
            <div class="event-row__body">
              <span class="event-row__title">{{ ev.judul }}</span>
              <span v-if="ev.course_name" class="event-row__course">{{ ev.course_name }}</span>
            </div>
            <span class="event-row__date">
              {{ new Date(ev.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
            </span>
          </NuxtLink>
        </div>
      </div>

      <!-- ── Quiz ── -->
      <div class="bento-tile reveal" style="--i:8">
        <div class="tile-header">
          <h2 class="tile-title">✍️ Kuis Terbaru</h2>
          <NuxtLink to="/quiz" class="tile-action">Semua →</NuxtLink>
        </div>

        <div v-if="myQuizAttempts.length === 0" class="empty-state">
          <p>Belum ada kuis yang dikerjakan.</p>
        </div>

        <div v-else class="quiz-stack">
          <div
            v-for="att in myQuizAttempts"
            :key="att.id"
            class="quiz-row"
          >
            <span class="quiz-row__title">{{ att.quiz_title || 'Kuis' }}</span>
            <span
              class="quiz-row__score"
              :class="att.percentage >= 60 ? 'score--pass' : 'score--fail'"
            >{{ att.percentage }}%</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════
   Bento Grid Macrostructure — Scholar theme
   Axes: light / academic-serif+sans / deep-indigo
   ═══════════════════════════════════════════ */

.dashboard-page {
  max-width: 960px;
}

/* ── Bento Header ───────────────────────── */
.bento-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.bento-header__greeting {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-ink-muted);
  margin: 0 0 0.15rem;
}

.bento-header__name {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  line-height: 1.15;
}

.bento-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-chip {
  font-family: var(--font-label);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  color: var(--color-accent-deep);
  font-weight: 500;
}

/* ── Bento Grid ─────────────────────────── */
.bento-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.bento-tile {
  min-width: 0;
}

.bento-tile--span-2 {
  grid-column: span 2;
}

/* ── Tile Headers ───────────────────────── */
.tile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.tile-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
}

.tile-action {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-accent-deep);
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}

.tile-action:hover {
  color: var(--color-ink);
}

/* ── Reveal Animation ───────────────────── */
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-out);
  transition-delay: calc(var(--i, 0) * 60ms);
}

.reveal.is-inview {
  opacity: 1;
  transform: none;
}

/* ── Empty State ────────────────────────── */
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

/* ── Course Cards (inside bento tile) ───── */
.bento-course-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.course-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-card);
  text-decoration: none;
  color: inherit;
  transition:
    box-shadow var(--dur-base) var(--ease-out),
    transform var(--dur-base) var(--ease-out);
}

.course-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
  text-decoration: none;
}

.course-card__head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.course-card__icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.course-card__code {
  font-family: var(--font-label);
  font-size: 0.65rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
  font-weight: 500;
}

.course-card__name {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-ink);
  margin: 0;
  line-height: 1.2;
}

.course-card__desc {
  font-size: 0.775rem;
  color: var(--color-ink-muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.course-card__badges {
  display: flex;
  gap: 0.35rem;
}

.course-card__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-label {
  font-size: 0.7rem;
  color: var(--color-ink-muted);
  flex-shrink: 0;
}

.progress-track {
  flex: 1;
  height: 5px;
  background: var(--color-neutral-200);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-deep));
  border-radius: var(--radius-pill);
  transition: width 0.6s var(--ease-out);
}

.progress-pct {
  font-family: var(--font-label);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-accent-deep);
  flex-shrink: 0;
}

/* ── Assignment Stack ───────────────────── */
.assignment-stack {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.assignment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-card);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.assignment-row:hover {
  border-color: var(--color-accent-soft);
  text-decoration: none;
}

.assignment-row__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.assignment-row__course {
  font-family: var(--font-label);
  font-size: 0.65rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-accent-deep);
  font-weight: 600;
}

.assignment-row__title {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--color-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.assignment-row__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.assignment-row__date {
  font-size: 0.7rem;
  color: var(--color-ink-muted);
  white-space: nowrap;
}

/* ── Announcement Stack ─────────────────── */
.announcement-stack {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.announcement-row {
  padding: 0.75rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-card);
  border-left: 3px solid var(--color-accent);
}

.announcement-row__head {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.announcement-row__icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.announcement-row__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-ink);
  display: block;
}

.announcement-row__date {
  font-size: 0.675rem;
  color: var(--color-ink-muted);
}

.announcement-row__body {
  font-size: 0.8rem;
  color: var(--color-ink-2);
  line-height: 1.45;
  margin: 0 0 0 1.5rem;
}

/* ── Event Stack ────────────────────────── */
.event-stack {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-card);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.event-row:hover {
  border-color: var(--color-accent-soft);
  text-decoration: none;
}

.event-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--primary { background: var(--color-accent); }
.dot--success { background: oklch(50% 0.14 145); }
.dot--warning { background: oklch(60% 0.14 85); }
.dot--danger  { background: oklch(55% 0.18 30); }
.dot--info    { background: oklch(55% 0.10 200); }
.dot--accent  { background: oklch(50% 0.16 290); }

.event-row__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.event-row__title {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--color-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-row__course {
  font-size: 0.675rem;
  color: var(--color-ink-muted);
}

.event-row__date {
  font-size: 0.7rem;
  color: var(--color-ink-muted);
  flex-shrink: 0;
}

/* ── Quiz Stack ─────────────────────────── */
.quiz-stack {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.quiz-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-card);
}

.quiz-row__title {
  font-size: 0.825rem;
  font-weight: 600;
  color: var(--color-ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quiz-row__score {
  font-family: var(--font-label);
  font-size: 0.775rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.score--pass {
  background: oklch(88% 0.10 145 / 0.3);
  color: oklch(38% 0.12 145);
}

.score--fail {
  background: oklch(88% 0.14 30 / 0.3);
  color: oklch(45% 0.16 30);
}

/* ── Responsive ─────────────────────────── */
@media (max-width: 820px) {
  .bento-grid {
    grid-template-columns: 1fr 1fr;
  }

  .bento-tile--span-2 {
    grid-column: span 2;
  }

  .bento-course-grid {
    grid-template-columns: 1fr;
  }

  .bento-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 540px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }

  .bento-tile--span-2 {
    grid-column: span 1;
  }
}
</style>
