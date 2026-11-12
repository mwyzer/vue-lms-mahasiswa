<script setup lang="ts">
/**
 * AtRiskDashboard — shared by /instructor/at-risk and /admin/at-risk.
 *
 * instructor: only the signed-in instructor's courses, filter per course.
 * admin     : every course, filter per campus and course.
 *
 * Table sorted by risk score (highest first). "Detail" shows every reason,
 * the factor breakdown and the intervention history, with the two actions:
 * "Kirim pengingat" (in-app notification to the student) and
 * "Tandai sudah ditindaklanjuti" (follow-up note).
 */
import { useAtRiskStore, campusOfCourse, type AtRiskRow } from '~/stores/atRisk'
import {
  RISK_FACTORS,
  RISK_FACTOR_LABELS,
  RISK_LEVEL_LABELS,
  DEFAULT_RISK_THRESHOLDS,
  validateRiskWeights,
  type RiskLevel,
  type RiskWeights,
} from '~/utils/riskScore'

const props = defineProps<{ mode: 'instructor' | 'admin' }>()

const route = useRoute()
const auth = useAuthStore()
const coursesStore = useCoursesStore()
const campusStore = useCampusStore()
const atRisk = useAtRiskStore()
const notification = useNotification()

const ready = ref(false)

onMounted(async () => {
  await Promise.all([atRisk.init(), campusStore.init()])
  resetWeightForm()
  if (props.mode === 'admin' && campusStore.currentCampusId) campusFilter.value = campusStore.currentCampusId
  const q = route.query.course
  if (typeof q === 'string' && scopedCourses.value.some((c) => c.id === q)) courseFilter.value = q
  ready.value = true
})

// ── Scope + filters ──
const campusFilter = ref<string>('')
const courseFilter = ref<string>('')
const levelFilter = ref<'' | RiskLevel>('')
const search = ref('')
const hideFollowedUp = ref(false)

const scopedCourses = computed(() => {
  let list = coursesStore.allCourses
  if (props.mode === 'instructor') list = list.filter((c) => c.instructor_id === auth.user?.id)
  if (props.mode === 'admin' && campusFilter.value) {
    list = list.filter((c) => campusOfCourse(c) === campusFilter.value)
  }
  return [...list].sort((a, b) => a.kode.localeCompare(b.kode))
})

watch(campusFilter, () => {
  if (courseFilter.value && !scopedCourses.value.some((c) => c.id === courseFilter.value)) courseFilter.value = ''
})

const allRows = computed<AtRiskRow[]>(() =>
  atRisk.rowsForCourses(courseFilter.value ? [courseFilter.value] : scopedCourses.value.map((c) => c.id)),
)

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return allRows.value.filter((r) => {
    if (levelFilter.value && r.risk.level !== levelFilter.value) return false
    if (hideFollowedUp.value && isFollowedUp(r)) return false
    if (q && !r.nama.toLowerCase().includes(q) && !r.npm.toLowerCase().includes(q)) return false
    return true
  })
})

const counts = computed(() => {
  const c: Record<RiskLevel, number> = { tinggi: 0, sedang: 0, rendah: 0 }
  for (const r of allRows.value) c[r.risk.level]++
  return c
})

const referenceDate = computed(() =>
  new Date(atRisk.referenceNow).toLocaleDateString('id-ID', { dateStyle: 'long' }),
)

function campusName(id: string | null) {
  if (!id) return '—'
  return campusStore.allCampuses.find((c) => c.id === id)?.nama ?? '—'
}

/** Followed up after the latest reminder (or without one). */
function isFollowedUp(r: AtRiskRow): boolean {
  if (!r.lastFollowUp) return false
  if (!r.lastReminder) return true
  return new Date(r.lastFollowUp.created_at) >= new Date(r.lastReminder.created_at)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function levelBadge(level: RiskLevel) {
  return level === 'tinggi' ? 'badge-danger' : level === 'sedang' ? 'badge-warning' : 'badge-success'
}

// ── Detail / actions ──
const openKey = ref<string | null>(null)
const reminderText = ref('')
const followUpText = ref('')
const busy = ref(false)

function defaultReminder(r: AtRiskRow) {
  const top = r.risk.reasons.slice(0, 2).map((x) => x.text.toLowerCase())
  const why = top.length ? ` Catatan kami: ${top.join('; ')}.` : ''
  return `Halo ${r.nama.split(' ')[0]}, saya ingin memastikan Anda tetap bisa mengikuti ${r.course_nama}.${why} Silakan cek tugas yang belum dikumpulkan dan hubungi saya bila butuh bantuan.`
}

function toggleDetail(r: AtRiskRow, focus?: 'reminder' | 'followup') {
  if (openKey.value === r.key && !focus) {
    openKey.value = null
    return
  }
  openKey.value = r.key
  reminderText.value = defaultReminder(r)
  followUpText.value = ''
  if (focus) {
    nextTick(() => {
      const el = document.getElementById(`${focus}-${r.key}`) as HTMLTextAreaElement | null
      el?.focus()
    })
  }
}

async function sendReminder(r: AtRiskRow) {
  busy.value = true
  const ok = await atRisk.sendReminder(r, reminderText.value)
  busy.value = false
  if (ok) notification.success(`Pengingat terkirim ke ${r.nama}.`)
  else notification.error(atRisk.error || 'Gagal mengirim pengingat.')
}

async function markFollowedUp(r: AtRiskRow) {
  busy.value = true
  const ok = await atRisk.markFollowedUp(r, followUpText.value)
  busy.value = false
  if (ok) {
    followUpText.value = ''
    notification.success(`${r.nama} ditandai sudah ditindaklanjuti.`)
  } else notification.error(atRisk.error || 'Gagal menyimpan tindak lanjut.')
}

// ── Weights ──
const showWeights = ref(false)
const weightForm = reactive<RiskWeights>({ attendance: 0, missing: 0, late: 0, trend: 0, lowScore: 0, inactivity: 0 })
const weightError = computed(() => validateRiskWeights(weightForm))

function resetWeightForm() {
  Object.assign(weightForm, atRisk.weights)
}

function saveWeights() {
  const err = atRisk.setWeights({ ...weightForm })
  if (err) return notification.error(err)
  notification.success('Bobot sinyal risiko disimpan (di browser ini).')
}

function restoreDefaultWeights() {
  atRisk.resetWeights()
  resetWeightForm()
  notification.info('Bobot dikembalikan ke bawaan.')
}

const T = DEFAULT_RISK_THRESHOLDS
</script>

<template>
  <div class="at-risk-page">
    <div class="page-head">
      <div>
        <h1>Mahasiswa Berisiko</h1>
        <p class="muted">
          {{ mode === 'admin' ? 'Lintas kampus dan mata kuliah.' : 'Mahasiswa di mata kuliah yang Anda ampu.' }}
          Skor 0–100 dari kehadiran, tugas, tren nilai, dan aktivitas.
        </p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" :aria-expanded="showWeights" @click="showWeights = !showWeights">
        ⚙️ Bobot sinyal
      </button>
    </div>

    <p v-if="!ready" class="muted">Memuat data risiko...</p>

    <template v-else>
      <p v-if="atRisk.isDemoMode" class="demo-note">
        Mode demo: data contoh berasal dari semester lalu, jadi tenggat dan inaktivitas dihitung terhadap
        aktivitas terakhir yang tercatat (<strong>{{ referenceDate }}</strong>).
      </p>
      <p v-if="atRisk.error && !atRisk.isDemoMode" class="error-note">{{ atRisk.error }}</p>

      <!-- Weights -->
      <section v-if="showWeights" class="card weights-card" aria-label="Bobot sinyal risiko">
        <form @submit.prevent="saveWeights">
          <div class="weight-grid">
            <div v-for="k in RISK_FACTORS" :key="k" class="form-group">
              <label class="form-label" :for="`rw-${k}`">{{ RISK_FACTOR_LABELS[k] }}</label>
              <input :id="`rw-${k}`" v-model.number="weightForm[k]" class="form-input" type="number" min="0" max="100" step="1" />
            </div>
          </div>
          <p class="muted small">
            Bobot relatif (tidak harus berjumlah 100); sinyal tanpa data dilewati dan bobot sisanya dinormalkan.
            Level: sedang ≥ {{ T.mediumAt }}, tinggi ≥ {{ T.highAt }}. Batas kehadiran {{ Math.round(T.minAttendance * 100) }}%,
            batas lulus {{ T.passScore }}, tidak aktif ≥ {{ T.inactiveDays }} hari.
          </p>
          <p v-if="weightError" class="error-note">{{ weightError }}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="restoreDefaultWeights">Kembalikan bawaan</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="!!weightError">Simpan bobot</button>
          </div>
        </form>
      </section>

      <!-- Summary -->
      <div class="summary">
        <button type="button" class="card summary-card" :class="{ active: levelFilter === 'tinggi' }" @click="levelFilter = levelFilter === 'tinggi' ? '' : 'tinggi'">
          <span class="summary-label">Risiko tinggi</span>
          <span class="summary-value lvl-tinggi">{{ counts.tinggi }}</span>
        </button>
        <button type="button" class="card summary-card" :class="{ active: levelFilter === 'sedang' }" @click="levelFilter = levelFilter === 'sedang' ? '' : 'sedang'">
          <span class="summary-label">Risiko sedang</span>
          <span class="summary-value lvl-sedang">{{ counts.sedang }}</span>
        </button>
        <button type="button" class="card summary-card" :class="{ active: levelFilter === 'rendah' }" @click="levelFilter = levelFilter === 'rendah' ? '' : 'rendah'">
          <span class="summary-label">Risiko rendah</span>
          <span class="summary-value lvl-rendah">{{ counts.rendah }}</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="card filters">
        <div v-if="mode === 'admin'" class="form-group">
          <label class="form-label" for="ar-campus">Kampus</label>
          <select id="ar-campus" v-model="campusFilter" class="form-input">
            <option value="">Semua kampus</option>
            <option v-for="c in campusStore.allCampuses" :key="c.id" :value="c.id">{{ c.nama }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ar-course">Mata kuliah</label>
          <select id="ar-course" v-model="courseFilter" class="form-input">
            <option value="">Semua mata kuliah ({{ scopedCourses.length }})</option>
            <option v-for="c in scopedCourses" :key="c.id" :value="c.id">{{ c.kode }} — {{ c.nama }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ar-level">Level</label>
          <select id="ar-level" v-model="levelFilter" class="form-input">
            <option value="">Semua level</option>
            <option value="tinggi">Tinggi</option>
            <option value="sedang">Sedang</option>
            <option value="rendah">Rendah</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ar-search">Cari</label>
          <input id="ar-search" v-model="search" class="form-input" type="search" placeholder="Nama atau NPM" />
        </div>
        <label class="check">
          <input v-model="hideFollowedUp" type="checkbox" />
          Sembunyikan yang sudah ditindaklanjuti
        </label>
      </div>

      <!-- Table -->
      <section class="card table-card">
        <p v-if="scopedCourses.length === 0" class="muted">
          {{ mode === 'instructor' ? 'Anda belum mengampu mata kuliah.' : 'Tidak ada mata kuliah untuk filter ini.' }}
        </p>
        <p v-else-if="rows.length === 0" class="muted">Tidak ada mahasiswa yang cocok dengan filter.</p>

        <div v-else class="table-wrap">
          <table class="risk-table">
            <thead>
              <tr>
                <th scope="col">Mahasiswa</th>
                <th scope="col">Mata kuliah</th>
                <th v-if="mode === 'admin'" scope="col">Kampus</th>
                <th scope="col" class="num">Skor</th>
                <th scope="col">Level</th>
                <th scope="col">Alasan utama</th>
                <th scope="col">Tindak lanjut</th>
                <th scope="col">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="r in rows" :key="r.key">
                <tr :class="{ open: openKey === r.key }">
                  <th scope="row" class="col-name">
                    <span class="student-name">{{ r.nama }}</span>
                    <span class="student-npm">{{ r.npm }} · {{ r.kelas }}</span>
                  </th>
                  <td><span class="course-kode">{{ r.course_kode }}</span> <span class="muted small">{{ r.course_nama }}</span></td>
                  <td v-if="mode === 'admin'">{{ campusName(r.campus_id) }}</td>
                  <td class="num">
                    <span class="score">
                      <span class="score-bar" aria-hidden="true"><span :class="`fill lvl-bg-${r.risk.level}`" :style="{ width: `${r.risk.score}%` }" /></span>
                      <strong>{{ r.risk.score }}</strong>
                    </span>
                  </td>
                  <td>
                    <span class="badge" :class="levelBadge(r.risk.level)">{{ RISK_LEVEL_LABELS[r.risk.level] }}</span>
                    <span v-if="r.risk.coverage < 0.5" class="thin" title="Kurang dari separuh bobot sinyal punya data">data terbatas</span>
                  </td>
                  <td class="reason-cell">
                    <span v-if="r.risk.reasons.length">{{ r.risk.reasons[0].text }}</span>
                    <span v-else class="muted small">Tidak ada sinyal risiko</span>
                    <span v-if="r.risk.reasons.length > 1" class="muted small"> +{{ r.risk.reasons.length - 1 }} lainnya</span>
                  </td>
                  <td class="small">
                    <span v-if="isFollowedUp(r)" class="badge badge-success">✓ Ditindaklanjuti</span>
                    <span v-else-if="r.lastReminder" class="badge badge-neutral">Pengingat {{ fmtDate(r.lastReminder.created_at) }}</span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="actions">
                    <button type="button" class="btn btn-ghost btn-xs" :aria-expanded="openKey === r.key" @click="toggleDetail(r)">
                      {{ openKey === r.key ? 'Tutup' : 'Detail' }}
                    </button>
                    <button type="button" class="btn btn-secondary btn-xs" @click="toggleDetail(r, 'reminder')">🔔 Kirim pengingat</button>
                    <button type="button" class="btn btn-ghost btn-xs" @click="toggleDetail(r, 'followup')">✓ Tandai</button>
                  </td>
                </tr>
                <tr v-if="openKey === r.key" class="detail-row">
                  <td :colspan="mode === 'admin' ? 8 : 7">
                    <div class="detail">
                      <div class="detail-col">
                        <h3>Alasan</h3>
                        <ul v-if="r.risk.reasons.length" class="reasons">
                          <li v-for="x in r.risk.reasons" :key="x.key" :class="`sev-${x.severity}`">
                            {{ x.text }} <span class="muted small">(+{{ x.contribution }})</span>
                          </li>
                        </ul>
                        <p v-else class="muted small">Tidak ada sinyal risiko.</p>

                        <h3>Rincian sinyal</h3>
                        <ul class="factors">
                          <li v-for="f in r.risk.factors" :key="f.key">
                            <span>{{ RISK_FACTOR_LABELS[f.key] }}</span>
                            <span class="muted small">
                              {{ f.value === null ? 'tidak ada data' : `${Math.round(f.value * 100)}% × bobot ${f.weight}` }}
                            </span>
                          </li>
                        </ul>
                        <p class="muted small">Cakupan data: {{ Math.round(r.risk.coverage * 100) }}% bobot.</p>
                      </div>

                      <div class="detail-col">
                        <form class="action-form" @submit.prevent="sendReminder(r)">
                          <label class="form-label" :for="`reminder-${r.key}`">Pesan pengingat untuk {{ r.nama }}</label>
                          <textarea :id="`reminder-${r.key}`" v-model="reminderText" class="form-input" rows="4" maxlength="1000" />
                          <button type="submit" class="btn btn-primary btn-sm" :disabled="busy || !reminderText.trim()">🔔 Kirim pengingat</button>
                        </form>

                        <form class="action-form" @submit.prevent="markFollowedUp(r)">
                          <label class="form-label" :for="`followup-${r.key}`">Catatan tindak lanjut (opsional)</label>
                          <textarea :id="`followup-${r.key}`" v-model="followUpText" class="form-input" rows="2" maxlength="2000" placeholder="mis. sudah konsultasi via WA, janji kumpulkan tugas Jumat" />
                          <button type="submit" class="btn btn-secondary btn-sm" :disabled="busy">✓ Tandai sudah ditindaklanjuti</button>
                        </form>

                        <h3>Riwayat intervensi</h3>
                        <ul v-if="atRisk.historyFor(r.course_id, r.student_id).length" class="history">
                          <li v-for="h in atRisk.historyFor(r.course_id, r.student_id)" :key="h.id">
                            <strong>{{ h.tipe === 'reminder' ? '🔔 Pengingat' : '✓ Tindak lanjut' }}</strong>
                            <span class="muted small"> · {{ fmtDate(h.created_at) }}{{ h.actor_name ? ` · ${h.actor_name}` : '' }}{{ h.risk_score !== null ? ` · skor ${h.risk_score}` : '' }}</span>
                            <p v-if="h.catatan" class="small">{{ h.catatan }}</p>
                          </li>
                        </ul>
                        <p v-else class="muted small">Belum ada intervensi.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.at-risk-page { max-width: 80rem; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.page-head h1 { margin: 0 0 0.25rem; }
.muted { color: var(--color-neutral-500); font-size: 0.875rem; margin: 0; }
.small { font-size: 0.8125rem; }
.demo-note, .error-note {
  font-size: 0.8125rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  margin: 0 0 1rem;
}
.demo-note { background: var(--tint-info-bg, var(--color-primary-50)); color: var(--tint-info-fg, var(--color-primary-800)); }
.error-note { background: var(--tint-danger-bg, var(--color-neutral-100)); color: var(--tint-danger-fg, var(--color-error)); }

.weights-card, .table-card, .filters { margin-bottom: 1rem; }
.weight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.75rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }

.summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.summary-card {
  display: flex; flex-direction: column; gap: 0.25rem; text-align: left; cursor: pointer;
  font: inherit; color: inherit; border: 1px solid var(--color-neutral-200);
}
.summary-card.active { outline: 2px solid var(--color-primary-500); }
.summary-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-neutral-500); }
.summary-value { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.lvl-tinggi { color: var(--color-error); }
.lvl-sedang { color: var(--color-warning); }
.lvl-rendah { color: var(--color-success); }

.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
.filters .form-group { flex: 1 1 10rem; margin: 0; }
.check { flex: 0 1 auto; display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--color-neutral-700); padding-bottom: 0.625rem; white-space: nowrap; }
.check input { width: auto; margin: 0; }

/* contain: the wide table must not widen the layout's flex column (scrolls instead). */
.table-wrap { contain: inline-size; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.risk-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; min-width: 56rem; }
.risk-table th, .risk-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid var(--color-neutral-200); vertical-align: top; text-align: left; }
.risk-table thead th { font-size: 0.75rem; font-weight: 600; color: var(--color-neutral-600); white-space: nowrap; }
.risk-table .num { text-align: right; white-space: nowrap; }
.risk-table tr.open > * { background: var(--color-neutral-50); }
.col-name { font-weight: 400; min-width: 10rem; }
.student-name { display: block; font-weight: 600; color: var(--color-neutral-900); }
.student-npm { font-size: 0.75rem; color: var(--color-neutral-500); }
.course-kode { font-weight: 600; white-space: nowrap; }
.reason-cell { min-width: 14rem; max-width: 22rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.25rem; min-width: 12rem; }

.score { display: inline-flex; align-items: center; gap: 0.5rem; }
.score-bar { width: 3.5rem; height: 0.375rem; border-radius: 9999px; background: var(--color-neutral-200); overflow: hidden; }
.score-bar .fill { display: block; height: 100%; }
.lvl-bg-tinggi { background: var(--color-error); }
.lvl-bg-sedang { background: var(--color-warning); }
.lvl-bg-rendah { background: var(--color-success); }
.thin { display: block; font-size: 0.6875rem; color: var(--color-neutral-500); margin-top: 0.125rem; }

.detail-row > td { background: var(--color-neutral-50); }
.detail { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1.25rem; padding: 0.5rem 0; }
.detail h3 { font-size: 0.875rem; margin: 0.5rem 0 0.375rem; }
.reasons, .factors, .history { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.375rem; }
.reasons li { padding-left: 0.625rem; border-left: 3px solid var(--color-warning); }
.reasons li.sev-danger { border-left-color: var(--color-error); }
.factors li { display: flex; justify-content: space-between; gap: 0.75rem; }
.history li { padding: 0.375rem 0; border-bottom: 1px dashed var(--color-neutral-200); }
.history p { margin: 0.25rem 0 0; white-space: pre-wrap; }
.action-form { display: flex; flex-direction: column; gap: 0.375rem; align-items: flex-start; margin-bottom: 0.75rem; }
.action-form textarea { width: 100%; resize: vertical; }

@media (max-width: 640px) {
  .page-head { flex-direction: column; }
  .summary { gap: 0.5rem; }
  .summary-card { padding: 0.625rem 0.75rem; }
  .summary-value { font-size: 1.25rem; }
}
</style>
