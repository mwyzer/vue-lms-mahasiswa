<script setup lang="ts">
/**
 * AiQuizGenerator — "✨ Generate dengan AI" dialog for instructors.
 *
 * Flow: pick a lesson of the quiz's course → count + difficulty → POST
 * /api/ai/generate-quiz → review drafts (edit, choose correct answer,
 * deselect, regenerate batch) → "Tambahkan N soal ke kuis" saves ONLY the
 * selected, re-validated drafts through quizStore.addQuestionsBulk (the same
 * save path as CSV import). Nothing is saved before that explicit step.
 *
 * `penjelasan` is shown to help the instructor judge a draft but is not
 * persisted (QuizQuestion has no explanation column).
 */
import { useQuizStore, type CsvQuestionRow } from '~/stores/quiz'
import { useCoursesStore } from '~/stores/courses'
import { useNotification } from '~/composables/useNotification'
import type { Lesson } from '~/types/database'

type Letter = 'a' | 'b' | 'c' | 'd'
type Difficulty = 'mudah' | 'sedang' | 'sulit'

interface ApiQuestion {
  pertanyaan: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  jawaban_benar: Letter
  penjelasan: string
}
interface ApiResponse {
  questions: ApiQuestion[]
  source: 'ai' | 'demo'
  requested: number
  generated: number
}
interface Draft extends ApiQuestion {
  uid: string
  selected: boolean
}

const props = defineProps<{ quizId: string; courseId: string }>()
const emit = defineEmits<{ close: []; added: [count: number] }>()

/** Mirrors QUIZGEN_LIMITS in server/utils/quizGen.ts (server code is not importable from the app bundle). */
const LIMITS = {
  LESSON_MIN_CHARS: 120,
  LESSON_MAX_CHARS: 50_000,
  COUNT_MIN: 1,
  COUNT_MAX: 10,
  EXISTING_MAX_ITEMS: 200,
  PERTANYAAN_MAX_CHARS: 600,
  PILIHAN_MAX_CHARS: 250,
}
const LETTERS: Letter[] = ['a', 'b', 'c', 'd']
const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'mudah', label: 'Mudah', hint: 'ingatan & definisi' },
  { value: 'sedang', label: 'Sedang', hint: 'pemahaman konsep' },
  { value: 'sulit', label: 'Sulit', hint: 'analisis & penerapan' },
]

const quizStore = useQuizStore()
const courseStore = useCoursesStore()
const notification = useNotification()

const uidBase = `aiq-${Math.random().toString(36).slice(2, 8)}`
const ids = {
  title: `${uidBase}-title`,
  lesson: `${uidBase}-lesson`,
  lessonHint: `${uidBase}-lesson-hint`,
  count: `${uidBase}-count`,
}

// ── Lessons of the quiz's course ──
const ready = ref(false)
onMounted(async () => {
  await courseStore.init()
  courseStore.setCurrentCourse(props.courseId)
  ready.value = true
})

const lessons = computed<Lesson[]>(() =>
  ready.value && courseStore.currentCourse?.id === props.courseId
    ? [...courseStore.lessons].sort((a, b) => a.urutan - b.urutan)
    : [],
)
const lessonLength = (l: Lesson) => (l.konten ?? '').trim().length
const lessonProblem = (l: Lesson): string | null => {
  const n = lessonLength(l)
  if (n === 0) return 'belum ada isi materi'
  if (n < LIMITS.LESSON_MIN_CHARS) return `isi terlalu pendek: ${n}/${LIMITS.LESSON_MIN_CHARS} karakter`
  if (n > LIMITS.LESSON_MAX_CHARS) return `isi terlalu panjang: maks. ${LIMITS.LESSON_MAX_CHARS} karakter`
  return null
}
const usableLessons = computed(() => lessons.value.filter((l) => !lessonProblem(l)))

const lessonId = ref('')
watch(
  usableLessons,
  (list) => {
    if (!list.some((l) => l.id === lessonId.value)) lessonId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
const selectedLesson = computed(() => lessons.value.find((l) => l.id === lessonId.value) ?? null)

const count = ref(5)
const difficulty = ref<Difficulty>('sedang')
const clampedCount = computed(() => {
  const n = Math.round(Number(count.value))
  return Number.isFinite(n) ? Math.min(LIMITS.COUNT_MAX, Math.max(LIMITS.COUNT_MIN, n)) : 5
})

// ── Generate ──
const step = ref<'form' | 'review'>('form')
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const drafts = ref<Draft[]>([])
const meta = ref<{ source: 'ai' | 'demo'; requested: number; generated: number; lessonTitle: string } | null>(null)

const existingQuestions = computed(() => quizStore.questionsForQuiz(props.quizId).map((q) => q.pertanyaan))

function errorMessage(err: any): string {
  const status: number | undefined = err?.statusCode ?? err?.status ?? err?.response?.status
  const serverMsg: string | undefined = err?.data?.message || err?.data?.statusMessage
  if (status === 429) return serverMsg || 'Terlalu banyak permintaan ke AI. Tunggu sebentar lalu coba lagi.'
  if (status === 403) return 'Akses ditolak: hanya instruktur atau admin yang dapat membuat soal dengan AI.'
  if (status === 401) return 'Sesi Anda telah berakhir. Silakan login ulang.'
  if (status && [400, 413, 422].includes(status) && serverMsg) return serverMsg
  return 'Gagal membuat soal. Periksa koneksi Anda lalu coba lagi.'
}

let draftSeq = 0
async function generate(opts: { fresh?: boolean } = {}) {
  if (loading.value || !selectedLesson.value) return
  loading.value = true
  errorMsg.value = null
  try {
    const lesson = selectedLesson.value
    const res = await $fetch<ApiResponse>('/api/ai/generate-quiz', {
      method: 'POST',
      body: {
        lesson: { judul: lesson.judul, konten: lesson.konten ?? '' },
        count: clampedCount.value,
        difficulty: difficulty.value,
        existing: existingQuestions.value.slice(0, LIMITS.EXISTING_MAX_ITEMS),
        // A new seed on "generate ulang" so demo-mode drafts vary as well.
        ...(opts.fresh ? { seed: Math.floor(Math.random() * 2 ** 31) } : {}),
      },
    })
    if (!res || !Array.isArray(res.questions) || res.questions.length === 0) {
      throw new Error('empty response')
    }
    drafts.value = res.questions.map((q) => ({ ...q, uid: `${uidBase}-q${++draftSeq}`, selected: true }))
    meta.value = { source: res.source, requested: res.requested, generated: res.generated, lessonTitle: lesson.judul }
    step.value = 'review'
    await nextTick()
    reviewHeading.value?.focus()
  } catch (err) {
    errorMsg.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

// ── Review & validation ──
/** Same comparison as the server: case/whitespace/trailing-punctuation-insensitive. */
function key(s: string): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'“”‘’(]+|[\s"'“”‘’).,;:!?…]+$/g, '')
}

function draftProblem(d: Draft): string | null {
  const fields = [d.pertanyaan, d.pilihan_a, d.pilihan_b, d.pilihan_c, d.pilihan_d].map((s) => (s ?? '').trim())
  if (fields.some((f) => !f)) return 'Pertanyaan dan keempat pilihan wajib diisi.'
  if (fields[0]!.length > LIMITS.PERTANYAAN_MAX_CHARS) return `Pertanyaan terlalu panjang (maks. ${LIMITS.PERTANYAAN_MAX_CHARS} karakter).`
  if (fields.slice(1).some((f) => f.length > LIMITS.PILIHAN_MAX_CHARS)) return `Pilihan terlalu panjang (maks. ${LIMITS.PILIHAN_MAX_CHARS} karakter).`
  if (new Set(fields.slice(1).map(key)).size !== 4) return 'Keempat pilihan jawaban harus berbeda.'
  if (!LETTERS.includes(d.jawaban_benar)) return 'Pilih satu jawaban yang benar.'
  const k = key(d.pertanyaan)
  if (existingQuestions.value.some((q) => key(q) === k)) return 'Soal ini sudah ada di kuis.'
  const firstSame = drafts.value.find((o) => o.selected && key(o.pertanyaan) === k)
  if (firstSame && firstSame.uid !== d.uid) return 'Soal ini sama dengan draf lain yang dipilih.'
  return null
}

const problems = computed(() => Object.fromEntries(drafts.value.map((d) => [d.uid, d.selected ? draftProblem(d) : null])))
const selectedDrafts = computed(() => drafts.value.filter((d) => d.selected))
const selectedCount = computed(() => selectedDrafts.value.length)
const invalidSelected = computed(() => selectedDrafts.value.filter((d) => problems.value[d.uid]).length)

function setAll(selected: boolean) {
  drafts.value.forEach((d) => (d.selected = selected))
}

const saving = ref(false)
async function addToQuiz() {
  if (saving.value || selectedCount.value === 0) return
  if (invalidSelected.value > 0) {
    notification.warning('Perbaiki soal yang ditandai atau batalkan pilihannya terlebih dahulu.')
    return
  }
  saving.value = true
  try {
    const rows: CsvQuestionRow[] = selectedDrafts.value
      .filter((d) => !draftProblem(d)) // re-validate at the moment of saving
      .map((d) => ({
        pertanyaan: d.pertanyaan.trim(),
        pilihan_a: d.pilihan_a.trim(),
        pilihan_b: d.pilihan_b.trim(),
        pilihan_c: d.pilihan_c.trim(),
        pilihan_d: d.pilihan_d.trim(),
        jawaban_benar: d.jawaban_benar,
      }))
    const added = await quizStore.addQuestionsBulk(props.quizId, rows)
    if (added > 0) {
      notification.success(`${added} soal berhasil ditambahkan ke kuis.`)
      emit('added', added)
      emit('close')
    } else {
      notification.error('Gagal menambahkan soal. Coba lagi.')
    }
  } finally {
    saving.value = false
  }
}

function backToForm() {
  step.value = 'form'
  errorMsg.value = null
}

// ── Dialog behaviour: focus, Escape, focus trap ──
const dialog = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const reviewHeading = ref<HTMLElement | null>(null)
let restoreFocus: HTMLElement | null = null

onMounted(() => {
  restoreFocus = (document.activeElement as HTMLElement | null) ?? null
  nextTick(() => heading.value?.focus())
})
onBeforeUnmount(() => restoreFocus?.focus?.())

function close() {
  if (saving.value) return
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
    return
  }
  if (e.key !== 'Tab' || !dialog.value) return
  const focusables = [...dialog.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null || el === document.activeElement)
  if (focusables.length === 0) return
  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div class="aiq-overlay" @click.self="close">
    <div
      ref="dialog"
      class="aiq-dialog card"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="ids.title"
      :aria-busy="loading || saving"
      @keydown="onKeydown"
    >
      <header class="aiq-header">
        <h2 :id="ids.title" ref="heading" tabindex="-1">✨ Generate Soal dengan AI</h2>
        <button type="button" class="btn btn-ghost btn-sm" aria-label="Tutup dialog" :disabled="saving" @click="close">✕</button>
      </header>

      <!-- Step 1: settings -->
      <form v-if="step === 'form'" class="aiq-form" @submit.prevent="generate()">
        <p class="aiq-muted">
          AI menyusun draf soal pilihan ganda dari isi materi. Anda meninjau dan mengedit draf terlebih dahulu;
          tidak ada soal yang disimpan sebelum Anda menekan <strong>Tambahkan ke kuis</strong>.
        </p>

        <div class="aiq-field">
          <label :for="ids.lesson">Materi sumber</label>
          <select
            :id="ids.lesson"
            v-model="lessonId"
            class="form-input"
            :disabled="loading || usableLessons.length === 0"
            :aria-describedby="ids.lessonHint"
          >
            <option v-if="usableLessons.length === 0" value="">— Tidak ada materi yang bisa digunakan —</option>
            <option v-for="l in lessons" :key="l.id" :value="l.id" :disabled="!!lessonProblem(l)">
              {{ l.urutan }}. {{ l.judul }}{{ lessonProblem(l) ? ` (${lessonProblem(l)})` : '' }}
            </option>
          </select>
          <p :id="ids.lessonHint" class="aiq-hint">
            <template v-if="!ready">Memuat daftar materi…</template>
            <template v-else-if="lessons.length === 0">Mata kuliah ini belum memiliki materi.</template>
            <template v-else-if="usableLessons.length === 0">
              Semua materi masih terlalu pendek. Tambahkan isi materi (minimal {{ LIMITS.LESSON_MIN_CHARS }} karakter)
              di halaman Materi, lalu kembali ke sini.
            </template>
            <template v-else>
              Materi dengan isi kurang dari {{ LIMITS.LESSON_MIN_CHARS }} karakter tidak dapat dipilih.
              <span v-if="selectedLesson">Materi terpilih: {{ lessonLength(selectedLesson) }} karakter.</span>
            </template>
          </p>
        </div>

        <div class="aiq-row">
          <div class="aiq-field aiq-count">
            <label :for="ids.count">Jumlah soal ({{ LIMITS.COUNT_MIN }}–{{ LIMITS.COUNT_MAX }})</label>
            <input
              :id="ids.count"
              v-model.number="count"
              type="number"
              class="form-input"
              :min="LIMITS.COUNT_MIN"
              :max="LIMITS.COUNT_MAX"
              :disabled="loading"
              @blur="count = clampedCount"
            />
          </div>

          <fieldset class="aiq-field aiq-difficulty" :disabled="loading">
            <legend>Tingkat kesulitan</legend>
            <div class="aiq-segments">
              <label v-for="d in DIFFICULTIES" :key="d.value" class="aiq-segment" :class="{ active: difficulty === d.value }">
                <input v-model="difficulty" type="radio" :name="`${uidBase}-difficulty`" :value="d.value" />
                <span>{{ d.label }}</span>
                <small>{{ d.hint }}</small>
              </label>
            </div>
          </fieldset>
        </div>

        <div v-if="errorMsg" class="aiq-alert aiq-alert-error" role="alert">
          <span>{{ errorMsg }}</span>
          <button type="submit" class="btn btn-secondary btn-sm" :disabled="loading || !selectedLesson">Coba lagi</button>
        </div>

        <div class="aiq-actions">
          <button type="button" class="btn btn-ghost" :disabled="loading" @click="close">Batal</button>
          <button type="submit" class="btn btn-primary" :disabled="loading || !selectedLesson || !!lessonProblem(selectedLesson)">
            <span v-if="loading" class="aiq-spinner" aria-hidden="true" />
            {{ loading ? 'Membuat soal…' : `✨ Buat ${clampedCount} soal` }}
          </button>
        </div>
        <p class="sr-only" role="status" aria-live="polite">{{ loading ? 'Sedang membuat draf soal, mohon tunggu.' : '' }}</p>
      </form>

      <!-- Step 2: review -->
      <div v-else class="aiq-review">
        <div class="aiq-review-head">
          <h3 ref="reviewHeading" tabindex="-1">Tinjau draf soal</h3>
          <span v-if="meta?.source === 'demo'" class="aiq-badge aiq-badge-demo">contoh (mode demo)</span>
          <span v-else class="aiq-badge aiq-badge-ai">dibuat AI</span>
        </div>
        <p class="aiq-muted">Dari materi: <strong>{{ meta?.lessonTitle }}</strong></p>

        <div v-if="meta?.source === 'demo'" class="aiq-alert aiq-alert-info">
          Mode demo: AI tidak aktif, jadi soal ini dibuat otomatis tanpa AI dengan mengosongkan istilah kunci pada
          kalimat materi (isian rumpang). Kualitasnya terbatas. Periksa dan edit sebelum digunakan.
        </div>
        <div v-else class="aiq-alert aiq-alert-info">
          Soal dibuat oleh AI dan bisa saja keliru. Periksa kebenaran setiap soal dan jawabannya sebelum menambahkannya.
        </div>
        <div v-if="meta && meta.generated < meta.requested" class="aiq-alert aiq-alert-warning" role="status">
          Hanya {{ meta.generated }} dari {{ meta.requested }} soal yang berhasil dibuat. Soal yang tidak valid atau
          duplikat dibuang. Anda bisa membuat ulang atau menambah soal secara manual.
        </div>

        <div class="aiq-bulk">
          <span>{{ selectedCount }} dari {{ drafts.length }} soal dipilih</span>
          <button type="button" class="btn btn-ghost btn-xs" @click="setAll(true)">Pilih semua</button>
          <button type="button" class="btn btn-ghost btn-xs" @click="setAll(false)">Kosongkan pilihan</button>
        </div>

        <ol class="aiq-drafts">
          <li
            v-for="(d, i) in drafts"
            :key="d.uid"
            class="aiq-draft"
            :class="{ 'is-off': !d.selected, 'is-invalid': !!problems[d.uid] }"
          >
            <div class="aiq-draft-head">
              <label class="aiq-check">
                <input v-model="d.selected" type="checkbox" />
                <span>Soal {{ i + 1 }}<span class="sr-only"> (dipilih untuk ditambahkan)</span></span>
              </label>
              <span v-if="!d.selected" class="aiq-muted aiq-small">tidak akan ditambahkan</span>
            </div>

            <div class="aiq-field">
              <label :for="`${d.uid}-q`">Pertanyaan</label>
              <textarea
                :id="`${d.uid}-q`"
                v-model="d.pertanyaan"
                class="form-input"
                rows="4"
                :maxlength="LIMITS.PERTANYAAN_MAX_CHARS"
                :disabled="!d.selected"
              />
            </div>

            <fieldset class="aiq-options" :disabled="!d.selected">
              <legend>Pilihan jawaban <span class="aiq-muted aiq-small">(tandai yang benar)</span></legend>
              <div v-for="l in LETTERS" :key="l" class="aiq-option" :class="{ correct: d.jawaban_benar === l }">
                <input
                  :id="`${d.uid}-ans-${l}`"
                  v-model="d.jawaban_benar"
                  type="radio"
                  :name="`${d.uid}-ans`"
                  :value="l"
                  :aria-label="`Jawaban benar: pilihan ${l.toUpperCase()}`"
                />
                <label :for="`${d.uid}-opt-${l}`" class="aiq-letter">{{ l.toUpperCase() }}</label>
                <input
                  :id="`${d.uid}-opt-${l}`"
                  v-model="d[`pilihan_${l}`]"
                  type="text"
                  class="form-input"
                  :maxlength="LIMITS.PILIHAN_MAX_CHARS"
                />
              </div>
            </fieldset>

            <p class="aiq-explain">
              <strong>Penjelasan</strong> <span class="aiq-muted aiq-small">(hanya untuk tinjauan, tidak disimpan)</span><br />
              {{ d.penjelasan || 'Tidak ada penjelasan.' }}
            </p>

            <p v-if="problems[d.uid]" class="aiq-draft-error" role="alert">⚠ {{ problems[d.uid] }}</p>
          </li>
        </ol>

        <div v-if="errorMsg" class="aiq-alert aiq-alert-error" role="alert">
          <span>{{ errorMsg }}</span>
          <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="generate({ fresh: true })">Coba lagi</button>
        </div>

        <div class="aiq-actions aiq-actions-review">
          <button type="button" class="btn btn-ghost" :disabled="loading || saving" @click="backToForm">← Ubah pengaturan</button>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loading || saving"
            title="Mengganti semua draf di atas dengan draf baru"
            @click="generate({ fresh: true })"
          >
            <span v-if="loading" class="aiq-spinner" aria-hidden="true" />
            {{ loading ? 'Membuat ulang…' : '↻ Buat ulang semua' }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving || loading || selectedCount === 0 || invalidSelected > 0"
            @click="addToQuiz"
          >
            {{ saving ? 'Menyimpan…' : `Tambahkan ${selectedCount} soal ke kuis` }}
          </button>
        </div>
        <p v-if="invalidSelected > 0" class="aiq-hint aiq-right">
          {{ invalidSelected }} soal terpilih perlu diperbaiki atau dibatalkan pilihannya.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aiq-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1rem;
  overflow-y: auto;
  background: rgb(0 0 0 / 0.45);
}

.aiq-dialog {
  width: 100%;
  max-width: 760px;
  padding: 1.25rem 1.5rem 1.5rem;
  color: var(--color-neutral-800);
}

.aiq-dialog:hover {
  box-shadow: var(--shadow-card);
}

.aiq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.aiq-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.aiq-header h2:focus,
.aiq-review-head h3:focus {
  outline: none;
}

.aiq-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
}

.aiq-small {
  font-size: 0.75rem;
  margin: 0;
  font-weight: 400;
}

.aiq-hint {
  margin: 0.3rem 0 0;
  font-size: 0.78rem;
  color: var(--color-neutral-500);
}

.aiq-right {
  text-align: right;
}

.aiq-field {
  margin-bottom: 0.85rem;
  min-width: 0;
}

.aiq-field > label,
.aiq-field > legend,
.aiq-options > legend {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
  color: var(--color-neutral-700);
}

.aiq-dialog .form-input {
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-input, 6px);
  background: var(--color-surface);
  color: var(--color-neutral-800);
  font: inherit;
  font-size: 0.9rem;
}

.aiq-dialog .form-input:focus-visible,
.aiq-dialog input[type='radio']:focus-visible,
.aiq-dialog input[type='checkbox']:focus-visible,
.aiq-dialog .btn:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.aiq-dialog .form-input:disabled {
  opacity: 0.6;
}

.aiq-dialog textarea.form-input {
  resize: vertical;
  min-height: 5.5em;
  field-sizing: content; /* grows with the text where supported */
}

.aiq-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
}

.aiq-count {
  flex: 0 0 11rem;
}

.aiq-difficulty {
  flex: 1 1 18rem;
  border: none;
  padding: 0;
  margin: 0 0 0.85rem;
}

.aiq-segments {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}

.aiq-segment {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.3rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.aiq-segment small {
  font-size: 0.68rem;
  font-weight: 400;
  color: var(--color-neutral-500);
}

.aiq-segment input {
  position: absolute;
  opacity: 0;
  inset: 0;
  margin: 0;
  cursor: pointer;
}

.aiq-segment.active {
  border-color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
  color: var(--color-primary-700);
}

.aiq-segment:focus-within {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.aiq-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.aiq-alert {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  border: 1px solid transparent;
}

.aiq-alert-error {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-error) 45%, transparent);
}

.aiq-alert-warning {
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
}

.aiq-alert-info {
  background: color-mix(in srgb, var(--color-info) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-info) 35%, transparent);
}

.aiq-review-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.aiq-review-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.aiq-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill, 9999px);
  border: 1px solid currentColor;
}

.aiq-badge-demo {
  color: var(--color-warning);
}

.aiq-badge-ai {
  color: var(--color-primary-600);
}

.aiq-bulk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.aiq-bulk > span {
  margin-right: auto;
  font-weight: 600;
}

.aiq-drafts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.aiq-draft {
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  background: var(--color-neutral-50);
}

.aiq-draft.is-off {
  opacity: 0.6;
}

.aiq-draft.is-invalid {
  border-color: var(--color-error);
}

.aiq-draft-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.aiq-check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
  cursor: pointer;
}

.aiq-check input {
  width: 1.1rem;
  height: 1.1rem;
}

.aiq-options {
  border: none;
  padding: 0;
  margin: 0 0 0.6rem;
  min-width: 0;
}

.aiq-option {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.35rem;
  padding: 0.15rem 0.3rem;
  border-radius: var(--radius-md);
}

.aiq-option input[type='radio'] {
  width: 1.1rem;
  height: 1.1rem;
  margin: 0;
}

.aiq-option.correct {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
}

.aiq-letter {
  font-weight: 700;
  width: 1.2rem;
  text-align: center;
}

.aiq-explain {
  margin: 0;
  font-size: 0.83rem;
  color: var(--color-neutral-700);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.aiq-draft-error {
  margin: 0.5rem 0 0;
  font-size: 0.83rem;
  color: var(--color-error);
  font-weight: 600;
}

.aiq-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: aiq-spin 0.8s linear infinite;
}

@keyframes aiq-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .aiq-spinner {
    animation-duration: 2.4s;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 480px) {
  .aiq-overlay {
    padding: 0.5rem;
  }

  .aiq-dialog {
    padding: 1rem;
  }

  .aiq-count {
    flex: 1 1 100%;
  }

  .aiq-actions {
    flex-direction: column-reverse;
  }

  .aiq-actions .btn {
    width: 100%;
  }
}
</style>
