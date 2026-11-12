<script setup lang="ts">
/**
 * ImportExportPanel — shared by /instructor/import-export and /admin/import-export.
 *
 * Impor: CSV mahasiswa → pratinjau + validasi per baris → impor baris valid
 *        (opsional langsung di-enroll ke satu mata kuliah).
 * Ekspor: buku nilai (Excel/PDF), presensi (CSV/Excel), daftar mahasiswa (CSV/Excel).
 * Instruktur hanya melihat mata kuliah yang diampu; admin semua (filter kampus).
 */
import {
  buildStudentImportPreview,
  studentImportTemplateCsv,
  importErrorReportCsv,
  MAX_IMPORT_ROWS,
  type StudentImportPreview,
  type ImportRowStatus,
} from '~/utils/studentImport'
import {
  buildCsv,
  buildXlsx,
  buildPdf,
  downloadFile,
  gradebookTable,
  attendanceTable,
  rosterTable,
  safeFileName,
  CSV_MIME,
  XLSX_MIME,
  type ExportTable,
} from '~/utils/exportFiles'
import { campusOfCourse } from '~/stores/atRisk'
import { campusIdForUser } from '~/stores/campus'
import { useImportJobsStore } from '~/stores/importJobs'

const props = defineProps<{ mode: 'instructor' | 'admin' }>()

const auth = useAuthStore()
const coursesStore = useCoursesStore()
const campusStore = useCampusStore()
const gradebook = useGradebookStore()
const attendance = useAttendanceStore()
const ui = useUiStore()
const importJobs = useImportJobsStore()
const notification = useNotification()

const ready = ref(false)
onMounted(async () => {
  await Promise.all([gradebook.init(), campusStore.init()])
  await importJobs.loadHistory()
  if (props.mode === 'admin' && campusStore.currentCampusId) campusFilter.value = campusStore.currentCampusId
  ready.value = true
})

// ── Scope ──
const campusFilter = ref('')
const scopedCourses = computed(() => {
  let list = coursesStore.allCourses
  if (props.mode === 'instructor') list = list.filter((c) => c.instructor_id === auth.user?.id)
  if (props.mode === 'admin' && campusFilter.value) list = list.filter((c) => campusOfCourse(c) === campusFilter.value)
  return [...list].sort((a, b) => a.kode.localeCompare(b.kode))
})
const courseLabel = (id: string) => {
  const c = coursesStore.allCourses.find((x) => x.id === id)
  return c ? `${c.kode} — ${c.nama}` : id
}
function enrolledIn(courseId: string) {
  const c = coursesStore.allCourses.find((x) => x.id === courseId)
  if (!c) return []
  return auth.studentRoster
    .filter((s) => s.level === c.level && s.session_time === c.session_time)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

// ═════════════ Import ═════════════
const importCourseId = ref('')
const fileName = ref('')
const csvText = ref('')
const onlyProblems = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const lastOutcome = ref<string | null>(null)

const importCourse = computed(() => {
  const c = coursesStore.allCourses.find((x) => x.id === importCourseId.value)
  return c ? { id: c.id, kode: c.kode, level: c.level, session_time: c.session_time, label: `${c.kode} — ${c.nama}` } : null
})

const preview = computed<StudentImportPreview | null>(() => {
  if (!csvText.value) return null
  return buildStudentImportPreview(csvText.value, auth.studentRoster, importCourse.value)
})

const previewRows = computed(() =>
  (preview.value?.rows ?? []).filter((r) => !onlyProblems.value || r.status !== 'valid' || r.warnings.length > 0),
)

function statusBadge(s: ImportRowStatus) {
  return s === 'valid' ? 'badge-success' : s === 'duplicate' ? 'badge-warning' : 'badge-danger'
}
const STATUS_LABEL: Record<ImportRowStatus, string> = { valid: 'Valid', invalid: 'Tidak valid', duplicate: 'Duplikat' }

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  lastOutcome.value = null
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    notification.error('File terlalu besar (maks. 2 MB).')
    return
  }
  fileName.value = file.name
  csvText.value = await file.text()
}

function clearImport() {
  csvText.value = ''
  fileName.value = ''
  lastOutcome.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function downloadTemplate() {
  downloadFile(studentImportTemplateCsv(), 'template-impor-mahasiswa.csv', CSV_MIME)
}

function downloadErrorReport() {
  if (!preview.value) return
  downloadFile(importErrorReportCsv(preview.value.rows), `laporan-error-${safeFileName(fileName.value || 'impor')}.csv`, CSV_MIME)
}

async function runImport() {
  if (!preview.value) return
  const valid = preview.value.rows.filter((r) => r.status === 'valid' && r.data).map((r) => r.data!)
  if (valid.length === 0) return
  const res = await importJobs.importStudents(valid, { fileName: fileName.value || 'impor.csv', course: importCourse.value })
  if (!res.ok) {
    notification.error(res.message || 'Impor gagal.')
    lastOutcome.value = `Impor gagal: ${res.message}`
    return
  }
  const enrolled = importCourse.value ? ` dan di-enroll ke ${importCourse.value.kode}` : ''
  lastOutcome.value = `${res.created} mahasiswa ditambahkan${enrolled}.` + (res.failed.length ? ` ${res.failed.length} gagal: ${res.failed.map((f) => `${f.npm} (${f.error})`).join(', ')}` : '')
  notification.success(`${res.created} mahasiswa berhasil diimpor.`)
  // Re-validate: imported rows now show as duplicates, preventing a double import.
  const keep = csvText.value
  csvText.value = ''
  await nextTick()
  csvText.value = keep
}

// ═════════════ Export ═════════════
const exportCourseId = ref('')
const rosterScope = ref<'course' | 'all'>('course')
const exporting = ref<string | null>(null)

watch(scopedCourses, (list) => {
  if (!list.some((c) => c.id === exportCourseId.value)) exportCourseId.value = list[0]?.id ?? ''
  if (importCourseId.value && !list.some((c) => c.id === importCourseId.value)) importCourseId.value = ''
}, { immediate: true })

const exportCourse = computed(() => coursesStore.allCourses.find((c) => c.id === exportCourseId.value) || null)
const stamp = () => new Date().toISOString().slice(0, 10)

function gradeTable(): ExportTable | null {
  const c = exportCourse.value
  if (!c) return null
  // Same rows as the gradebook page (Tugas = peer-blended), plus per-assignment peer detail.
  return gradebookTable(gradebook.courseGradebook(c.id), gradebook.weightsFor(c.id), `Nilai ${c.kode}`, gradebook.coursePeerBreakdown(c.id))
}

function presensiTable(): ExportTable | null {
  const c = exportCourse.value
  if (!c) return null
  const recs = (attendance.isDemoMode ? attendance.records : attendance.sbRecords).filter((r) => r.course_id === c.id)
  return attendanceTable(enrolledIn(c.id), recs, `Presensi ${c.kode}`)
}

function campusNameOfStudent(s: { id: string; campusId?: string | null }) {
  const id = s.campusId ?? campusIdForUser(s.id)
  return campusStore.allCampuses.find((x) => x.id === id)?.nama ?? ''
}

function studentsTable(): ExportTable | null {
  if (props.mode === 'admin' && rosterScope.value === 'all') {
    let list = [...auth.studentRoster]
    if (campusFilter.value) list = list.filter((s) => (s.campusId ?? campusIdForUser(s.id)) === campusFilter.value)
    list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
    return rosterTable(list.map((s) => ({ ...s, kampus: campusNameOfStudent(s) })), 'Mahasiswa', true)
  }
  const c = exportCourse.value
  if (!c) return null
  return rosterTable(enrolledIn(c.id).map((s) => ({ ...s, kampus: campusNameOfStudent(s) })), `Mahasiswa ${c.kode}`, props.mode === 'admin')
}

async function doExport(kind: 'nilai' | 'presensi' | 'mahasiswa', format: 'csv' | 'xlsx' | 'pdf') {
  const table = kind === 'nilai' ? gradeTable() : kind === 'presensi' ? presensiTable() : studentsTable()
  if (!table) return notification.warning('Pilih mata kuliah terlebih dahulu.')
  if (table.rows.length === 0) return notification.warning('Tidak ada data untuk diekspor.')

  const scope = kind === 'mahasiswa' && props.mode === 'admin' && rosterScope.value === 'all'
    ? (campusFilter.value ? campusStore.allCampuses.find((x) => x.id === campusFilter.value)?.kode ?? 'kampus' : 'semua')
    : exportCourse.value?.kode ?? ''
  const base = safeFileName(`${kind}-${scope}-${stamp()}`)
  exporting.value = `${kind}-${format}`
  try {
    if (format === 'csv') downloadFile(buildCsv(table), `${base}.csv`, CSV_MIME)
    else if (format === 'xlsx') downloadFile(buildXlsx([table]), `${base}.xlsx`, XLSX_MIME)
    else {
      const c = exportCourse.value!
      const w = gradebook.weightsFor(c.id)
      const hasPeer = gradebook.coursePeerBreakdown(c.id).assignments.length > 0
      const bytes = await buildPdf(table, {
        title: `Buku Nilai - ${c.kode} ${c.nama}`,
        subtitle: `Diekspor ${new Date().toLocaleString('id-ID')} oleh ${auth.user?.nama ?? '-'}`,
        orientation: 'landscape',
        footnote: `Bobot: Tugas ${w.tugas}%, Kuis ${w.kuis}%, Presensi ${w.presensi}%, UTS ${w.uts}%, UAS ${w.uas}%. Status "Sementara": masih ada komponen tanpa data. Huruf: A >= 85, B >= 70, C >= 60, D >= 50, E < 50.`
          + (hasPeer ? ' Tugas dengan peer review: Nilai Akhir Tugas = round(Nilai Dosen x (100 - Bobot Peer)/100 + Nilai Peer x Bobot Peer/100); tanpa review yang dihitung = Nilai Dosen. Komponen Tugas memakai nilai akhir tugas ini.' : ''),
      })
      downloadFile(bytes, `${base}.pdf`, 'application/pdf')
    }
    notification.success(`Ekspor ${table.rows.length} baris (${format.toUpperCase()}) selesai.`)
  } catch (err) {
    console.error('Export failed:', err)
    notification.error('Gagal membuat file ekspor.')
  } finally {
    exporting.value = null
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div class="ie-page">
    <div class="page-head">
      <div>
        <h1>Impor / Ekspor</h1>
        <p class="muted">
          Impor mahasiswa dari CSV, ekspor nilai, presensi, dan daftar mahasiswa.
          <span class="badge" :class="ui.isDemoMode ? 'badge-neutral' : 'badge-primary'">{{ ui.isDemoMode ? 'Mode demo (data lokal)' : 'Supabase' }}</span>
        </p>
      </div>
      <div v-if="mode === 'admin'" class="form-group campus-select">
        <label class="form-label" for="ie-campus">Kampus</label>
        <select id="ie-campus" v-model="campusFilter" class="form-input">
          <option value="">Semua kampus</option>
          <option v-for="c in campusStore.allCampuses" :key="c.id" :value="c.id">{{ c.nama }}</option>
        </select>
      </div>
    </div>

    <p v-if="!ready" class="muted">Memuat...</p>

    <template v-else>
      <!-- ═══ Import ═══ -->
      <section class="card section" aria-labelledby="ie-import-title">
        <div class="section-head">
          <h2 id="ie-import-title">📥 Impor mahasiswa (CSV)</h2>
          <button type="button" class="btn btn-ghost btn-sm" @click="downloadTemplate">⬇️ Unduh template</button>
        </div>
        <p class="muted small">
          Kolom: <code>nama</code>*, <code>npm</code>*, <code>kelas</code>, <code>level</code> (1–5), <code>sesi</code> (pagi/sore), <code>email</code>.
          Pemisah koma atau titik koma, UTF-8. Maks. {{ MAX_IMPORT_ROWS }} baris. Bila mata kuliah tujuan dipilih,
          level &amp; sesi mengikuti mata kuliah (mahasiswa otomatis terdaftar).
        </p>

        <div class="import-controls">
          <div class="form-group">
            <label class="form-label" for="ie-import-course">Enroll ke mata kuliah (opsional)</label>
            <select id="ie-import-course" v-model="importCourseId" class="form-input">
              <option value="">— Tidak, hanya tambah ke daftar mahasiswa —</option>
              <option v-for="c in scopedCourses" :key="c.id" :value="c.id">{{ c.kode }} — {{ c.nama }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="ie-file">File CSV</label>
            <input id="ie-file" ref="fileInput" class="form-input" type="file" accept=".csv,text/csv" @change="onFile" />
          </div>
        </div>

        <template v-if="preview">
          <ul v-if="preview.fileErrors.length" class="file-errors" role="alert">
            <li v-for="(e, i) in preview.fileErrors" :key="i">{{ e }}</li>
          </ul>

          <div v-if="preview.rows.length" class="preview-head">
            <div class="chips">
              <span class="chip">{{ fileName }}</span>
              <span class="badge badge-success">{{ preview.summary.valid }} valid</span>
              <span class="badge badge-danger">{{ preview.summary.invalid }} tidak valid</span>
              <span class="badge badge-warning">{{ preview.summary.duplicate }} duplikat</span>
            </div>
            <label class="check"><input v-model="onlyProblems" type="checkbox" /> Hanya baris bermasalah</label>
          </div>

          <div v-if="previewRows.length" class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col" class="num">Baris</th>
                  <th scope="col">Status</th>
                  <th scope="col">Nama</th>
                  <th scope="col">NPM</th>
                  <th scope="col">Kelas</th>
                  <th scope="col">Level</th>
                  <th scope="col">Sesi</th>
                  <th scope="col">Email</th>
                  <th scope="col">Masalah / catatan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in previewRows" :key="r.line" :class="`row-${r.status}`">
                  <td class="num">{{ r.line }}</td>
                  <td><span class="badge" :class="statusBadge(r.status)">{{ STATUS_LABEL[r.status] }}</span></td>
                  <td>{{ r.data?.nama ?? r.raw.nama }}</td>
                  <td>{{ r.raw.npm }}</td>
                  <td>{{ r.data?.kelas ?? r.raw.kelas }}</td>
                  <td>{{ r.data?.level ?? r.raw.level }}</td>
                  <td>{{ r.data ? (r.data.session_time === 'morning' ? 'pagi' : 'sore') : r.raw.sesi }}</td>
                  <td>{{ r.data?.email ?? r.raw.email }}</td>
                  <td class="problems">
                    <span v-for="(e, i) in r.errors" :key="`e${i}`" class="problem err">{{ e }}</span>
                    <span v-for="(w, i) in r.warnings" :key="`w${i}`" class="problem warn">{{ w }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="clearImport">Batal</button>
            <button
              v-if="preview.summary.invalid + preview.summary.duplicate > 0"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="downloadErrorReport"
            >
              ⬇️ Laporan error (CSV)
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="importJobs.running || preview.summary.valid === 0"
              @click="runImport"
            >
              {{ importJobs.running ? 'Mengimpor...' : `Impor ${preview.summary.valid} mahasiswa valid` }}
            </button>
          </div>
        </template>

        <p v-if="lastOutcome" class="outcome" role="status">{{ lastOutcome }}</p>

        <details v-if="importJobs.jobs.length" class="history">
          <summary>Riwayat impor ({{ importJobs.jobs.length }})</summary>
          <ul>
            <li v-for="j in importJobs.jobs" :key="j.id">
              <strong>{{ j.file_name }}</strong>
              <span class="muted small">
                · {{ fmtDate(j.created_at) }} · {{ j.created }}/{{ j.total }} berhasil{{ j.failed ? `, ${j.failed} gagal` : '' }}
                {{ j.course_label || (j.course_id ? courseLabel(j.course_id) : '') }}
              </span>
            </li>
          </ul>
        </details>
      </section>

      <!-- ═══ Export ═══ -->
      <section class="card section" aria-labelledby="ie-export-title">
        <div class="section-head">
          <h2 id="ie-export-title">📤 Ekspor</h2>
        </div>
        <div class="form-group export-course">
          <label class="form-label" for="ie-export-course">Mata kuliah</label>
          <select id="ie-export-course" v-model="exportCourseId" class="form-input">
            <option v-if="scopedCourses.length === 0" value="">Tidak ada mata kuliah</option>
            <option v-for="c in scopedCourses" :key="c.id" :value="c.id">{{ c.kode }} — {{ c.nama }}</option>
          </select>
        </div>

        <div class="export-grid">
          <div class="export-card">
            <h3>Buku nilai</h3>
            <p class="muted small">Komponen berbobot, nilai akhir, huruf, status (gradebook). Tugas dengan peer review: kolom nilai dosen, nilai peer, bobot peer, dan nilai akhir gabungan.</p>
            <div class="btn-row">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="!exportCourse || !!exporting" @click="doExport('nilai', 'xlsx')">Excel (.xlsx)</button>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="!exportCourse || !!exporting" @click="doExport('nilai', 'pdf')">{{ exporting === 'nilai-pdf' ? 'Membuat PDF...' : 'PDF' }}</button>
              <button type="button" class="btn btn-ghost btn-sm" :disabled="!exportCourse || !!exporting" @click="doExport('nilai', 'csv')">CSV</button>
            </div>
          </div>

          <div class="export-card">
            <h3>Presensi</h3>
            <p class="muted small">Matriks per pertemuan (H/I/S/A), total, dan persentase hadir.</p>
            <div class="btn-row">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="!exportCourse || !!exporting" @click="doExport('presensi', 'csv')">CSV</button>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="!exportCourse || !!exporting" @click="doExport('presensi', 'xlsx')">Excel (.xlsx)</button>
            </div>
          </div>

          <div class="export-card">
            <h3>Daftar mahasiswa</h3>
            <p class="muted small">NPM, nama, kelas, level, sesi{{ mode === 'admin' ? ', kampus' : '' }}.</p>
            <div v-if="mode === 'admin'" class="scope-radio" role="radiogroup" aria-label="Cakupan daftar mahasiswa">
              <label><input v-model="rosterScope" type="radio" value="course" /> Mata kuliah terpilih</label>
              <label><input v-model="rosterScope" type="radio" value="all" /> Semua mahasiswa{{ campusFilter ? ' (kampus terpilih)' : '' }}</label>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn-secondary btn-sm" :disabled="(!exportCourse && rosterScope === 'course') || !!exporting" @click="doExport('mahasiswa', 'csv')">CSV</button>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="(!exportCourse && rosterScope === 'course') || !!exporting" @click="doExport('mahasiswa', 'xlsx')">Excel (.xlsx)</button>
            </div>
          </div>
        </div>
        <p class="muted small note">
          CSV memakai UTF-8 dengan BOM agar nama ber-aksen terbaca di Excel; sel teks yang diawali =, +, -, @ diberi
          apostrof agar tidak dieksekusi sebagai rumus.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ie-page { max-width: 72rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.page-head h1 { margin: 0 0 0.25rem; }
.muted { color: var(--color-neutral-500); font-size: 0.875rem; margin: 0; }
.small { font-size: 0.8125rem; }
.campus-select { min-width: 12rem; margin: 0; }
.section { margin-bottom: 1rem; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.section-head h2 { margin: 0; font-size: 1.0625rem; }
code { font-family: var(--font-mono); font-size: 0.8125em; background: var(--color-neutral-100); padding: 0 0.25rem; border-radius: var(--radius-sm); }

.import-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.75rem; margin-top: 0.75rem; }
.import-controls .form-group { margin: 0; }

.file-errors {
  margin: 0.75rem 0; padding: 0.5rem 0.75rem 0.5rem 1.75rem; border-radius: var(--radius-md);
  background: var(--tint-danger-bg, var(--color-neutral-100)); color: var(--tint-danger-fg, var(--color-error)); font-size: 0.875rem;
}
.preview-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0.75rem 0 0.5rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; }
.chip { font-size: 0.8125rem; padding: 0.125rem 0.5rem; border-radius: 9999px; background: var(--color-neutral-100); color: var(--color-neutral-700); }
.check { display: inline-flex; gap: 0.375rem; align-items: center; font-size: 0.8125rem; color: var(--color-neutral-700); white-space: nowrap; }
.check input, .scope-radio input { width: auto; margin: 0; }

/* contain: the wide table must not widen the layout's flex column (scrolls instead). */
.table-wrap { contain: inline-size; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; max-height: 26rem; overflow-y: auto; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; min-width: 52rem; }
.data-table th, .data-table td { padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--color-neutral-200); text-align: left; vertical-align: top; }
.data-table thead th { position: sticky; top: 0; background: var(--color-surface); font-size: 0.75rem; color: var(--color-neutral-600); white-space: nowrap; }
.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.row-invalid > td { background: var(--tint-danger-bg, transparent); }
.row-duplicate > td { background: var(--tint-warning-bg, transparent); }
.problems { min-width: 16rem; }
.problem { display: block; }
.problem.err { color: var(--tint-danger-fg, var(--color-error)); }
.problem.warn { color: var(--color-neutral-500); }

.form-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
.outcome { margin: 0.75rem 0 0; font-size: 0.875rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); background: var(--tint-success-bg, var(--color-neutral-100)); color: var(--tint-success-fg, var(--color-neutral-800)); }
.history { margin-top: 0.75rem; font-size: 0.875rem; }
.history summary { cursor: pointer; color: var(--color-neutral-700); }
.history ul { margin: 0.5rem 0 0; padding-left: 1.125rem; display: flex; flex-direction: column; gap: 0.25rem; }

.export-course { max-width: 28rem; }
.export-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0.75rem; margin-top: 0.75rem; }
.export-card { border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.export-card h3 { margin: 0; font-size: 0.9375rem; }
.btn-row { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: auto; }
.scope-radio { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8125rem; color: var(--color-neutral-700); }
.note { margin-top: 0.75rem; }

@media (max-width: 640px) {
  .page-head { align-items: stretch; }
}
</style>
