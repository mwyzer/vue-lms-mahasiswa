<script setup lang="ts">
/**
 * Instructor Course Attendance — Record and manage attendance per meeting.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const attendanceStore = useAttendanceStore()
const auth = useAuthStore()
const notification = useNotification()

const courseId = computed(() => route.params.id as string)
const currentPertemuan = ref(1)
const tanggal = ref(new Date().toISOString().split('T')[0])

onMounted(async () => {
  await coursesStore.init()
  attendanceStore.init()
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)

// Get all students with their attendance status for this meeting
const meetingRecords = ref<any[]>([])

async function loadMeeting() {
  const records = await attendanceStore.getOrCreateMeetingAttendance(
    courseId.value, currentPertemuan.value, tanggal.value
  )
  meetingRecords.value = records.map(r => ({
    ...r,
    _status: r.status || 'hadir', // default to hadir for new records
  }))
}

watch([currentPertemuan, tanggal], () => { loadMeeting() })
onMounted(() => { loadMeeting() })

// All meetings for this course
const existingMeetings = computed(() => {
  const records = attendanceStore.recordsByCourse(courseId.value)
  return [...new Set(records.map(r => r.pertemuan))].sort((a, b) => b - a)
})

async function saveAll() {
  let saved = 0
  for (const record of meetingRecords.value) {
    const ok = await attendanceStore.setAttendance({
      course_id: courseId.value,
      student_id: record.student_id,
      instructor_id: auth.user?.id || '',
      tanggal: tanggal.value,
      status: record._status,
      pertemuan: currentPertemuan.value,
      keterangan: record.keterangan || undefined,
    })
    if (ok) saved++
  }
  notification.success(`Presensi pertemuan ${currentPertemuan.value} disimpan (${saved} mahasiswa)!`)
}

function statusColor(status: string): string {
  const map: Record<string, string> = { hadir: '#dcfce7', izin: '#fef3c7', sakit: '#f3e8ff', alpha: '#fce7e7' }
  return map[status] || ''
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { hadir: '✅ Hadir', izin: '📋 Izin', sakit: '🤒 Sakit', alpha: '❌ Alpha' }
  return map[status] || 'Pilih'
}
</script>

<template>
  <div class="attendance-page">
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali
    </button>

    <div v-if="!course" class="empty-state card">
      <p>Mata kuliah tidak ditemukan.</p>
    </div>

    <template v-else>
      <div class="page-header">
        <div>
          <h1>Presensi: {{ course.nama }}</h1>
          <p class="text-muted">{{ course.kode }} • Kelola kehadiran mahasiswa</p>
        </div>
      </div>

      <!-- Controls -->
      <div class="card controls-card">
        <div class="controls-row">
          <div class="form-group">
            <label class="form-label">Pertemuan ke-</label>
            <div class="meeting-controls">
              <input v-model.number="currentPertemuan" type="number" class="form-input" min="1" max="30" style="width:80px" />
              <button
                v-for="m in existingMeetings.slice(0, 5)"
                :key="m"
                class="btn btn-sm"
                :class="currentPertemuan === m ? 'btn-primary' : 'btn-ghost'"
                @click="currentPertemuan = m"
              >
                {{ m }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input v-model="tanggal" type="date" class="form-input" style="width:auto" />
          </div>
        </div>
      </div>

      <!-- Student attendance list -->
      <div class="card">
        <div class="attendance-header">
          <h3>Daftar Mahasiswa</h3>
          <span class="text-sm text-muted">{{ meetingRecords.length }} mahasiswa</span>
        </div>

        <div v-if="meetingRecords.length === 0" class="empty-state">
          <p>Tidak ada data mahasiswa.</p>
        </div>

        <div v-else class="attendance-list">
          <div
            v-for="record in meetingRecords"
            :key="record.student_id"
            class="attendance-row"
          >
            <div class="student-info-att">
              <span class="student-name-att">{{ record.student_name || '(Nama tidak ditemukan)' }}</span>
              <span class="text-sm text-muted">{{ record.student_npm }}</span>
            </div>

            <div class="status-buttons">
              <button
                v-for="s in ['hadir', 'izin', 'sakit', 'alpha']"
                :key="s"
                class="btn btn-xs"
                :class="record._status === s ? 'btn-primary' : 'btn-ghost'"
                :style="record._status === s ? { background: statusColor(s), borderColor: 'transparent' } : {}"
                @click="record._status = s"
              >
                {{ statusLabel(s) }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="meetingRecords.length > 0" class="save-section">
          <button class="btn btn-primary" :disabled="!tanggal" @click="saveAll">
            💾 Simpan Semua
          </button>
        </div>
      </div>

      <!-- Stats for selected meeting -->
      <div class="card stats-card">
        <h3>Ringkasan Pertemuan {{ currentPertemuan }}</h3>
        <div class="stats-row">
          <div class="stat stat-hadir">
            <span class="stat-num">{{ meetingRecords.filter(r => r._status === 'hadir').length }}</span>
            <span class="stat-label">Hadir</span>
          </div>
          <div class="stat stat-izin">
            <span class="stat-num">{{ meetingRecords.filter(r => r._status === 'izin').length }}</span>
            <span class="stat-label">Izin</span>
          </div>
          <div class="stat stat-sakit">
            <span class="stat-num">{{ meetingRecords.filter(r => r._status === 'sakit').length }}</span>
            <span class="stat-label">Sakit</span>
          </div>
          <div class="stat stat-alpha">
            <span class="stat-num">{{ meetingRecords.filter(r => r._status === 'alpha').length }}</span>
            <span class="stat-label">Alpha</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.attendance-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.controls-card {
  margin-bottom: 1rem;
}

.controls-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.meeting-controls {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.attendance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.attendance-header h3 {
  font-size: 1rem;
}

.attendance-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attendance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-neutral-200);
}

.attendance-row:last-child {
  border-bottom: none;
}

.student-info-att {
  display: flex;
  flex-direction: column;
  min-width: 160px;
}

.student-name-att {
  font-weight: 500;
  font-size: 0.875rem;
}

.status-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.save-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
}

.stats-card {
  margin-top: 0.75rem;
}

.stats-card h3 {
  font-size: 0.9375rem;
  margin-bottom: 0.75rem;
}

.stats-row {
  display: flex;
  gap: 1rem;
}

.stat {
  flex: 1;
  text-align: center;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--color-neutral-50);
}

.stat-num {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  margin-top: 0.125rem;
}

.stat-hadir .stat-num { color: #15803d; }
.stat-izin .stat-num { color: #a16207; }
.stat-sakit .stat-num { color: #7c3aed; }
.stat-alpha .stat-num { color: #b91c1c; }

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 0.375rem;
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  background-color: white;
  color: var(--color-neutral-800);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}
</style>
