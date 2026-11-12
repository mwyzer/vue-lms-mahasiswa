<script setup lang="ts">
/**
 * RubricEditor — instructor creates/edits the rubric of one assignment:
 * criteria (name, description, weight %) and levels (label, descriptor, points).
 */
import { computed, ref, watch } from 'vue'
import {
  RUBRIC_LIMITS,
  cloneCriteria,
  defaultLevels,
  newRubricId,
  validateRubricCriteria,
  type RubricCriterion,
} from '#shared/rubric'

const props = defineProps<{ assignmentId: string }>()
const emit = defineEmits<{ saved: []; close: [] }>()

const rubrics = useRubricsStore()
const notification = useNotification()

const existing = computed(() => rubrics.rubricFor(props.assignmentId))
const draft = ref<RubricCriterion[]>([])
const saving = ref(false)
const errorMsg = ref('')

function load() {
  draft.value = existing.value
    ? cloneCriteria(existing.value.criteria)
    : [
        { id: newRubricId('rc'), nama: 'Ketepatan', deskripsi: 'Jawaban benar dan sesuai soal.', bobot: 50, levels: defaultLevels() },
        { id: newRubricId('rc'), nama: 'Kejelasan', deskripsi: 'Penjelasan runtut dan mudah dipahami.', bobot: 30, levels: defaultLevels() },
        { id: newRubricId('rc'), nama: 'Kerapian', deskripsi: 'Struktur, format, dan penamaan.', bobot: 20, levels: defaultLevels() },
      ]
  errorMsg.value = ''
}

watch(() => props.assignmentId, load, { immediate: true })

const totalWeight = computed(() => draft.value.reduce((s, c) => s + (Number(c.bobot) || 0), 0))
const liveError = computed(() => validateRubricCriteria(draft.value))

function addCriterion() {
  if (draft.value.length >= RUBRIC_LIMITS.criteria) return
  draft.value.push({ id: newRubricId('rc'), nama: '', deskripsi: '', bobot: Math.max(1, 100 - totalWeight.value), levels: defaultLevels() })
}

function removeCriterion(i: number) {
  draft.value.splice(i, 1)
}

function moveCriterion(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= draft.value.length) return
  const [c] = draft.value.splice(i, 1)
  draft.value.splice(j, 0, c!)
}

function addLevel(c: RubricCriterion) {
  if (c.levels.length >= RUBRIC_LIMITS.levels) return
  c.levels.push({ id: newRubricId('rl'), label: '', deskripsi: '', poin: 0 })
}

function removeLevel(c: RubricCriterion, j: number) {
  if (c.levels.length <= RUBRIC_LIMITS.minLevels) return
  c.levels.splice(j, 1)
}

/** Spread 100% evenly (remainder to the first criteria). */
function balanceWeights() {
  const n = draft.value.length
  if (!n) return
  const base = Math.floor(100 / n)
  let rest = 100 - base * n
  for (const c of draft.value) {
    c.bobot = base + (rest > 0 ? 1 : 0)
    if (rest > 0) rest--
  }
}

async function save() {
  errorMsg.value = liveError.value || ''
  if (errorMsg.value) return
  saving.value = true
  const ok = await rubrics.saveRubric(props.assignmentId, draft.value)
  saving.value = false
  if (!ok) {
    errorMsg.value = rubrics.error || 'Gagal menyimpan rubrik.'
    return
  }
  notification.success('Rubrik disimpan.')
  load()
  emit('saved')
}

async function remove() {
  if (!existing.value) return
  if (!confirm('Hapus rubrik ini? Rincian skor rubrik dan semua peer review tugas ini ikut terhapus; nilai yang sudah tersimpan tetap ada.')) return
  const ok = await rubrics.deleteRubric(props.assignmentId)
  if (ok) {
    notification.success('Rubrik dihapus.')
    load()
  } else {
    errorMsg.value = rubrics.error || 'Gagal menghapus rubrik.'
  }
}
</script>

<template>
  <section class="rubric-editor" aria-label="Editor rubrik">
    <div class="re-head">
      <h4>📐 {{ existing ? 'Edit Rubrik' : 'Buat Rubrik' }}</h4>
      <span class="re-total" :class="{ ok: totalWeight === 100 }">Total bobot: {{ totalWeight }}%</span>
    </div>
    <p class="re-muted">
      Skor tiap kriteria = bobot × (poin level dipilih ÷ poin tertinggi kriteria). Skor total 0–100 mengisi nilai tugas.
    </p>

    <div v-for="(c, i) in draft" :key="c.id" class="re-criterion">
      <div class="re-row">
        <div class="re-field re-grow">
          <label class="re-label" :for="`${c.id}-nama`">Kriteria {{ i + 1 }}</label>
          <input :id="`${c.id}-nama`" v-model="c.nama" class="re-input" :maxlength="RUBRIC_LIMITS.nama" placeholder="Nama kriteria" />
        </div>
        <div class="re-field re-weight">
          <label class="re-label" :for="`${c.id}-bobot`">Bobot (%)</label>
          <input :id="`${c.id}-bobot`" v-model.number="c.bobot" type="number" min="1" max="100" class="re-input" />
        </div>
        <div class="re-criterion-actions">
          <button type="button" class="btn btn-ghost btn-xs" :disabled="i === 0" aria-label="Naikkan kriteria" @click="moveCriterion(i, -1)">↑</button>
          <button type="button" class="btn btn-ghost btn-xs" :disabled="i === draft.length - 1" aria-label="Turunkan kriteria" @click="moveCriterion(i, 1)">↓</button>
          <button type="button" class="btn btn-ghost btn-xs" :disabled="draft.length <= 1" aria-label="Hapus kriteria" @click="removeCriterion(i)">✕</button>
        </div>
      </div>
      <input v-model="c.deskripsi" class="re-input re-desc" :maxlength="RUBRIC_LIMITS.deskripsi" placeholder="Deskripsi kriteria (opsional)" :aria-label="`Deskripsi kriteria ${i + 1}`" />

      <div class="re-levels">
        <div v-for="(l, j) in c.levels" :key="l.id" class="re-level">
          <input v-model="l.label" class="re-input re-level-label" :maxlength="RUBRIC_LIMITS.label" placeholder="Label level" :aria-label="`Label level ${j + 1} kriteria ${i + 1}`" />
          <input v-model.number="l.poin" type="number" min="0" :max="RUBRIC_LIMITS.maxPoin" step="0.5" class="re-input re-level-poin" :aria-label="`Poin level ${j + 1} kriteria ${i + 1}`" />
          <input v-model="l.deskripsi" class="re-input re-level-desc" :maxlength="RUBRIC_LIMITS.deskripsi" placeholder="Deskriptor level" :aria-label="`Deskriptor level ${j + 1} kriteria ${i + 1}`" />
          <button type="button" class="btn btn-ghost btn-xs" :disabled="c.levels.length <= RUBRIC_LIMITS.minLevels" aria-label="Hapus level" @click="removeLevel(c, j)">✕</button>
        </div>
        <button v-if="c.levels.length < RUBRIC_LIMITS.levels" type="button" class="btn btn-ghost btn-xs re-add-level" @click="addLevel(c)">+ Level</button>
      </div>
    </div>

    <div class="re-toolbar">
      <button v-if="draft.length < RUBRIC_LIMITS.criteria" type="button" class="btn btn-secondary btn-sm" @click="addCriterion">+ Kriteria</button>
      <button type="button" class="btn btn-ghost btn-sm" @click="balanceWeights">Ratakan bobot</button>
    </div>

    <p v-if="errorMsg || liveError" class="re-error" role="alert">{{ errorMsg || liveError }}</p>

    <div class="re-actions">
      <button v-if="existing" type="button" class="btn btn-danger btn-sm" @click="remove">Hapus rubrik</button>
      <span class="re-spacer" />
      <button type="button" class="btn btn-ghost btn-sm" @click="emit('close')">Tutup</button>
      <button type="button" class="btn btn-primary btn-sm" :disabled="saving || !!liveError" @click="save">
        {{ saving ? 'Menyimpan...' : 'Simpan Rubrik' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.rubric-editor {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.re-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.re-head h4 {
  font-size: 0.9375rem;
  color: var(--color-primary-700);
}

.re-total {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-warning);
}

.re-total.ok {
  color: var(--color-success);
}

.re-muted {
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.re-criterion {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: 0.625rem;
  background: var(--color-neutral-50);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.re-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.re-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.re-grow {
  flex: 1;
  min-width: 160px;
}

.re-weight {
  width: 90px;
}

.re-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.re-input {
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-input, 6px);
  font: inherit;
  font-size: 0.8125rem;
  background: var(--color-surface);
  color: var(--color-neutral-800);
}

.re-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.re-criterion-actions {
  display: flex;
  gap: 0.125rem;
}

.re-levels {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-left: 0.5rem;
  border-left: 2px solid var(--color-primary-200);
}

.re-level {
  display: grid;
  grid-template-columns: 140px 70px minmax(0, 1fr) auto;
  gap: 0.375rem;
  align-items: center;
}

@media (max-width: 640px) {
  .re-level {
    grid-template-columns: 1fr 70px auto;
  }

  .re-level-desc {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

.re-add-level {
  align-self: flex-start;
}

.re-toolbar,
.re-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.re-spacer {
  flex: 1;
}

.re-error {
  font-size: 0.8125rem;
  color: var(--color-error);
}
</style>
