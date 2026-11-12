<script setup lang="ts">
/**
 * PeerReviewTasks — student: review the anonymous answers assigned to them
 * with the assignment rubric + a comment. Editable until the review deadline.
 */
import { computed, reactive, ref } from 'vue'
import { computeRubricScore, type RubricSelection } from '#shared/rubric'
import { isReviewOpen } from '#shared/peerReview'

const props = defineProps<{ assignmentId: string }>()

const rubrics = useRubricsStore()
const notification = useNotification()

const rubric = computed(() => rubrics.rubricFor(props.assignmentId))
const tasks = computed(() => rubrics.myReviewTasks(props.assignmentId))
const open = computed(() => isReviewOpen(rubric.value?.peer.deadline))
const doneCount = computed(() => tasks.value.filter((t) => t.status === 'submitted').length)

const editing = ref<string | null>(null)
const selections = reactive<Record<string, RubricSelection>>({})
const comments = reactive<Record<string, string>>({})
const sending = ref<string | null>(null)
const errors = reactive<Record<string, string>>({})

function startEdit(id: string) {
  const t = tasks.value.find((x) => x.id === id)
  if (!t) return
  selections[id] = { ...t.selections }
  comments[id] = t.komentar || ''
  errors[id] = ''
  editing.value = id
}

async function send(id: string) {
  sending.value = id
  const ok = await rubrics.submitPeerReview(id, selections[id] || {}, comments[id] || '')
  sending.value = null
  if (!ok) {
    errors[id] = rubrics.error || 'Gagal mengirim review.'
    return
  }
  errors[id] = ''
  editing.value = null
  notification.success('Review terkirim. Terima kasih!')
}

const scoreOf = (id: string) => (rubric.value ? computeRubricScore(rubric.value.criteria, selections[id]) : null)

function formatDate(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div v-if="rubric?.peer.enabled && tasks.length" class="card peer-tasks">
    <div class="pt-head">
      <h3>👥 Peer Review</h3>
      <span class="badge" :class="doneCount === tasks.length ? 'badge-success' : 'badge-warning'">
        {{ doneCount }}/{{ tasks.length }} selesai
      </span>
    </div>
    <p class="pt-muted">
      Nilai jawaban teman memakai rubrik tugas. Identitas pemilik jawaban disembunyikan, dan pemilik tidak melihat namamu.
      Tenggat: <strong>{{ formatDate(rubric.peer.deadline) }}</strong>
      <span v-if="!open" class="pt-closed"> · ditutup</span>
    </p>

    <div v-for="t in tasks" :key="t.id" class="pt-task">
      <div class="pt-task-head">
        <strong>{{ t.label }}</strong>
        <span v-if="t.status === 'submitted'" class="badge badge-primary">Terkirim · skor {{ t.skor }}</span>
        <span v-else class="badge badge-neutral">Belum direview</span>
        <span class="pt-spacer" />
        <button
          v-if="editing !== t.id && open"
          type="button"
          class="btn btn-sm"
          :class="t.status === 'submitted' ? 'btn-ghost' : 'btn-primary'"
          @click="startEdit(t.id)"
        >
          {{ t.status === 'submitted' ? 'Ubah review' : 'Mulai review' }}
        </button>
      </div>

      <div v-if="editing === t.id" class="pt-form">
        <div class="pt-answer">
          <span class="pt-label">Jawaban yang direview</span>
          <pre v-if="t.jawaban" class="pt-answer-text">{{ t.jawaban }}</pre>
          <p v-if="t.file_name" class="pt-muted">📎 Lampiran: {{ t.file_name }} (lampiran tidak dibagikan di peer review)</p>
          <p v-if="!t.jawaban && !t.file_name" class="pt-muted">(Jawaban kosong)</p>
        </div>

        <RubricGrader
          v-model="selections[t.id]"
          :criteria="rubric.criteria"
          title="Nilai dengan rubrik"
        />

        <div class="pt-field">
          <label class="pt-label" :for="`${t.id}-komentar`">Komentar untuk pemilik jawaban</label>
          <textarea
            :id="`${t.id}-komentar`"
            v-model="comments[t.id]"
            class="pt-textarea"
            rows="3"
            maxlength="2000"
            placeholder="Apa yang sudah baik, dan apa yang bisa diperbaiki? Tulis dengan sopan dan spesifik."
          />
        </div>

        <p v-if="errors[t.id]" class="pt-error" role="alert">{{ errors[t.id] }}</p>

        <div class="pt-actions">
          <span class="pt-muted">Skor review: {{ scoreOf(t.id)?.total ?? 0 }}/100</span>
          <span class="pt-spacer" />
          <button type="button" class="btn btn-ghost btn-sm" @click="editing = null">Batal</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="sending === t.id" @click="send(t.id)">
            {{ sending === t.id ? 'Mengirim...' : 'Kirim Review' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.peer-tasks {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.pt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.pt-head h3 {
  font-size: 1rem;
}

.pt-muted {
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.pt-closed {
  color: var(--color-error);
  font-weight: 600;
}

.pt-task {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: 0.625rem 0.75rem;
  background: var(--color-surface);
}

.pt-task-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pt-spacer {
  flex: 1;
}

.pt-form {
  margin-top: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.pt-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 0.25rem;
}

.pt-answer-text {
  font-size: 0.8125rem;
  background: var(--color-neutral-50);
  padding: 0.625rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-neutral-200);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
  color: var(--color-neutral-800);
  max-height: 320px;
  overflow: auto;
}

.pt-textarea {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-input, 6px);
  font: inherit;
  font-size: 0.875rem;
  resize: vertical;
  background: var(--color-surface);
  color: var(--color-neutral-800);
}

.pt-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.pt-error {
  font-size: 0.8125rem;
  color: var(--color-error);
}

.pt-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
