<script setup lang="ts">
/**
 * AiGradeDraft — "Saran AI" panel inside the instructor grading form.
 *
 * Requests a draft score + feedback from POST /api/ai/grade-draft and lets the
 * instructor copy it into the page's existing grade fields. It NEVER saves a
 * grade: it only emits `apply`, and the instructor still clicks "Simpan Nilai".
 *
 * Only the assignment text, optional rubric and the answer text are sent —
 * never the student's name, NPM or id.
 *
 * Props in, `apply` out; no store access, so the page integration stays tiny.
 *
 * With a structured `rubric` (Prioritas 3) the AI suggests one level + reason
 * per criterion; "Gunakan saran" then also emits the level `selection` so the
 * page can fill its rubric grader. Without it the behaviour is unchanged.
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { RubricCriterion } from '#shared/rubric'

interface GradeDraft {
  nilai_saran: number
  feedback: string
  kekuatan: string[]
  perbaikan: string[]
  catatan?: string
  flags: string[]
  source: 'ai' | 'demo'
  rubrik?: { kriteria: { criterion_id: string; level_id: string; alasan: string }[]; skor: number }
}

const props = defineProps<{
  judul: string
  deskripsi?: string | null
  /** The submission's text answer (`jawaban`). Empty/null ⇒ drafting is unavailable. */
  submissionText?: string | null
  /** True when the submission has a file attachment. */
  hasFile?: boolean
  /** Current values of the page's grade fields (to avoid silent overwrites). */
  currentScore?: number | null
  currentFeedback?: string | null
  /** Structured rubric of the assignment (optional). */
  rubric?: RubricCriterion[] | null
}>()

const emit = defineEmits<{
  apply: [value: { nilai: number; feedback: string; selection?: Record<string, string> }]
}>()

const hasRubric = computed(() => !!props.rubric && props.rubric.length > 0)

/** Rubric-mode rows for display: criterion name, chosen level and reason. */
const rubricRows = computed(() => {
  const items = draft.value?.rubrik?.kriteria ?? []
  return items.map((it) => {
    const c = props.rubric?.find((x) => x.id === it.criterion_id)
    const l = c?.levels.find((x) => x.id === it.level_id)
    return { id: it.criterion_id, nama: c?.nama ?? '?', bobot: c?.bobot ?? 0, level: l?.label ?? '?', poin: l?.poin ?? 0, alasan: it.alasan }
  })
})

const RUBRIC_MAX = 4000

const uid = `aigd-${Math.random().toString(36).slice(2, 8)}`
const status = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const draft = ref<GradeDraft | null>(null)
const errorMsg = ref('')
const rubric = ref('')
const confirming = ref(false)
const appliedMsg = ref('')
const resultHeading = ref<HTMLElement | null>(null)
let requestSeq = 0

const hasText = computed(() => !!props.submissionText && props.submissionText.trim().length > 0)
const isDemo = computed(() => draft.value?.source === 'demo')
const hasInjectionFlag = computed(() => !!draft.value?.flags.includes('possible_prompt_injection'))
const otherFlags = computed(() => (draft.value?.flags ?? []).filter((f) => f !== 'possible_prompt_injection'))

const FLAG_LABELS: Record<string, string> = {
  submission_truncated: 'Jawaban sangat panjang; AI hanya membaca bagian awalnya.',
  score_clamped: 'Nilai dari AI berada di luar rentang 0-100 dan sudah disesuaikan.',
  ai_unavailable_fallback: 'Layanan AI sedang tidak tersedia; yang ditampilkan adalah draf heuristik demo.',
}
const flagLabel = (f: string) => FLAG_LABELS[f] ?? f

// A different submission/assignment invalidates the current draft.
watch(
  () => [props.submissionText, props.judul, (props.rubric ?? []).map((c) => `${c.id}:${c.levels.map((l) => l.id).join(',')}`).join('|')],
  () => reset(),
)

function reset() {
  requestSeq++
  status.value = 'idle'
  draft.value = null
  errorMsg.value = ''
  confirming.value = false
  appliedMsg.value = ''
}

function errorMessage(err: any): string {
  const code = err?.statusCode ?? err?.status ?? err?.response?.status
  const serverMsg: string | undefined = err?.data?.message || err?.data?.statusMessage || err?.statusMessage
  switch (code) {
    case 401:
      return 'Sesi Anda telah berakhir. Silakan login ulang, lalu coba lagi.'
    case 403:
      return 'Akses ditolak: saran AI hanya tersedia untuk instruktur/admin.'
    case 400:
    case 413:
    case 422:
      return serverMsg || 'Permintaan tidak valid.'
    case 429:
      return serverMsg || 'Terlalu banyak permintaan atau batas harian AI tercapai. Coba lagi nanti.'
    case undefined:
    case null:
    case 0:
      return 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.'
    default:
      return `Gagal membuat saran (kode ${code}). Silakan coba lagi.`
  }
}

async function requestDraft() {
  if (!hasText.value || status.value === 'loading') return
  const seq = ++requestSeq
  status.value = 'loading'
  errorMsg.value = ''
  confirming.value = false
  appliedMsg.value = ''
  try {
    const res = await $fetch<GradeDraft>('/api/ai/grade-draft', {
      method: 'POST',
      body: {
        assignment: { judul: props.judul, deskripsi: props.deskripsi || '' },
        submission: { text: props.submissionText },
        ...(hasRubric.value
          ? {
              rubric_criteria: props.rubric!.map((c) => ({
                id: c.id,
                nama: c.nama,
                deskripsi: c.deskripsi || '',
                bobot: c.bobot,
                levels: c.levels.map((l) => ({ id: l.id, label: l.label, deskripsi: l.deskripsi || '', poin: l.poin })),
              })),
            }
          : rubric.value.trim()
            ? { rubric: rubric.value.trim() }
            : {}),
        max_score: 100,
      },
    })
    if (seq !== requestSeq) return
    draft.value = res
    status.value = 'done'
    await nextTick()
    resultHeading.value?.focus()
  } catch (err: any) {
    if (seq !== requestSeq) return
    errorMsg.value = errorMessage(err)
    status.value = 'error'
  }
}

/** Student-facing feedback text built from the draft. */
function composeFeedback(d: GradeDraft): string {
  const parts = [d.feedback.trim()]
  if (d.kekuatan.length) parts.push('Kekuatan:\n' + d.kekuatan.map((k) => `- ${k}`).join('\n'))
  if (d.perbaikan.length) parts.push('Saran perbaikan:\n' + d.perbaikan.map((k) => `- ${k}`).join('\n'))
  return parts.join('\n\n')
}

const fieldsHaveContent = computed(() => {
  const fb = (props.currentFeedback ?? '').trim()
  const score = props.currentScore
  return fb.length > 0 || (score != null && score !== 0 && score !== draft.value?.nilai_saran)
})

function onUse() {
  if (!draft.value) return
  if (fieldsHaveContent.value) {
    confirming.value = true
    return
  }
  apply('replace')
}

function apply(mode: 'replace' | 'append') {
  if (!draft.value) return
  const text = composeFeedback(draft.value)
  const existing = (props.currentFeedback ?? '').trim()
  const feedback = mode === 'append' && existing ? `${existing}\n\n${text}` : text
  const items = draft.value.rubrik?.kriteria
  emit('apply', {
    nilai: draft.value.nilai_saran,
    feedback,
    ...(items?.length ? { selection: Object.fromEntries(items.map((k) => [k.criterion_id, k.level_id])) } : {}),
  })
  confirming.value = false
  appliedMsg.value = items?.length
    ? 'Saran level rubrik, Nilai, dan Feedback sudah diisikan ke form, tetapi BELUM disimpan. Periksa dan ubah bila perlu, lalu klik "Simpan Nilai".'
    : 'Saran dimasukkan ke kolom Nilai dan Feedback, tetapi BELUM disimpan. Periksa dan ubah bila perlu, lalu klik "Simpan Nilai".'
}

function close() {
  reset()
}
</script>

<template>
  <section class="ai-grade-draft" :aria-labelledby="`${uid}-title`">
    <div class="aigd-head">
      <span :id="`${uid}-title`" class="aigd-title">Saran penilaian AI</span>
      <button
        v-if="status === 'idle' || status === 'loading'"
        type="button"
        class="btn btn-sm aigd-btn"
        :disabled="!hasText || status === 'loading'"
        :aria-describedby="!hasText ? `${uid}-notext` : undefined"
        @click="requestDraft"
      >
        <span v-if="status === 'loading'" class="aigd-spinner" aria-hidden="true" />
        {{ status === 'loading' ? 'Membuat saran...' : '✨ Saran AI' }}
      </button>
    </div>

    <p v-if="!hasText" :id="`${uid}-notext`" class="aigd-muted">
      {{ hasFile ? 'Jawaban ini hanya berupa file.' : 'Jawaban ini tidak berisi teks.' }}
      Saran AI hanya tersedia untuk jawaban teks; silakan nilai secara manual.
    </p>

    <p v-else-if="hasRubric && (status === 'idle' || status === 'error')" class="aigd-muted aigd-rubric-note">
      Memakai rubrik tugas ({{ props.rubric!.length }} kriteria): AI akan mengusulkan level dan alasan untuk tiap kriteria.
    </p>

    <details v-else-if="status === 'idle' || status === 'error'" class="aigd-rubric">
      <summary>Rubrik (opsional)</summary>
      <label :for="`${uid}-rubric`" class="aigd-label">Kriteria penilaian yang ingin dipakai AI</label>
      <textarea
        :id="`${uid}-rubric`"
        v-model="rubric"
        class="aigd-textarea"
        rows="3"
        :maxlength="RUBRIC_MAX"
        placeholder="Contoh: Ketepatan output (40), kerapian kode (30), penjelasan (30)"
      />
      <span class="aigd-muted aigd-count">{{ rubric.length }}/{{ RUBRIC_MAX }}</span>
    </details>

    <div class="aigd-live" aria-live="polite" aria-atomic="false">
      <div v-if="status === 'error'" class="aigd-error" role="alert">
        <span>{{ errorMsg }}</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="requestDraft">Coba lagi</button>
      </div>

      <div v-if="status === 'done' && draft" class="aigd-result">
        <p ref="resultHeading" tabindex="-1" class="aigd-label-banner" :class="{ demo: isDemo }">
          <template v-if="isDemo">
            Draf DEMO (heuristik kasar, bukan AI): dihitung dari panjang, istilah kunci, dan struktur jawaban;
            isi jawaban tidak dipahami. Periksa sebelum menyimpan.
          </template>
          <template v-else>Draf AI — periksa sebelum menyimpan. Keputusan nilai tetap di tangan Anda.</template>
        </p>

        <div v-if="hasInjectionFlag" class="aigd-warning" role="alert">
          <strong>⚠️ Kemungkinan upaya manipulasi penilaian.</strong>
          Jawaban memuat kalimat yang tampak ditujukan ke AI/penilai (misalnya meminta nilai tertentu atau menyuruh
          mengabaikan instruksi). Baca jawaban secara manual; saran nilai bisa terpengaruh.
        </div>
        <ul v-if="otherFlags.length" class="aigd-flags">
          <li v-for="f in otherFlags" :key="f">{{ flagLabel(f) }}</li>
        </ul>

        <div v-if="rubricRows.length" class="aigd-block">
          <span class="aigd-subtitle">Saran level per kriteria</span>
          <ul class="aigd-criteria">
            <li v-for="r in rubricRows" :key="r.id">
              <span class="aigd-crit-name">{{ r.nama }} <span class="aigd-muted">({{ r.bobot }}%)</span></span>
              <span class="aigd-crit-level">{{ r.level }} · {{ r.poin }} poin</span>
              <span class="aigd-crit-reason">{{ r.alasan }}</span>
            </li>
          </ul>
        </div>

        <div class="aigd-score">
          <span class="aigd-muted">{{ rubricRows.length ? 'Skor rubrik' : 'Saran nilai' }}</span>
          <strong>{{ draft.nilai_saran }}</strong><span class="aigd-muted">/100</span>
        </div>

        <div class="aigd-block">
          <span class="aigd-subtitle">Feedback untuk mahasiswa</span>
          <p class="aigd-text">{{ draft.feedback }}</p>
        </div>
        <div v-if="draft.kekuatan.length" class="aigd-block">
          <span class="aigd-subtitle">Kekuatan</span>
          <ul><li v-for="(k, i) in draft.kekuatan" :key="`k${i}`">{{ k }}</li></ul>
        </div>
        <div v-if="draft.perbaikan.length" class="aigd-block">
          <span class="aigd-subtitle">Saran perbaikan</span>
          <ul><li v-for="(k, i) in draft.perbaikan" :key="`p${i}`">{{ k }}</li></ul>
        </div>
        <div v-if="draft.catatan" class="aigd-block aigd-note">
          <span class="aigd-subtitle">Catatan untuk instruktur (tidak dimasukkan ke feedback)</span>
          <p class="aigd-text">{{ draft.catatan }}</p>
        </div>

        <div v-if="confirming" class="aigd-confirm" role="group" :aria-labelledby="`${uid}-confirm`">
          <p :id="`${uid}-confirm`">
            Kolom nilai/feedback sudah berisi
            <template v-if="currentScore != null && currentScore !== 0">nilai {{ currentScore }}</template>
            <template v-if="(currentFeedback ?? '').trim()"> dan teks feedback</template>.
            Apa yang ingin dilakukan?
          </p>
          <div class="aigd-actions">
            <button type="button" class="btn btn-primary btn-sm" @click="apply('replace')">Ganti nilai &amp; feedback</button>
            <button
              v-if="(currentFeedback ?? '').trim()"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="apply('append')"
            >Ganti nilai, tambahkan feedback</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="confirming = false">Batal</button>
          </div>
        </div>

        <div v-else class="aigd-actions">
          <button type="button" class="btn btn-primary btn-sm" @click="onUse">Gunakan saran</button>
          <button type="button" class="btn btn-secondary btn-sm" @click="requestDraft">Buat ulang</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="close">Tutup</button>
        </div>
      </div>

      <p v-if="appliedMsg" class="aigd-applied">{{ appliedMsg }}</p>
    </div>
  </section>
</template>

<style scoped>
.ai-grade-draft {
  margin: 0.25rem 0 0.75rem;
  padding: 0.75rem;
  border: 1px dashed var(--color-primary-300);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-neutral-800);
}

.aigd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.aigd-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.aigd-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
}

.aigd-btn:hover:not(:disabled) {
  background: var(--color-primary-100);
}

.aigd-btn:focus-visible,
.aigd-rubric summary:focus-visible,
.aigd-label-banner:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.aigd-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-primary-200);
  border-top-color: var(--color-primary-600);
  border-radius: 50%;
  animation: aigd-spin 0.7s linear infinite;
}

@keyframes aigd-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .aigd-spinner { animation: none; }
}

.aigd-muted {
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.aigd-rubric {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
}

.aigd-rubric summary {
  cursor: pointer;
  color: var(--color-neutral-600);
  width: fit-content;
}

.aigd-label {
  display: block;
  margin: 0.375rem 0 0.25rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.aigd-textarea {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-input, 6px);
  font: inherit;
  font-size: 0.8125rem;
  resize: vertical;
  background: var(--color-surface);
  color: var(--color-neutral-800);
}

.aigd-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.aigd-count {
  display: block;
  text-align: right;
  font-size: 0.75rem;
}

.aigd-error {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  font-size: 0.8125rem;
}

.aigd-result {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.aigd-label-banner {
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
  font-size: 0.8125rem;
  font-weight: 600;
}

.aigd-label-banner.demo {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
  border-color: var(--color-neutral-300);
}

.aigd-warning {
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-neutral-800);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.aigd-flags {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
}

.aigd-score {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
}

.aigd-score strong {
  font-size: 1.5rem;
  color: var(--color-neutral-900);
}

.aigd-block ul,
.aigd-flags {
  list-style: disc;
}

.aigd-block ul {
  margin: 0.125rem 0 0;
  padding-left: 1.1rem;
}

.aigd-subtitle {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-neutral-500);
}

.aigd-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.55;
}

.aigd-note {
  padding: 0.5rem 0.625rem;
  border-left: 3px solid var(--color-neutral-300);
  background: var(--color-neutral-50);
}

.aigd-confirm {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
}

.aigd-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.aigd-rubric-note {
  margin-top: 0.5rem;
}

.aigd-criteria {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.aigd-criteria li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.125rem 0.5rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-sm);
  background: var(--color-neutral-50);
}

.aigd-crit-name {
  font-weight: 600;
  color: var(--color-neutral-800);
}

.aigd-crit-level {
  font-weight: 600;
  color: var(--color-primary-700);
  white-space: nowrap;
}

.aigd-crit-reason {
  grid-column: 1 / -1;
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  overflow-wrap: anywhere;
}

.aigd-applied {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  padding: 0.375rem 0.625rem;
  border-left: 3px solid var(--color-success);
}
</style>
