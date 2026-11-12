<script setup lang="ts">
/**
 * PeerReviewManager — instructor panel for one assignment:
 * settings (on/off, reviewers per submission, deadline, weight), random
 * reviewer assignment, and every review with override / exclude.
 */
import { computed, reactive, ref, watch } from 'vue'
import { RUBRIC_LIMITS, computeRubricScore } from '#shared/rubric'
import { effectiveReviewScore } from '#shared/peerReview'

const props = defineProps<{ assignmentId: string }>()

const rubrics = useRubricsStore()
const assignments = useAssignmentsStore()
const auth = useAuthStore()
const notification = useNotification()

const rubric = computed(() => rubrics.rubricFor(props.assignmentId))
const form = reactive({ enabled: false, reviewers_per_submission: 2, deadline: '', weight: 20 })
const saving = ref(false)
const assigning = ref(false)
const errorMsg = ref('')
const expanded = ref<string | null>(null)
const overrideInput = reactive<Record<string, string | number>>({})

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function load() {
  const p = rubric.value?.peer
  form.enabled = !!p?.enabled
  form.reviewers_per_submission = p?.reviewers_per_submission ?? 2
  form.weight = p?.weight ?? 20
  form.deadline = toLocalInput(p?.deadline) || toLocalInput(new Date(Date.now() + 7 * 86400000).toISOString())
}
watch(() => [props.assignmentId, rubric.value?.peer], load, { immediate: true })

const nameOf = (id: string) => auth.studentRoster.find((s: any) => s.id === id)?.nama || id
const submissions = computed(() => assignments.submissionsForAssignment(props.assignmentId))
const reviews = computed(() => rubrics.reviewsForAssignment(props.assignmentId))
const submittedCount = computed(() => reviews.value.filter((r) => r.status === 'submitted').length)

const rows = computed(() =>
  submissions.value
    .map((s) => {
      const list = reviews.value.filter((r) => r.submission_id === s.id)
      return {
        sub: s,
        reviews: list,
        summary: rubrics.peerSummaryFor(s.id),
        final: rubrics.finalScoreFor(s),
      }
    })
    .filter((r) => r.reviews.length > 0),
)

async function saveSettings() {
  errorMsg.value = ''
  saving.value = true
  const ok = await rubrics.savePeerConfig(props.assignmentId, {
    enabled: form.enabled,
    reviewers_per_submission: Number(form.reviewers_per_submission),
    deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
    weight: Number(form.weight),
  })
  saving.value = false
  if (!ok) {
    errorMsg.value = rubrics.error || 'Gagal menyimpan.'
    return
  }
  notification.success(form.enabled ? 'Pengaturan peer review disimpan.' : 'Peer review dinonaktifkan.')
}

async function assign() {
  errorMsg.value = ''
  if (reviews.value.length && !confirm('Acak ulang penugasan reviewer? Penugasan lama (belum ada review terkirim) diganti.')) return
  assigning.value = true
  const res = await rubrics.assignPeerReviews(props.assignmentId)
  assigning.value = false
  if (!res) {
    errorMsg.value = rubrics.error || 'Gagal menugaskan reviewer.'
    return
  }
  notification.success(`${res.created} tugas review dibuat (${res.effectiveK} reviewer per jawaban).`)
  if (res.note) notification.info(res.note)
}

async function applyOverride(reviewId: string) {
  const raw = String(overrideInput[reviewId] ?? '').trim()
  const value = raw === '' ? null : Number(raw)
  const ok = await rubrics.overridePeerReview(reviewId, { override_skor: value })
  if (ok) notification.success(value === null ? 'Skor pengganti dihapus.' : 'Skor review ditimpa.')
  else notification.error(rubrics.error || 'Gagal menyimpan.')
}

async function toggleExclude(reviewId: string, excluded: boolean) {
  const ok = await rubrics.overridePeerReview(reviewId, { excluded })
  if (!ok) notification.error(rubrics.error || 'Gagal menyimpan.')
}

const reviewScore = (r: any) => (rubric.value ? computeRubricScore(rubric.value.criteria, r.selections) : null)
</script>

<template>
  <section class="peer-manager" aria-label="Peer review">
    <h4>👥 Peer Review Anonim</h4>

    <p v-if="!rubric" class="pm-muted">Buat rubrik terlebih dahulu: mahasiswa menilai jawaban teman memakai rubrik tugas.</p>

    <template v-else>
      <div class="pm-settings">
        <label class="pm-check">
          <input v-model="form.enabled" type="checkbox" />
          Aktifkan peer review
        </label>
        <div class="pm-grid">
          <div class="pm-field">
            <label class="pm-label" :for="`${assignmentId}-pr-k`">Reviewer per jawaban</label>
            <input :id="`${assignmentId}-pr-k`" v-model.number="form.reviewers_per_submission" type="number" min="1" :max="RUBRIC_LIMITS.peerReviewers" class="pm-input" :disabled="!form.enabled" />
          </div>
          <div class="pm-field">
            <label class="pm-label" :for="`${assignmentId}-pr-deadline`">Tenggat review</label>
            <input :id="`${assignmentId}-pr-deadline`" v-model="form.deadline" type="datetime-local" class="pm-input" :disabled="!form.enabled" />
          </div>
          <div class="pm-field">
            <label class="pm-label" :for="`${assignmentId}-pr-w`">Bobot ke nilai akhir (0–{{ RUBRIC_LIMITS.peerWeight }}%)</label>
            <input :id="`${assignmentId}-pr-w`" v-model.number="form.weight" type="number" min="0" :max="RUBRIC_LIMITS.peerWeight" class="pm-input" :disabled="!form.enabled" />
          </div>
        </div>
        <p class="pm-muted">
          Nilai akhir tugas = nilai dosen × {{ 100 - (Number(form.weight) || 0) }}% + rata-rata nilai peer × {{ Number(form.weight) || 0 }}%
          (bila belum ada review yang dihitung, nilai dosen dipakai apa adanya).
        </p>
        <div class="pm-actions">
          <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="saveSettings">
            {{ saving ? 'Menyimpan...' : 'Simpan Pengaturan' }}
          </button>
          <button
            v-if="rubric.peer.enabled"
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="assigning || submittedCount > 0"
            :title="submittedCount > 0 ? 'Sudah ada review terkirim' : ''"
            @click="assign"
          >
            🎲 {{ reviews.length ? 'Acak Ulang Reviewer' : 'Tugaskan Reviewer Acak' }}
          </button>
        </div>
        <p v-if="errorMsg" class="pm-error" role="alert">{{ errorMsg }}</p>
      </div>

      <div v-if="rows.length" class="pm-list">
        <p class="pm-muted">
          {{ submittedCount }}/{{ reviews.length }} review terkirim. Hanya dosen yang melihat identitas reviewer.
        </p>
        <div v-for="row in rows" :key="row.sub.id" class="pm-row">
          <button type="button" class="pm-row-head" :aria-expanded="expanded === row.sub.id" @click="expanded = expanded === row.sub.id ? null : row.sub.id">
            <span class="pm-owner">{{ nameOf(row.sub.student_id) }}</span>
            <span class="pm-muted">{{ row.summary?.submitted ?? 0 }}/{{ row.reviews.length }} review</span>
            <span class="badge badge-neutral">Peer: {{ row.summary?.average ?? '–' }}</span>
            <span v-if="row.sub.nilai != null" class="badge badge-success">Akhir: {{ row.final }}</span>
            <span class="pm-chevron" aria-hidden="true">{{ expanded === row.sub.id ? '▾' : '▸' }}</span>
          </button>

          <div v-if="expanded === row.sub.id" class="pm-reviews">
            <div v-for="r in row.reviews" :key="r.id" class="pm-review" :class="{ excluded: r.excluded }">
              <div class="pm-review-head">
                <strong>{{ nameOf(r.reviewer_id) }}</strong>
                <span v-if="r.status === 'submitted'" class="badge badge-primary">Terkirim</span>
                <span v-else class="badge badge-neutral">Belum</span>
                <span class="pm-muted">Skor: {{ r.skor ?? '–' }}</span>
                <span v-if="r.override_skor != null" class="badge badge-warning">Ditimpa: {{ r.override_skor }}</span>
                <span v-if="r.excluded" class="badge badge-danger">Dikecualikan</span>
                <span class="pm-muted">Dihitung: {{ effectiveReviewScore(r) ?? '–' }}</span>
              </div>
              <ul v-if="r.status === 'submitted' && reviewScore(r)" class="pm-breakdown">
                <li v-for="b in reviewScore(r)!.breakdown" :key="b.criterion_id">{{ b.nama }}: <strong>{{ b.label ?? '–' }}</strong></li>
              </ul>
              <p v-if="r.komentar" class="pm-comment">“{{ r.komentar }}”</p>
              <div class="pm-override">
                <input
                  v-model="overrideInput[r.id]"
                  type="number"
                  min="0"
                  max="100"
                  class="pm-input pm-override-input"
                  :placeholder="r.override_skor != null ? String(r.override_skor) : 'Skor pengganti'"
                  :aria-label="`Skor pengganti untuk review dari ${nameOf(r.reviewer_id)}`"
                />
                <button type="button" class="btn btn-ghost btn-xs" @click="applyOverride(r.id)">Timpa</button>
                <label class="pm-check pm-small">
                  <input type="checkbox" :checked="r.excluded" @change="toggleExclude(r.id, ($event.target as HTMLInputElement).checked)" />
                  Kecualikan
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.peer-manager {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.peer-manager h4 {
  font-size: 0.9375rem;
  color: var(--color-primary-700);
}

.pm-muted {
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.pm-settings {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.5rem;
}

.pm-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pm-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.pm-input {
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-input, 6px);
  font: inherit;
  font-size: 0.8125rem;
  background: var(--color-surface);
  color: var(--color-neutral-800);
}

.pm-input:disabled {
  opacity: 0.6;
}

.pm-check {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-800);
}

.pm-check input[type='checkbox'] {
  width: auto;
  margin: 0;
  accent-color: var(--color-primary-600);
}

.pm-small {
  font-size: 0.8125rem;
  font-weight: 500;
}

.pm-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pm-error {
  font-size: 0.8125rem;
  color: var(--color-error);
}

.pm-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.pm-row {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.pm-row-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pm-row-head:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px;
}

.pm-owner {
  font-weight: 600;
  font-size: 0.875rem;
  flex: 1;
  min-width: 120px;
}

.pm-chevron {
  color: var(--color-neutral-500);
}

.pm-reviews {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0 0.625rem 0.625rem;
}

.pm-review {
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-200);
}

.pm-review.excluded {
  opacity: 0.7;
}

.pm-review-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.8125rem;
}

.pm-breakdown {
  margin: 0.25rem 0 0;
  padding-left: 1.1rem;
  list-style: disc;
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
}

.pm-comment {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pm-override {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.375rem;
  flex-wrap: wrap;
}

.pm-override-input {
  width: 130px;
}
</style>
