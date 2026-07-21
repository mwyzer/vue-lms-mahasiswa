<script setup lang="ts">
/**
 * Academic Calendar Page — View all academic events in month/list views.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth']
})

import { useCalendarStore } from '~/stores/calendar'
import { useAuthStore } from '~/stores/auth'

const calendarStore = useCalendarStore()
calendarStore.init()
const auth = useAuthStore()

const viewMode = ref<'month' | 'list' | 'timeline'>('list')
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

// Timeline state
const timelineStart = ref(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
const timelineEnd = ref(new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0])

function resetTimelineRange() {
  const now = new Date()
  timelineStart.value = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
  timelineEnd.value = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]
}

const timelineEvents = computed(() => {
  const start = new Date(timelineStart.value)
  const end = new Date(timelineEnd.value)
  end.setHours(23, 59, 59, 999)
  const all = calendarStore.allEvents.filter((ev: any) => {
    const d = new Date(ev.tanggal_mulai)
    return d >= start && d <= end
  })
  all.sort((a: any, b: any) => new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime())
  const rangeMs = end.getTime() - start.getTime()
  if (rangeMs <= 0) return all
  return all.map((ev: any) => {
    const evStart = new Date(ev.tanggal_mulai).getTime()
    const evEnd = ev.tanggal_selesai ? new Date(ev.tanggal_selesai).getTime() : evStart + 3600000
    const left = ((evStart - start.getTime()) / rangeMs) * 100
    const width = ((evEnd - evStart) / rangeMs) * 100
    return { ...ev, _left: Math.max(left, 0), _width: Math.max(width, 1) }
  })
})

const timelineMonths = computed(() => {
  const start = new Date(timelineStart.value)
  const end = new Date(timelineEnd.value)
  end.setHours(23, 59, 59, 999)
  const rangeMs = end.getTime() - start.getTime()
  if (rangeMs <= 0) return []
  const months: { name: string; year: number; left: number; width: number }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const monthStart = new Date(cursor)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999)
    const left = Math.max(((monthStart.getTime() - start.getTime()) / rangeMs) * 100, 0)
    const width = Math.max(((monthEnd.getTime() - monthStart.getTime()) / rangeMs) * 100, 1)
    months.push({
      name: monthNames[cursor.getMonth()],
      year: cursor.getFullYear(),
      left: Math.min(left, 100),
      width: Math.min(width, 100 - left),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
})

const monthEvents = computed(() =>
  calendarStore.eventsByMonth(currentYear.value, currentMonth.value)
)

const todayEvents = computed(() => calendarStore.todayEvents)
const upcomingEvents = computed(() => calendarStore.upcomingEvents)

const allEvents = computed(() => calendarStore.allEvents)

// Month navigation
function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const typeLabels: Record<string, string> = {
  uts: 'UTS', uas: 'UAS', tugas: 'Tugas', libur: 'Libur', acara: 'Acara',
}

const typeColors: Record<string, string> = {
  uts: '#ef4444', uas: '#f59e0b', tugas: '#3b82f6', libur: '#8b5cf6', acara: '#06b6d4',
}

function kelasLabel(kelas: string): string {
  const map: Record<string, string> = {
    pagi: 'Pagi',
    malam: 'Malam',
  }
  return map[kelas] || kelas
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Admin CRUD ──────────────────────────────────
const isAdmin = computed(() => auth.role === 'admin')

const showModal = ref(false)
const editingEventId = ref<string | null>(null)
const formJudul = ref('')
const formDeskripsi = ref('')
const formTipe = ref<'uts' | 'uas' | 'tugas' | 'libur' | 'acara'>('acara')
const formTanggalMulai = ref('')
const formTanggalSelesai = ref('')
const formColor = ref('#3b82f6')
const saving = ref(false)
const deletingId = ref<string | null>(null)

const formKelas = ref('')
const formClassName = ref('')

const kelasOptions = [
  { value: '', label: '— Pilih kategori —' },
  { value: 'pagi', label: 'Pagi' },
  { value: 'malam', label: 'Malam' },
]

const courseOptions = [
  { id: '', nama: '— Tidak ada (event umum) —' },
  { id: 'c1', nama: 'Algoritma & Pemrograman' },
  { id: 'c2', nama: 'Struktur Data' },
  { id: 'c3', nama: 'Basis Data' },
  { id: 'c4', nama: 'Pemrograman Web' },
  { id: 'c5', nama: 'Jaringan Komputer' },
]
const formCourseId = ref('')

const typeOptions = [
  { value: 'uts' as const, label: 'UTS', color: '#ef4444' },
  { value: 'uas' as const, label: 'UAS', color: '#f59e0b' },
  { value: 'tugas' as const, label: 'Tugas', color: '#3b82f6' },
  { value: 'libur' as const, label: 'Libur', color: '#8b5cf6' },
  { value: 'acara' as const, label: 'Acara', color: '#06b6d4' },
]

function openAddModal() {
  editingEventId.value = null
  formJudul.value = ''
  formDeskripsi.value = ''
  formTipe.value = 'acara'
  formTanggalMulai.value = new Date().toISOString().slice(0, 16)
  formTanggalSelesai.value = new Date().toISOString().slice(0, 16)
  formColor.value = '#06b6d4'
  formCourseId.value = ''
  formKelas.value = ''
  formClassName.value = ''
  showModal.value = true
}

function openEditModal(ev: any) {
  editingEventId.value = ev.id
  formJudul.value = ev.judul
  formDeskripsi.value = ev.deskripsi || ''
  formTipe.value = ev.tipe
  formTanggalMulai.value = new Date(ev.tanggal_mulai).toISOString().slice(0, 16)
  formTanggalSelesai.value = new Date(ev.tanggal_selesai).toISOString().slice(0, 16)
  formColor.value = ev.color || typeColors[ev.tipe] || '#3b82f6'
  formCourseId.value = ev.course_id || ''
  formKelas.value = ev.kelas || ''
  formClassName.value = ev.class_name || ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingEventId.value = null
}

function onTipeChange(tipe: string) {
  const match = typeOptions.find(t => t.value === tipe)
  if (match) formColor.value = match.color
}

async function saveEvent() {
  if (!formJudul.value.trim()) return
  if (!formTanggalMulai.value || !formTanggalSelesai.value) return
  saving.value = true

  const data = {
    judul: formJudul.value.trim(),
    deskripsi: formDeskripsi.value.trim(),
    tipe: formTipe.value,
    tanggal_mulai: new Date(formTanggalMulai.value).toISOString(),
    tanggal_selesai: new Date(formTanggalSelesai.value).toISOString(),
    color: formColor.value,
    course_id: formCourseId.value || null,
    kelas: formKelas.value || null,
    class_name: formClassName.value || null,
  }

  if (editingEventId.value) {
    await calendarStore.updateEvent(editingEventId.value, data)
  } else {
    await calendarStore.addEvent(data)
  }

  saving.value = false
  closeModal()
}

async function confirmDeleteEvent(id: string) {
  deletingId.value = id
  if (confirm('Hapus event ini?')) {
    await calendarStore.deleteEvent(id)
  }
  deletingId.value = null
}
</script>

<template>
  <div class="calendar-page">
    <PageHeader title="Kalender Akademik" subtitle="Jadwal UTS, UAS, tugas, dan libur" />

    <!-- Quick info: Today's events -->
    <div v-if="todayEvents.length > 0" class="card today-card">
      <h3>📍 Hari Ini</h3>
      <div v-for="ev in todayEvents" :key="ev.id" class="today-event">
        <span class="event-dot" :style="{ background: typeColors[ev.tipe] || '#3b82f6' }" />
        <div class="today-event-info">
          <strong>{{ ev.judul }}</strong>
          <span v-if="ev.course_name" class="text-sm text-muted">{{ ev.course_name }}</span>
        </div>
        <span class="text-sm">{{ formatTime(ev.tanggal_mulai) }}</span>
      </div>
    </div>

    <!-- View toggle & navigation -->
    <div class="calendar-controls">
      <div class="view-toggle">
        <button
          class="btn btn-sm"
          :class="viewMode === 'list' ? 'btn-primary' : 'btn-ghost'"
          @click="viewMode = 'list'"
        >
          📋 Daftar
        </button>
        <button
          class="btn btn-sm"
          :class="viewMode === 'timeline' ? 'btn-primary' : 'btn-ghost'"
          @click="viewMode = 'timeline'"
        >
          📈 Timeline
        </button>
        <button
          class="btn btn-sm"
          :class="viewMode === 'month' ? 'btn-primary' : 'btn-ghost'"
          @click="viewMode = 'month'"
        >
          📅 Bulan
        </button>
      </div>

      <div v-if="viewMode === 'month'" class="month-nav">
        <button class="btn btn-ghost btn-sm" @click="prevMonth">←</button>
        <span class="month-label">{{ monthNames[currentMonth] }} {{ currentYear }}</span>
        <button class="btn btn-ghost btn-sm" @click="nextMonth">→</button>
      </div>

      <div v-if="isAdmin" class="admin-cal-actions">
        <button class="btn btn-primary btn-sm" @click="openAddModal">+ Tambah Event</button>
      </div>
    </div>

    <!-- Timeline View -->
    <div v-if="viewMode === 'timeline'" class="timeline-view">
      <!-- Time axis controls -->
      <div class="timeline-range">
        <div class="form-group">
          <label class="form-label">Dari</label>
          <input v-model="timelineStart" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Sampai</label>
          <input v-model="timelineEnd" type="date" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-secondary btn-sm" @click="resetTimelineRange()">Reset</button>
        </div>
      </div>

      <div v-if="timelineEvents.length === 0" class="card empty-state">
        <p>Tidak ada event dalam rentang ini.</p>
      </div>

      <div v-else class="timeline-container">
        <!-- Month markers -->
        <div class="timeline-months">
          <div
            v-for="(month, mi) in timelineMonths"
            :key="mi"
            class="timeline-month-marker"
            :style="{ left: month.left + '%', width: month.width + '%' }"
          >
            <span class="timeline-month-label">{{ month.name }} {{ month.year }}</span>
          </div>
        </div>

        <!-- Timeline bar -->
        <div class="timeline-bar">
          <div
            v-for="ev in timelineEvents"
            :key="ev.id"
            class="timeline-event"
            :style="{
              left: ev._left + '%',
              width: Math.max(ev._width, 1.5) + '%',
              background: typeColors[ev.tipe] || '#3b82f6',
            }"
            :title="ev.judul"
          >
            <span class="timeline-event-label">{{ ev.judul }}</span>
          </div>
        </div>

        <!-- Event cards below -->
        <div class="timeline-events-list">
          <div v-for="ev in timelineEvents" :key="ev.id" class="card event-card compact">
            <div class="event-date-badge small">
              <span class="event-date-day">{{ new Date(ev.tanggal_mulai).getDate() }}</span>
            </div>
            <div class="event-body">
              <div class="event-header">
                <span class="event-type-badge" :style="{ background: typeColors[ev.tipe] || '#3b82f6' }">
                  {{ typeLabels[ev.tipe] || ev.tipe }}
                </span>
                <h4>{{ ev.judul }}</h4>
              </div>
              <p v-if="ev.deskripsi" class="event-desc text-sm">{{ ev.deskripsi }}</p>
              <div class="event-meta">
                <span v-if="ev.course_name" class="text-sm text-muted">📖 {{ ev.course_name }}</span>
                <span v-if="ev.kelas || ev.class_name" class="text-sm text-muted">
                  🏫 {{ ev.kelas ? kelasLabel(ev.kelas) : '' }}{{ ev.kelas && ev.class_name ? ' - ' : '' }}{{ ev.class_name || '' }}
                </span>
                <span class="text-sm text-muted">📍 {{ formatDate(ev.tanggal_mulai) }}</span>
              </div>
            </div>
            <div v-if="isAdmin" class="admin-event-actions">
              <button class="btn btn-ghost btn-sm" title="Edit" @click="openEditModal(ev)">✏️</button>
              <button class="btn btn-ghost btn-sm" title="Hapus" @click="confirmDeleteEvent(ev.id)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="list-view">
      <!-- Upcoming -->
      <section class="event-section">
        <h2>🗓️ Mendatang</h2>
        <div v-if="upcomingEvents.length === 0" class="card empty-state">
          <p>Tidak ada event mendatang.</p>
        </div>
        <div v-else class="event-list">
          <div v-for="ev in upcomingEvents" :key="ev.id" class="card event-card">
            <div class="event-date-badge">
              <span class="event-date-day">{{ new Date(ev.tanggal_mulai).getDate() }}</span>
              <span class="event-date-month">{{ monthNames[new Date(ev.tanggal_mulai).getMonth()].slice(0, 3) }}</span>
            </div>
            <div class="event-body">
              <div class="event-header">
                <span class="event-type-badge" :style="{ background: typeColors[ev.tipe] || '#3b82f6' }">
                  {{ typeLabels[ev.tipe] || ev.tipe }}
                </span>
                <h3>{{ ev.judul }}</h3>
              </div>
              <p v-if="ev.deskripsi" class="event-desc">{{ ev.deskripsi }}</p>
              <div class="event-meta">
                <span v-if="ev.course_name" class="text-sm text-muted">
                  📖 {{ ev.course_name }}
                </span>
                <span v-if="ev.kelas || ev.class_name" class="text-sm text-muted">
                  🏫 {{ ev.kelas ? kelasLabel(ev.kelas) : '' }}{{ ev.kelas && ev.class_name ? ' - ' : '' }}{{ ev.class_name || '' }}
                </span>
                <span class="text-sm text-muted">
                  🕐 {{ formatDate(ev.tanggal_mulai) }} — {{ formatTime(ev.tanggal_mulai) }}
                </span>
              </div>
            </div>
            <div v-if="isAdmin" class="admin-event-actions">
              <button class="btn btn-ghost btn-sm" title="Edit" @click="openEditModal(ev)">✏️</button>
              <button class="btn btn-ghost btn-sm" title="Hapus" @click="confirmDeleteEvent(ev.id)">🗑️</button>
            </div>
          </div>
        </div>
      </section>

      <!-- All events -->
      <section class="event-section">
        <h2>📅 Semua Event</h2>
        <div v-if="allEvents.length === 0" class="card empty-state">
          <p>Belum ada event.</p>
        </div>
        <div v-else class="event-list">
          <div v-for="ev in allEvents" :key="ev.id" class="card event-card">
            <div class="event-date-badge">
              <span class="event-date-day">{{ new Date(ev.tanggal_mulai).getDate() }}</span>
              <span class="event-date-month">{{ monthNames[new Date(ev.tanggal_mulai).getMonth()].slice(0, 3) }}</span>
            </div>
            <div class="event-body">
              <div class="event-header">
                <span class="event-type-badge" :style="{ background: typeColors[ev.tipe] || '#3b82f6' }">
                  {{ typeLabels[ev.tipe] || ev.tipe }}
                </span>
                <h3>{{ ev.judul }}</h3>
              </div>
              <p v-if="ev.deskripsi" class="event-desc">{{ ev.deskripsi }}</p>
              <div class="event-meta">
                <span v-if="ev.course_name" class="text-sm text-muted">
                  📖 {{ ev.course_name }}
                </span>
                <span v-if="ev.kelas || ev.class_name" class="text-sm text-muted">
                  🏫 {{ ev.kelas ? kelasLabel(ev.kelas) : '' }}{{ ev.kelas && ev.class_name ? ' - ' : '' }}{{ ev.class_name || '' }}
                </span>
                <span class="text-sm text-muted">
                  🕐 {{ formatDate(ev.tanggal_mulai) }}
                </span>
              </div>
            </div>
            <div v-if="isAdmin" class="admin-event-actions">
              <button class="btn btn-ghost btn-sm" title="Edit" @click="openEditModal(ev)">✏️</button>
              <button class="btn btn-ghost btn-sm" title="Hapus" @click="confirmDeleteEvent(ev.id)">🗑️</button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Month View -->
    <div v-if="viewMode === 'month'" class="month-view">
      <div class="month-grid">
        <div class="weekday-header">
          <span v-for="day in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']" :key="day" class="weekday-label">
            {{ day }}
          </span>
        </div>

        <div class="days-grid">
          <template v-for="day in 42" :key="day">
            <div
              v-if="(day - 1) >= new Date(currentYear, currentMonth, 1).getDay() &&
                    day - new Date(currentYear, currentMonth, 1).getDay() <= new Date(currentYear, currentMonth + 1, 0).getDate()"
              class="day-cell"
              :class="{
                today: day - new Date(currentYear, currentMonth, 1).getDay() === new Date().getDate() &&
                       currentMonth === new Date().getMonth() &&
                       currentYear === new Date().getFullYear()
              }"
            >
              <span class="day-number">
                {{ day - new Date(currentYear, currentMonth, 1).getDay() }}
              </span>
              <div class="day-events">
                <div
                  v-for="ev in monthEvents.filter(e => {
                    const d = new Date(e.tanggal_mulai)
                    return d.getDate() === (day - new Date(currentYear, currentMonth, 1).getDay())
                  })"
                  :key="ev.id"
                  class="day-event-dot"
                  :style="{ background: typeColors[ev.tipe] || '#3b82f6' }"
                  :title="ev.judul"
                />
              </div>
            </div>
            <div v-else class="day-cell empty-day" />
          </template>
        </div>
      </div>

      <!-- Event legend -->
      <div class="event-legend">
        <span v-for="(label, key) in typeLabels" :key="key" class="legend-item">
          <span class="legend-dot" :style="{ background: typeColors[key] }" />
          {{ label }}
        </span>
      </div>

      <!-- Events for this month -->
      <div class="month-events-list">
        <h3>Event {{ monthNames[currentMonth] }} {{ currentYear }}</h3>
        <div v-if="monthEvents.length === 0" class="card empty-state">
          <p>Tidak ada event bulan ini.</p>
        </div>
        <div v-for="ev in monthEvents" :key="ev.id" class="card event-card compact">
          <div class="event-date-badge small">
            <span class="event-date-day">{{ new Date(ev.tanggal_mulai).getDate() }}</span>
          </div>
          <div class="event-body">
            <div class="event-header">
              <span class="event-type-badge" :style="{ background: typeColors[ev.tipe] || '#3b82f6' }">
                {{ typeLabels[ev.tipe] || ev.tipe }}
              </span>
              <h4>{{ ev.judul }}</h4>
            </div>
            <div class="event-meta">
              <span v-if="ev.course_name" class="text-sm text-muted">{{ ev.course_name }}</span>
              <span v-if="ev.kelas || ev.class_name" class="text-sm text-muted">
                🏫 {{ ev.kelas ? kelasLabel(ev.kelas) : '' }}{{ ev.kelas && ev.class_name ? ' - ' : '' }}{{ ev.class_name || '' }}
              </span>
              <span class="text-sm text-muted">{{ formatTime(ev.tanggal_mulai) }}</span>
            </div>
          </div>
          <div v-if="isAdmin" class="admin-event-actions">
            <button class="btn btn-ghost btn-sm" title="Edit" @click="openEditModal(ev)">✏️</button>
            <button class="btn btn-ghost btn-sm" title="Hapus" @click="confirmDeleteEvent(ev.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Admin: Add/Edit Event Modal -->
    <Teleport to="body">
      <div v-if="showModal && isAdmin" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>{{ editingEventId ? 'Edit Event' : 'Tambah Event Baru' }}</h2>
            <button class="btn btn-ghost btn-sm" @click="closeModal">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Judul Event *</label>
              <input v-model="formJudul" type="text" class="form-input" placeholder="Nama event..." />
            </div>
            <div class="form-group">
              <label class="form-label">Deskripsi</label>
              <textarea v-model="formDeskripsi" class="form-textarea" rows="2" placeholder="Deskripsi event..." />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tipe *</label>
                <select v-model="formTipe" class="form-input" @change="onTipeChange(formTipe)">
                  <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Warna</label>
                <input v-model="formColor" type="color" class="form-input form-color" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Mata Kuliah (opsional)</label>
              <select v-model="formCourseId" class="form-input">
                <option v-for="opt in courseOptions" :key="opt.id" :value="opt.id">{{ opt.nama }}</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Kategori Kelas</label>
                <select v-model="formKelas" class="form-input">
                  <option v-for="opt in kelasOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Nama Kelas</label>
                <input v-model="formClassName" type="text" class="form-input" placeholder="Contoh: TI-1A, 5A, ..." />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Mulai *</label>
                <input v-model="formTanggalMulai" type="datetime-local" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Selesai *</label>
                <input v-model="formTanggalSelesai" type="datetime-local" class="form-input" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost btn-sm" @click="closeModal">Batal</button>
            <button class="btn btn-primary btn-sm" :disabled="saving || !formJudul.trim() || !formTanggalMulai || !formTanggalSelesai" @click="saveEvent">
              {{ saving ? 'Menyimpan...' : (editingEventId ? 'Perbarui' : 'Simpan') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.calendar-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
}

/* Today card */
.today-card {
  padding: 1rem;
  margin-bottom: 1.25rem;
  background: #fffbeb;
  border-color: #fcd34d;
}

.today-card h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.today-event {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0;
}

.today-event-info {
  flex: 1;
}

.today-event-info strong {
  display: block;
  font-size: 0.9rem;
}

.event-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Controls */
.calendar-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  gap: 0.35rem;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.month-label {
  font-weight: 600;
  min-width: 140px;
  text-align: center;
}

/* Event sections */
.event-section {
  margin-bottom: 2rem;
}

.event-section h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.event-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.event-card.compact {
  padding: 0.75rem;
}

.event-date-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 55px;
  min-height: 55px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 8px;
  flex-shrink: 0;
}

.event-date-badge.small {
  min-width: 40px;
  min-height: 40px;
}

.event-date-day {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
}

.event-date-month {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.event-body {
  flex: 1;
  min-width: 0;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.event-header h3,
.event-header h4 {
  margin: 0;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-type-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  color: #fff;
  flex-shrink: 0;
}

.event-desc {
  font-size: 0.85rem;
  color: var(--color-muted);
  margin-bottom: 0.35rem;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* Month grid */
.month-grid {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--color-bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--color-border);
}

.weekday-label {
  padding: 0.5rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.day-cell {
  min-height: 80px;
  padding: 0.35rem;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.day-cell:nth-child(7n) {
  border-right: none;
}

.day-cell.today {
  background: #eff6ff;
}

.day-cell.today .day-number {
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-number {
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  display: inline-block;
}

.day-events {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.day-event-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  cursor: pointer;
}

.empty-day {
  background: #f9fafb;
}

/* Legend */
.event-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.75rem 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Month events list */
.month-events-list {
  margin-top: 1.25rem;
}

.month-events-list h3 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-muted);
}

/* Timeline view */
.timeline-range {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.timeline-container {
  margin-top: 0.5rem;
}

.timeline-months {
  position: relative;
  height: 24px;
  margin-bottom: 2px;
}

.timeline-month-marker {
  position: absolute;
  top: 0;
  height: 100%;
  border-left: 1px dashed var(--color-neutral-300);
  padding-left: 4px;
}

.timeline-month-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-neutral-500);
}

.timeline-bar {
  position: relative;
  height: 48px;
  background: var(--color-neutral-100);
  border-radius: 24px;
  overflow: visible;
  margin-bottom: 1rem;
}

.timeline-event {
  position: absolute;
  top: 6px;
  height: 36px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.15s;
  min-width: 12px;
}

.timeline-event:hover {
  opacity: 0.85;
}

.timeline-event-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-events-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Admin actions */
.admin-cal-actions {
  display: flex;
  gap: 0.5rem;
}

.admin-event-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
  justify-content: center;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.modal-header h2 {
  font-size: 1.05rem;
  margin: 0;
}

.modal-body {
  padding: 1.25rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-neutral-200);
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.form-row .form-group {
  flex: 1;
}

.form-color {
  height: 40px;
  padding: 4px;
  cursor: pointer;
}
</style>
