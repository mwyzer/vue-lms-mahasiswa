<script setup lang="ts">
/**
 * Assignment Detail (Student) — Shows assignment info and submission form.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student']
})

const route = useRoute()
const router = useRouter()
const assignmentsStore = useAssignmentsStore()
const notification = useNotification()

const assignmentId = computed(() => route.params.id as string)
const submitText = ref('')
const submitting = ref(false)

// Find the enriched assignment from myAssignments
const myAssignments = computed(() => assignmentsStore.myAssignments as any[])
const assignment = computed(() =>
  myAssignments.value.find((a: any) => a.id === assignmentId.value) || null
)

onMounted(() => {
  assignmentsStore.setCurrentAssignment(assignmentId.value)
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function isOverdue(): boolean {
  if (!assignment.value) return false
  return new Date(assignment.value.tenggat_waktu) < new Date()
}

function handleSubmit() {
  if (!submitText.value.trim()) {
    notification.warning('Silakan isi jawaban terlebih dahulu.')
    return
  }

  submitting.value = true
  // Simulate small delay
  setTimeout(() => {
    assignmentsStore.submitAssignment(assignmentId.value, submitText.value)
    notification.success('Tugas berhasil dikumpulkan!')
    submitting.value = false
  }, 300)
}
</script>

<template>
  <div class="assignment-detail-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali ke Tugas
    </button>

    <!-- Not found -->
    <div v-if="!assignment" class="empty-state card">
      <p>Tugas tidak ditemukan.</p>
      <NuxtLink to="/assignments" class="btn btn-primary btn-sm mt-1">
        Kembali ke Daftar
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Assignment header -->
      <div class="card assignment-header">
        <div class="breadcrumb text-sm text-muted">
          {{ assignment.course_kode }} — {{ assignment.course_name }}
        </div>
        <h1>{{ assignment.judul }}</h1>

        <div class="header-meta">
          <div class="meta-item">
            <span class="meta-label">Deadline</span>
            <span class="meta-value">{{ formatDate(assignment.tenggat_waktu) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span
              v-if="assignment.submission?.nilai != null"
              class="badge badge-success"
            >Dinilai: {{ assignment.submission.nilai }}</span>
            <span
              v-else-if="assignment.submission"
              class="badge badge-primary"
            >Sudah Dikumpulkan</span>
            <span
              v-else-if="isOverdue()"
              class="badge badge-danger"
            >Terlewat</span>
            <span
              v-else
              class="badge badge-neutral"
            >Belum Dikerjakan</span>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="card assignment-body">
        <h3>Deskripsi Tugas</h3>
        <p class="desc-text">{{ assignment.deskripsi }}</p>
      </div>

      <!-- Submission form -->
      <div class="card submission-section">
        <h3>Pengumpulan Tugas</h3>

        <!-- Already submitted -->
        <div v-if="assignment.submission" class="submission-status">
          <div class="status-banner">
            <span class="badge badge-primary">✓ Tugas telah dikumpulkan</span>
          </div>
          <div class="submission-detail">
            <p class="text-sm text-muted">
              Dikumpulkan pada: {{ formatDate(assignment.submission.submitted_at) }}
            </p>
            <div class="submission-answer">
              <strong>Jawaban:</strong>
              <pre class="answer-text">{{ assignment.submission.jawaban }}</pre>
            </div>
            <div v-if="assignment.submission.nilai != null" class="grade-section">
              <div class="grade-card">
                <span class="grade-label">Nilai</span>
                <span class="grade-value">{{ assignment.submission.nilai }}</span>
              </div>
              <div v-if="assignment.submission.feedback" class="feedback-section">
                <strong>Feedback:</strong>
                <p>{{ assignment.submission.feedback }}</p>
              </div>
            </div>
          </div>

          <!-- Update submission -->
          <div class="update-section">
            <p class="text-sm text-muted">Perbarui jawaban Anda:</p>
            <textarea
              v-model="submitText"
              class="form-textarea"
              placeholder="Tulis jawaban Anda di sini..."
              rows="4"
            />
            <button
              class="btn btn-primary btn-sm"
              :disabled="submitting || !submitText.trim()"
              @click="handleSubmit"
            >
              {{ submitting ? 'Menyimpan...' : 'Perbarui Jawaban' }}
            </button>
          </div>
        </div>

        <!-- Not yet submitted -->
        <div v-else>
          <textarea
            v-model="submitText"
            class="form-textarea"
            placeholder="Tulis jawaban Anda di sini..."
            rows="6"
          />
          <div class="submit-actions">
            <button
              class="btn btn-primary"
              :disabled="submitting || !submitText.trim()"
              @click="handleSubmit"
            >
              {{ submitting ? 'Menyimpan...' : 'Kumpulkan Tugas' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.assignment-detail-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.assignment-header {
  margin-bottom: 1rem;
}

.breadcrumb {
  margin-bottom: 0.5rem;
}

.assignment-header h1 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.meta-value {
  font-size: 0.875rem;
  color: var(--color-neutral-800);
  font-weight: 500;
}

.assignment-body,
.submission-section {
  margin-bottom: 1rem;
}

.assignment-body h3,
.submission-section h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.desc-text {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-neutral-700);
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.2s;
  background-color: white;
  color: var(--color-neutral-800);
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.submit-actions {
  margin-top: 0.75rem;
}

.submission-status {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-banner {
  margin-bottom: 0.5rem;
}

.submission-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.submission-answer {
  background-color: var(--color-neutral-50);
  border-radius: 8px;
  padding: 1rem;
}

.answer-text {
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  margin-top: 0.5rem;
  color: var(--color-neutral-700);
}

.grade-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.grade-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--color-success-50);
  border: 1px solid var(--color-success-200);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  align-self: flex-start;
}

.grade-label {
  font-size: 0.75rem;
  color: var(--color-success-700);
  text-transform: uppercase;
  font-weight: 600;
}

.grade-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-success-700);
}

.feedback-section {
  background-color: var(--color-neutral-50);
  border-radius: 8px;
  padding: 1rem;
}

.feedback-section p {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-neutral-700);
  margin-top: 0.5rem;
}

.update-section {
  border-top: 1px solid var(--color-neutral-200);
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

.mt-1 {
  margin-top: 1rem;
}

.text-sm {
  font-size: 0.8125rem;
}

.text-muted {
  color: var(--color-neutral-500);
}
</style>
