<script setup lang="ts">
/**
 * Instructor Attendance Overview — Shows all attendance records across courses.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const attendanceStore = useAttendanceStore()
const coursesStore = useCoursesStore()
const auth = useAuthStore()

onMounted(async () => {
  await coursesStore.init()
  attendanceStore.init()
})

const myCourses = computed(() => coursesStore.myCourses as any[])

const attendanceByCourse = computed(() => {
  return myCourses.value.map((c: any) => {
    const records = attendanceStore.recordsByCourse(c.id)
    const meetings = [...new Set(records.map(r => r.pertemuan))].sort((a, b) => b - a)
    const totalHadir = records.filter(r => r.status === 'hadir').length
    const totalAlpha = records.filter(r => r.status === 'alpha').length
    return { ...c, records, meetings, totalHadir, totalAlpha }
  })
})

function statusLabel(status: string): string {
  const map: Record<string, string> = { hadir: '✅ Hadir', izin: '📋 Izin', sakit: '🤒 Sakit', alpha: '❌ Alpha' }
  return map[status] || status
}

function statusClass(status: string): string {
  const map: Record<string, string> = { hadir: 'badge-success', izin: 'badge-warning', sakit: 'badge-neutral', alpha: 'badge-danger' }
  return map[status] || ''
}
</script>

<template>
  <div class="attendance-page">
    <div class="page-header">
      <div>
        <h1>Presensi</h1>
        <p class="text-muted">Rekap kehadiran mahasiswa di semua mata kuliah</p>
      </div>
    </div>

    <div v-if="myCourses.length === 0" class="empty-state card">
      <p>Anda belum memiliki mata kuliah.</p>
    </div>

    <div v-else class="course-list">
      <div v-for="course in attendanceByCourse" :key="course.id" class="card course-card">
        <div class="course-header">
          <div>
            <h3>{{ course.nama }}</h3>
            <p class="text-sm text-muted">{{ course.kode }}</p>
          </div>
          <NuxtLink :to="`/instructor/courses/${course.id}/attendance`" class="btn btn-primary btn-sm">
            Kelola Presensi
          </NuxtLink>
        </div>

        <div class="course-stats">
          <div class="stat-chip stat-hadir">✅ Hadir: {{ course.totalHadir }}</div>
          <div class="stat-chip stat-alpha">❌ Alpha: {{ course.totalAlpha }}</div>
          <div class="stat-chip">📅 Pertemuan: {{ course.meetings.length }}</div>
        </div>

        <!-- Recent records -->
        <div v-if="course.records.length > 0" class="recent-records">
          <p class="text-sm text-muted">Catatan terbaru:</p>
          <div v-for="record in course.records.slice(0, 5)" :key="record.id" class="record-row">
            <span class="text-sm">{{ record.student_name }}</span>
            <span class="badge" :class="statusClass(record.status)">{{ statusLabel(record.status) }}</span>
            <span class="text-sm text-muted">Pertemuan {{ record.pertemuan }}</span>
            <span class="text-sm text-muted">{{ record.tanggal }}</span>
          </div>
        </div>
        <div v-else class="text-sm text-muted">
          Belum ada catatan presensi.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-page {
  max-width: 720px;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.course-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.course-header h3 {
  font-size: 1rem;
}

.course-stats {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.stat-chip {
  font-size: 0.8125rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-neutral-100);
  border-radius: 6px;
}

.stat-hadir { background: #dcfce7; color: #15803d; }
.stat-alpha { background: #fce7e7; color: #b91c1c; }

.recent-records {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}
</style>
