<script setup lang="ts">
/**
 * Gradebook (Instructor) — weighted final grades for a course.
 *
 * - Set the weight of each component (Tugas, Kuis, Presensi, UTS, UAS; total 100%)
 * - Enter UTS/UAS scores per student
 * - See each student's component scores, final score and letter grade
 * - Export the table to Excel
 */
import {
  useGradebookStore,
  GRADE_COMPONENTS,
  COMPONENT_LABELS,
  weightsTotal,
  validateWeights,
  type GradeComponent,
  type WeightSet,
} from '~/stores/gradebook'

definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor'],
})

const route = useRoute()
const coursesStore = useCoursesStore()
const gradebook = useGradebookStore()
const notification = useNotification()
const { exportSheet } = useExportGrades()

const courseId = computed(() => route.params.id as string)
const ready = ref(false)

onMounted(async () => {
  await gradebook.init()
  coursesStore.setCurrentCourse(courseId.value)
  resetWeightForm()
  ready.value = true
})

const course = computed(() => coursesStore.allCourses.find((c) => c.id === courseId.value) || null)
const rows = computed(() => gradebook.courseGradebook(courseId.value))
const weights = computed(() => gradebook.weightsFor(courseId.value))

// ── Summary ──
const gradedRows = computed(() => rows.value.filter((r) => r.final !== null))
const classAverage = computed(() => {
  if (gradedRows.value.length === 0) return null
  const sum = gradedRows.value.reduce((acc, r) => acc + (r.final as number), 0)
  return Math.round((sum / gradedRows.value.length) * 10) / 10
})
const anyProvisional = computed(() => rows.value.some((r) => r.isProvisional))
const letterCounts = computed(() => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  for (const r of rows.value) if (r.letter) counts[r.letter]++
  return counts
})

// ── Weights form ──
const editingWeights = ref(false)
const weightForm = reactive<WeightSet>({ tugas: 0, kuis: 0, presensi: 0, uts: 0, uas: 0 })
const savingWeights = ref(false)

const weightTotal = computed(() => weightsTotal(weightForm))
const weightError = computed(() => validateWeights(weightForm))

function resetWeightForm() {
  Object.assign(weightForm, weights.value)
}

function startEditWeights() {
  resetWeightForm()
  editingWeights.value = true
}

async function saveWeights() {
  savingWeights.value = true
  const ok = await gradebook.saveWeights(courseId.value, { ...weightForm })
  savingWeights.value = false
  if (!ok) {
    notification.error(gradebook.error || 'Gagal menyimpan bobot nilai.')
    return
  }
  editingWeights.value = false
  notification.success('Bobot nilai disimpan.')
}

// ── Exam scores ──
async function onExamInput(studentId: string, tipe: 'uts' | 'uas', event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.value.trim()
  const nilai = raw === '' ? null : Number(raw)

  const ok = await gradebook.setExamScore(courseId.value, studentId, tipe, nilai)
  if (!ok) {
    notification.error(gradebook.error || 'Gagal menyimpan nilai ujian.')
    // Restore the last saved value.
    const row = rows.value.find((r) => r.student_id === studentId)
    input.value = row?.[tipe] != null ? String(row[tipe]) : ''
  }
}

// ── Display helpers ──
function show(v: number | null): string {
  return v === null ? '–' : String(v)
}

function letterClass(letter: string | null): string {
  if (letter === 'A' || letter === 'B') return 'badge-success'
  if (letter === 'C') return 'badge-warning'
  if (letter === 'D' || letter === 'E') return 'badge-danger'
  return 'badge-neutral'
}

function exportExcel() {
  if (!course.value) return
  const w = weights.value
  const header = (k: GradeComponent) => `${COMPONENT_LABELS[k]} (${w[k]}%)`
  const data = rows.value.map((r, i) => ({
    'No': i + 1,
    'NPM': r.npm,
    'Nama Mahasiswa': r.nama,
    [header('tugas')]: r.tugas ?? '-',
    [header('kuis')]: r.kuis ?? '-',
    [header('presensi')]: r.presensi ?? '-',
    [header('uts')]: r.uts ?? '-',
    [header('uas')]: r.uas ?? '-',
    'Nilai Akhir': r.final ?? '-',
    'Huruf': r.letter ?? '-',
    'Status': r.final === null ? 'Belum ada nilai' : r.isProvisional ? 'Sementara' : 'Final',
  }))
  exportSheet(data, `Buku-Nilai-${course.value.kode}`, course.value.kode)
}
</script>

<template>
  <div class="gradebook-page">
    <NuxtLink :to="`/instructor/courses/${courseId}`" class="btn btn-ghost btn-sm back-link">
      ← Kembali ke Mata Kuliah
    </NuxtLink>

    <p v-if="!ready" class="muted">Memuat buku nilai...</p>

    <div v-else-if="!course" class="card empty">
      <p>Mata kuliah tidak ditemukan.</p>
      <NuxtLink to="/instructor/courses" class="btn btn-primary btn-sm">Kembali ke Daftar</NuxtLink>
    </div>

    <template v-else>
      <div class="page-head">
        <div>
          <h1>Buku Nilai</h1>
          <p class="muted">{{ course.kode }} — {{ course.nama }}</p>
        </div>
        <button class="btn btn-secondary btn-sm" :disabled="rows.length === 0" @click="exportExcel">
          ⬇️ Ekspor Excel
        </button>
      </div>

      <!-- Summary -->
      <div class="summary">
        <div class="card summary-card">
          <span class="summary-label">Mahasiswa</span>
          <span class="summary-value">{{ rows.length }}</span>
        </div>
        <div class="card summary-card">
          <span class="summary-label">Rata-rata Kelas</span>
          <span class="summary-value">{{ classAverage ?? '–' }}</span>
        </div>
        <div class="card summary-card">
          <span class="summary-label">Sebaran Huruf</span>
          <span class="summary-letters">
            <span v-for="(n, l) in letterCounts" :key="l">{{ l }}: <strong>{{ n }}</strong></span>
          </span>
        </div>
      </div>

      <!-- Weights -->
      <section class="card weights-card">
        <div class="section-head">
          <h2>Bobot Komponen</h2>
          <button v-if="!editingWeights" class="btn btn-ghost btn-sm" @click="startEditWeights">Ubah Bobot</button>
        </div>

        <div v-if="!editingWeights" class="weight-chips">
          <span v-for="k in GRADE_COMPONENTS" :key="k" class="weight-chip">
            {{ COMPONENT_LABELS[k] }} <strong>{{ weights[k] }}%</strong>
          </span>
          <span v-if="!gradebook.hasCustomWeights(courseId)" class="muted">(bobot bawaan)</span>
        </div>

        <form v-else @submit.prevent="saveWeights">
          <div class="weight-grid">
            <div v-for="k in GRADE_COMPONENTS" :key="k" class="form-group">
              <label class="form-label" :for="`w-${k}`">{{ COMPONENT_LABELS[k] }} (%)</label>
              <input
                :id="`w-${k}`"
                v-model.number="weightForm[k]"
                class="form-input"
                type="number"
                min="0"
                max="100"
                step="1"
                required
              />
            </div>
          </div>
          <p class="weight-total" :class="{ invalid: weightTotal !== 100 }">
            Total: <strong>{{ weightTotal }}%</strong>
            <span v-if="weightError"> — {{ weightError }}</span>
          </p>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="editingWeights = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="savingWeights || !!weightError">
              {{ savingWeights ? 'Menyimpan...' : 'Simpan Bobot' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Table -->
      <section class="card table-card">
        <div class="section-head">
          <h2>Nilai Mahasiswa</h2>
        </div>

        <p v-if="rows.length === 0" class="muted">Belum ada mahasiswa terdaftar di mata kuliah ini.</p>

        <div v-else class="table-wrap">
          <table class="grade-table">
            <thead>
              <tr>
                <th scope="col" class="col-name">Mahasiswa</th>
                <th v-for="k in GRADE_COMPONENTS" :key="k" scope="col" class="num">
                  {{ COMPONENT_LABELS[k] }}
                  <span class="th-weight">{{ weights[k] }}%</span>
                </th>
                <th scope="col" class="num">Akhir</th>
                <th scope="col" class="num">Huruf</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.student_id">
                <th scope="row" class="col-name">
                  <span class="student-name">{{ r.nama }}</span>
                  <span class="student-npm">{{ r.npm }}</span>
                </th>
                <td class="num">{{ show(r.tugas) }}</td>
                <td class="num">{{ show(r.kuis) }}</td>
                <td class="num">{{ show(r.presensi) }}</td>
                <td class="num">
                  <input
                    class="exam-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    inputmode="numeric"
                    :value="r.uts ?? ''"
                    :aria-label="`Nilai UTS ${r.nama}`"
                    @change="onExamInput(r.student_id, 'uts', $event)"
                  />
                </td>
                <td class="num">
                  <input
                    class="exam-input"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    inputmode="numeric"
                    :value="r.uas ?? ''"
                    :aria-label="`Nilai UAS ${r.nama}`"
                    @change="onExamInput(r.student_id, 'uas', $event)"
                  />
                </td>
                <td class="num final">
                  {{ show(r.final) }}<span v-if="r.final !== null && r.isProvisional" class="provisional" title="Nilai sementara">*</span>
                </td>
                <td class="num">
                  <span class="badge" :class="letterClass(r.letter)">{{ r.letter ?? '–' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="notes">
          <li v-if="anyProvisional">
            <strong>*</strong> Nilai sementara: komponen yang belum punya data dilewati dan bobot sisanya dinormalkan ulang.
          </li>
          <li>Tugas: rata-rata nilai tugas; tugas yang lewat tenggat tanpa pengumpulan dihitung 0, yang belum dinilai dilewati.</li>
          <li>Kuis: rata-rata skor terbaik tiap kuis yang dikerjakan. Presensi: persentase hadir.</li>
          <li>UTS/UAS tersimpan otomatis saat Anda pindah dari kolom isian. Kosongkan untuk menghapus.</li>
          <li>Huruf: A ≥ 85, B ≥ 70, C ≥ 60, D ≥ 50, E &lt; 50.</li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.gradebook-page {
  max-width: 64rem;
}

.back-link {
  margin-bottom: 0.75rem;
}

.muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
  margin: 0;
}

.empty {
  text-align: center;
  padding: 2rem 1rem;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.page-head h1 {
  margin: 0 0 0.25rem;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-neutral-500);
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-neutral-900);
  font-variant-numeric: tabular-nums;
}

.summary-letters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--color-neutral-700);
}

.weights-card,
.table-card {
  margin-bottom: 1rem;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.section-head h2 {
  margin: 0;
  font-size: 1.0625rem;
}

.weight-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.weight-chip {
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  background-color: var(--color-neutral-100);
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
}

.weight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: 0.75rem;
}

.weight-total {
  margin: 0.25rem 0 0.75rem;
  font-size: 0.875rem;
  color: var(--color-neutral-700);
}

.weight-total.invalid {
  color: var(--color-error);
}

.table-wrap {
  overflow-x: auto;
}

.grade-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.grade-table th,
.grade-table td {
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--color-neutral-200);
  white-space: nowrap;
}

.grade-table thead th {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  text-align: left;
  vertical-align: bottom;
}

.grade-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.th-weight {
  display: block;
  font-weight: 400;
  color: var(--color-neutral-500);
}

.col-name {
  text-align: left;
  font-weight: 400;
  min-width: 11rem;
}

.student-name {
  display: block;
  font-weight: 600;
  color: var(--color-neutral-900);
}

.student-npm {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.exam-input {
  width: 4.25rem;
  padding: 0.25rem 0.375rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: inherit;
  font: inherit;
  text-align: right;
}

.exam-input:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 1px;
}

.final {
  font-weight: 700;
  color: var(--color-neutral-900);
}

.provisional {
  color: var(--color-warning);
  margin-left: 0.125rem;
}

.notes {
  margin: 1rem 0 0;
  padding-left: 1.125rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

@media (max-width: 640px) {
  .page-head {
    flex-direction: column;
  }
}
</style>
