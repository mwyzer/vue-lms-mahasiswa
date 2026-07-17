<script setup lang="ts">
/**
 * Student Attendance Page — View personal attendance records.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const attendanceStore = useAttendanceStore()
const auth = useAuthStore()
const coursesStore = useCoursesStore()

onMounted(async () => {
  attendanceStore.init()
  await coursesStore.init()
})

const myCourses = computed(() => coursesStore.myCourses as any[])

// Get attendance stats for each of the student's courses
const courseAttendance = computed(() => {
  if (!auth.user?.id) return []
  return myCourses.value.map((c: any) => {
    const stats = attendanceStore.studentStats(auth.user!.id, c.id)
    const records = attendanceStore.recordsByStudent(auth.user!.id)
      .filter(r => r.course_id === c.id)
      .sort((a, b) => b.pertemuan - a.pertemuan)
    return { ...c, stats, records }
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
  <div class="student-attendance-page">
    <PageHeader title="Presensi Saya" subtitle="Riwayat kehadiran di setiap mata kuliah" />

    <div v-if="courseAttendance.length === 0" class="empty-state card">
      <p>Belum ada data presensi.</p>
    </div>

    <div v-else class="course-list">
      <div v-for="course in courseAttendance" :key="course.id" class="card course-card">
        <div class="course-att-header">
          <div>
            <h3>{{ course.nama }}</h3>
            <p class="text-sm text-muted">{{ course.kode }}</p>
          </div>
          <div class="persentase-ring" :class="course.stats.persentase >= 75 ? 'baik' : course.stats.persentase >= 60 ? 'cukup' : 'kurang'">
            <span class="persentase-num">{{ course.stats.persentase }}%</span>
            <span class="persentase-label">Hadir</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="att-stats-row">
          <div class="att-stat">
            <span class="att-stat-num">{{ course.stats.total }}</span>
            <span class="att-stat-label">Total</span>
          </div>
          <div class="att-stat stat-hadir">
            <span class="att-stat-num">{{ course.stats.hadir }}</span>
            <span class="att-stat-label">Hadir</span>
          </div>
          <div class="att-stat stat-izin">
            <span class="att-stat-num">{{ course.stats.izin }}</span>
            <span class="att-stat-label">Izin</span>
          </div>
          <div class="att-stat stat-sakit">
            <span class="att-stat-num">{{ course.stats.sakit }}</span>
            <span class="att-stat-label">Sakit</span>
          </div>
          <div class="att-stat stat-alpha">
            <span class="att-stat-num">{{ course.stats.alpha }}</span>
            <span class="att-stat-label">Alpha</span>
          </div>
        </div>

        <!-- Records table -->
        <div v-if="course.records.length > 0" class="records-table">
          <div class="table-header">
            <span class="text-sm font-semibold">Pertemuan</span>
            <span class="text-sm font-semibold">Tanggal</span>
            <span class="text-sm font-semibold">Status</span>
            <span class="text-sm font-semibold">Keterangan</span>
          </div>
          <div v-for="r in course.records" :key="r.id" class="table-row">
            <span>{{ r.pertemuan }}</span>
            <span class="text-sm">{{ r.tanggal }}</span>
            <span class="badge" :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
            <span class="text-sm text-muted">{{ r.keterangan || '-' }}</span>
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
.student-attendance-page {
  max-width: 720px;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.course-att-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.course-att-header h3 {
  font-size: 1rem;
}

.persentase-ring {
  text-align: center;
  padding: 0.5rem 1rem;
  border-radius: 50%;
  min-width: 72px;
  border: 3px solid;
}

.persentase-ring.baik { border-color: #15803d; color: #15803d; }
.persentase-ring.cukup { border-color: #a16207; color: #a16207; }
.persentase-ring.kurang { border-color: #b91c1c; color: #b91c1c; }

.persentase-num {
  display: block;
  font-size: 1.125rem;
  font-weight: 700;
}

.persentase-label {
  display: block;
  font-size: 0.6875rem;
}

.att-stats-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.att-stat {
  flex: 1;
  text-align: center;
  padding: 0.5rem;
  border-radius: 8px;
  background: var(--color-neutral-50);
}

.att-stat-num {
  display: block;
  font-size: 1.125rem;
  font-weight: 700;
}

.att-stat-label {
  display: block;
  font-size: 0.6875rem;
  color: var(--color-neutral-500);
}

.records-table {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.table-header, .table-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px 1fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.375rem 0;
}

.table-header {
  border-bottom: 1px solid var(--color-neutral-200);
  margin-bottom: 0.25rem;
}

.font-semibold { font-weight: 600; }
</style>
