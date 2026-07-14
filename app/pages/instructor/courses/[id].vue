<script setup lang="ts">
/**
 * Instructor Course Detail — Shows course info, enrolled students, management links.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const auth = useAuthStore()

const courseId = computed(() => route.params.id as string)
const students = computed(() => auth.studentRoster as any[])

onMounted(() => {
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)

// Find enrolled students using reverse lookup from DEMO_ENROLLMENTS
// The DEMO_ENROLLMENTS is not exported, so we use myCourses from coursesStore
// and check the course's level/session to filter students
const enrolledStudents = computed(() => {
  if (!course.value) return []
  return students.value.filter(
    (s: any) => s.level === course.value?.level && s.session_time === course.value?.session_time
  )
})

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}
</script>

<template>
  <div class="instructor-course-page">
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
      <!-- Course info -->
      <div class="card course-header-card">
        <div class="course-top">
          <span
            class="course-icon-lg"
            :style="{ backgroundColor: course.color + '20', color: course.color }"
          >
            {{ course.icon || '📚' }}
          </span>
          <div class="course-title-area">
            <span class="course-code">{{ course.kode }}</span>
            <h1>{{ course.nama }}</h1>
            <div class="course-meta">
              <span class="badge badge-neutral">Level {{ course.level }}</span>
              <span
                class="badge"
                :class="course.session_time === 'morning' ? 'badge-primary' : 'badge-warning'"
              >
                {{ course.session_time === 'morning' ? 'Pagi' : 'Malam' }}
              </span>
            </div>
          </div>
        </div>
        <p v-if="course.deskripsi" class="course-desc">{{ course.deskripsi }}</p>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <NuxtLink
          :to="`/instructor/courses/${course.id}/lessons`"
          class="card action-card"
        >
          <span class="action-icon">📖</span>
          <div class="action-info">
            <span class="action-title">Materi</span>
            <span class="action-desc text-sm text-muted">Kelola materi perkuliahan</span>
          </div>
          <span class="action-arrow">→</span>
        </NuxtLink>

        <NuxtLink
          :to="`/instructor/courses/${course.id}/assignments`"
          class="card action-card"
        >
          <span class="action-icon">📝</span>
          <div class="action-info">
            <span class="action-title">Tugas</span>
            <span class="action-desc text-sm text-muted">Kelola tugas dan penilaian</span>
          </div>
          <span class="action-arrow">→</span>
        </NuxtLink>
      </div>

      <!-- Enrolled Students -->
      <section class="section">
        <h2>Mahasiswa Terdaftar ({{ enrolledStudents.length }})</h2>

        <div v-if="enrolledStudents.length === 0" class="empty-state card">
          <p>Belum ada mahasiswa yang terdaftar.</p>
        </div>

        <div v-else class="student-list">
          <div
            v-for="s in enrolledStudents"
            :key="s.id"
            class="card student-card"
          >
            <div class="student-avatar">{{ s.nama?.charAt(0) || '?' }}</div>
            <div class="student-info">
              <span class="student-name">{{ s.nama }}</span>
              <span class="student-npm text-sm text-muted">{{ s.npm }} • {{ s.kelas }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.instructor-course-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.course-header-card {
  margin-bottom: 1rem;
}

.course-top {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.course-icon-lg {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.course-title-area {
  flex: 1;
}

.course-title-area h1 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.course-code {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.course-meta {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.course-desc {
  color: var(--color-neutral-600);
  font-size: 0.875rem;
  line-height: 1.6;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: inherit;
  padding: 1rem;
  transition: border-color 0.2s;
}

.action-card:hover {
  border-color: var(--color-primary-300);
}

.action-icon {
  font-size: 1.5rem;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: var(--color-neutral-50);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-info {
  flex: 1;
}

.action-title {
  font-weight: 600;
  font-size: 0.9375rem;
}

.action-desc {
  margin-top: 0.125rem;
}

.action-arrow {
  color: var(--color-neutral-400);
  font-size: 1.125rem;
}

.section {
  margin-top: 1.5rem;
}

.section h2 {
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.student-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.student-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9375rem;
  flex-shrink: 0;
}

.student-info {
  display: flex;
  flex-direction: column;
}

.student-name {
  font-weight: 500;
  font-size: 0.9375rem;
}

.student-npm {
  margin-top: 0.125rem;
}

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

.text-muted {
  color: var(--color-neutral-500);
}
</style>
