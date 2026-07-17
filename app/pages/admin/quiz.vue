<script setup lang="ts">
/**
 * Admin Quiz Management — Full CRUD for quizzes across all courses.
 * Follows the same inline-form-panel pattern as admin/courses.vue.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

import type { Quiz, QuizQuestion } from '~/types/database'
import { useQuizStore } from '~/stores/quiz'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'
import { useNotification } from '~/composables/useNotification'

const quizStore = useQuizStore()
const courseStore = useCoursesStore()
const auth = useAuthStore()
const notification = useNotification()

onMounted(async () => {
  await courseStore.init()
  await quizStore.init()
  await auth.init()
})

const allCourses = computed(() => courseStore.allCourses)

const allQuizzes = computed(() => quizStore.allQuizzes)

/** Quizzes grouped by course */
const groupedQuizzes = computed(() => {
  const groups: Record<string, { course: any; quizzes: Quiz[] }> = {}
  for (const q of allQuizzes.value) {
    const courseId = q.course_id
    if (!groups[courseId]) {
      const course = allCourses.value.find((c: any) => c.id === courseId)
      groups[courseId] = {
        course: course || { id: courseId, nama: courseId, kode: '' },
        quizzes: [],
      }
    }
    groups[courseId].quizzes.push(q)
  }
  return Object.entries(groups)
    .map(([, group]) => group)
    .sort((a, b) => (a.course.nama || '').localeCompare(b.course.nama || ''))
})

// ── Quiz Form State (inline panel) ──
const showForm = ref(false)
const editingQuizId = ref<string | null>(null)
const saving = ref(false)
const confirmDeleteId = ref<string | null>(null)

const formCourseId = ref('')
const formJudul = ref('')
const formDeskripsi = ref('')
const formTimeLimit = ref(30)
const formPassingScore = ref(60)

function openAddForm() {
  editingQuizId.value = null
  formCourseId.value = allCourses.value[0]?.id || ''
  formJudul.value = ''
  formDeskripsi.value = ''
  formTimeLimit.value = 30
  formPassingScore.value = 60
  showForm.value = true
}

function openEditForm(quiz: Quiz) {
  editingQuizId.value = quiz.id
  formCourseId.value = quiz.course_id
  formJudul.value = quiz.judul
  formDeskripsi.value = quiz.deskripsi || ''
  formTimeLimit.value = quiz.time_limit_minutes
  formPassingScore.value = quiz.passing_score
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingQuizId.value = null
}

async function saveQuiz() {
  if (!formJudul.value.trim()) {
    notification.warning('Judul kuis harus diisi.')
    return
  }
  if (!formCourseId.value) {
    notification.warning('Pilih mata kuliah.')
    return
  }

  saving.value = true
  try {
    if (editingQuizId.value) {
      await quizStore.updateQuiz(editingQuizId.value, {
        judul: formJudul.value.trim(),
        deskripsi: formDeskripsi.value.trim() || null,
        time_limit_minutes: formTimeLimit.value,
        passing_score: formPassingScore.value,
      })
      notification.success('Kuis berhasil diperbarui!')
    } else {
      await quizStore.addQuiz({
        course_id: formCourseId.value,
        instructor_id: auth.user?.id || 'a1',
        judul: formJudul.value.trim(),
        deskripsi: formDeskripsi.value.trim() || null,
        time_limit_minutes: formTimeLimit.value,
        passing_score: formPassingScore.value,
        is_active: true,
      })
      notification.success('Kuis berhasil ditambahkan!')
    }
    showForm.value = false
    editingQuizId.value = null
  } catch (err: any) {
    notification.error(err.message || 'Gagal menyimpan kuis.')
  } finally {
    saving.value = false
  }
}

function confirmDelete(id: string) {
  confirmDeleteId.value = id
}

function cancelDelete() {
  confirmDeleteId.value = null
}

async function executeDelete() {
  if (!confirmDeleteId.value) return
  try {
    await quizStore.deleteQuiz(confirmDeleteId.value)
    notification.success('Kuis berhasil dihapus.')
    confirmDeleteId.value = null
  } catch (err: any) {
    notification.error(err.message || 'Gagal menghapus kuis.')
  }
}

async function toggleActive(quizId: string) {
  quizStore.toggleQuizActive(quizId)
  const q = quizStore.quizzes.find(q => q.id === quizId)
  notification.info(q?.is_active ? 'Kuis diaktifkan.' : 'Kuis dinonaktifkan.')
}

function getCourseName(courseId: string): string {
  const c = allCourses.value.find((c: any) => c.id === courseId)
  return c ? `${c.kode} — ${c.nama}` : courseId
}

function getCourseBadge(courseId: string): string {
  const c = allCourses.value.find((c: any) => c.id === courseId)
  return c?.kode || courseId
}

// ── Question Management ──
const expandedQuizId = ref<string | null>(null)
const showAddQuestion = ref(false)
const qFormPertanyaan = ref('')
const qFormPilihanA = ref('')
const qFormPilihanB = ref('')
const qFormPilihanC = ref('')
const qFormPilihanD = ref('')
const qFormJawabanBenar = ref<'a' | 'b' | 'c' | 'd'>('a')
const savingQuestion = ref(false)
const editQuestionId = ref<string | null>(null)

function toggleExpandQuiz(quizId: string) {
  expandedQuizId.value = expandedQuizId.value === quizId ? null : quizId
  showAddQuestion.value = false
  editQuestionId.value = null
}

const expandedQuizQuestions = computed(() => {
  if (!expandedQuizId.value) return []
  return quizStore.questionsForQuiz(expandedQuizId.value)
})

function openAddQuestionForm() {
  editQuestionId.value = null
  qFormPertanyaan.value = ''
  qFormPilihanA.value = ''
  qFormPilihanB.value = ''
  qFormPilihanC.value = ''
  qFormPilihanD.value = ''
  qFormJawabanBenar.value = 'a'
  showAddQuestion.value = true
}

function openEditQuestionForm(q: QuizQuestion) {
  showAddQuestion.value = false
  editQuestionId.value = q.id
  qFormPertanyaan.value = q.pertanyaan
  qFormPilihanA.value = q.pilihan_a
  qFormPilihanB.value = q.pilihan_b
  qFormPilihanC.value = q.pilihan_c
  qFormPilihanD.value = q.pilihan_d
  qFormJawabanBenar.value = q.jawaban_benar
}

function cancelQuestionForm() {
  showAddQuestion.value = false
  editQuestionId.value = null
}

async function saveQuestion() {
  if (!qFormPertanyaan.value.trim() || !qFormPilihanA.value.trim() ||
      !qFormPilihanB.value.trim() || !qFormPilihanC.value.trim() || !qFormPilihanD.value.trim()) {
    notification.warning('Semua field harus diisi.')
    return
  }

  savingQuestion.value = true
  try {
    if (editQuestionId.value) {
      await quizStore.updateQuestion(editQuestionId.value, {
        pertanyaan: qFormPertanyaan.value.trim(),
        pilihan_a: qFormPilihanA.value.trim(),
        pilihan_b: qFormPilihanB.value.trim(),
        pilihan_c: qFormPilihanC.value.trim(),
        pilihan_d: qFormPilihanD.value.trim(),
        jawaban_benar: qFormJawabanBenar.value,
      })
      notification.success('Soal berhasil diperbarui!')
    } else {
      const nextUrutan = expandedQuizQuestions.value.length + 1
      await quizStore.addQuestion({
        quiz_id: expandedQuizId.value!,
        pertanyaan: qFormPertanyaan.value.trim(),
        pilihan_a: qFormPilihanA.value.trim(),
        pilihan_b: qFormPilihanB.value.trim(),
        pilihan_c: qFormPilihanC.value.trim(),
        pilihan_d: qFormPilihanD.value.trim(),
        jawaban_benar: qFormJawabanBenar.value,
        urutan: nextUrutan,
      })
      notification.success('Soal berhasil ditambahkan!')
    }
    editQuestionId.value = null
    showAddQuestion.value = false
  } catch (err: any) {
    notification.error(err.message || 'Gagal menyimpan soal.')
  } finally {
    savingQuestion.value = false
  }
}

async function deleteQuestion(questionId: string) {
  await quizStore.deleteQuestion(questionId)
  notification.success('Soal berhasil dihapus.')
}
</script>

<template>
  <div class="admin-quiz-page">
    <div class="page-header">
      <div>
        <h1>Kuis & Ujian</h1>
        <p class="text-muted">Kelola seluruh kuis dan soal dari semua mata kuliah ({{ allQuizzes.length }}).</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="openAddForm">
        + Tambah Kuis
      </button>
    </div>

    <!-- Add/Edit Quiz Form (inline panel) -->
    <div v-if="showForm" class="card form-card">
      <h3>{{ editingQuizId ? 'Edit Kuis' : 'Tambah Kuis Baru' }}</h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Mata Kuliah</label>
          <select v-model="formCourseId" class="form-select" :disabled="!!editingQuizId">
            <option value="" disabled>Pilih mata kuliah</option>
            <option
              v-for="c in allCourses"
              :key="c.id"
              :value="c.id"
            >
              {{ c.kode }} — {{ c.nama }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Judul Kuis</label>
          <input v-model="formJudul" type="text" class="form-input" placeholder="Contoh: UTS Algoritma" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Deskripsi (opsional)</label>
          <textarea v-model="formDeskripsi" class="form-textarea" rows="2" placeholder="Deskripsi kuis..." />
        </div>
        <div class="form-group">
          <label class="form-label">Batas Waktu (menit)</label>
          <input v-model.number="formTimeLimit" type="number" class="form-input" min="1" max="180" />
        </div>
        <div class="form-group">
          <label class="form-label">Nilai Lulus (%)</label>
          <input v-model.number="formPassingScore" type="number" class="form-input" min="0" max="100" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="cancelForm">Batal</button>
        <button class="btn btn-primary" :disabled="saving" @click="saveQuiz">
          {{ saving ? 'Menyimpan...' : editingQuizId ? 'Perbarui' : 'Simpan' }}
        </button>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="confirmDeleteId" class="card confirm-card">
      <p>Hapus kuis ini? Semua soal dan jawaban terkait juga akan dihapus.</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" @click="cancelDelete">Batal</button>
        <button class="btn btn-danger btn-sm" @click="executeDelete">Hapus</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="allQuizzes.length === 0" class="empty-state card">
      <p>Belum ada kuis.</p>
    </div>

    <!-- Quizzes grouped by course -->
    <div v-else class="course-groups">
      <div
        v-for="group in groupedQuizzes"
        :key="group.course.id"
        class="course-group"
      >
        <h2 class="course-group-title">
          <span class="course-badge">{{ group.course.kode }}</span>
          {{ group.course.nama }}
          <span class="count-badge">{{ group.quizzes.length }} kuis</span>
        </h2>

        <div class="quiz-list">
          <div
            v-for="quiz in group.quizzes"
            :key="quiz.id"
            class="card quiz-card"
          >
            <div class="quiz-header">
              <div class="quiz-title-row">
                <span
                  class="badge"
                  :class="quiz.is_active ? 'badge-success' : 'badge-secondary'"
                >
                  {{ quiz.is_active ? 'Aktif' : 'Nonaktif' }}
                </span>
                <h3>{{ quiz.judul }}</h3>
              </div>
              <div class="quiz-actions">
                <button class="btn btn-ghost btn-sm" @click="openEditForm(quiz)">Edit</button>
                <button
                  class="btn btn-sm"
                  :class="quiz.is_active ? 'btn-warning' : 'btn-success'"
                  @click="toggleActive(quiz.id)"
                >
                  {{ quiz.is_active ? 'Nonaktifkan' : 'Aktifkan' }}
                </button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(quiz.id)">Hapus</button>
              </div>
            </div>

            <p v-if="quiz.deskripsi" class="quiz-desc">{{ quiz.deskripsi }}</p>

            <div class="quiz-meta-row">
              <span>⏱ {{ quiz.time_limit_minutes }} menit</span>
              <span>📋 Lulus ≥ {{ quiz.passing_score }}%</span>
              <span>📝 {{ quizStore.questions.filter(q => q.quiz_id === quiz.id).length }} soal</span>
            </div>

            <!-- Expand Questions -->
            <button
              class="btn btn-ghost btn-sm manage-questions-btn"
              @click="toggleExpandQuiz(quiz.id)"
            >
              {{ expandedQuizId === quiz.id ? 'Sembunyikan Soal' : 'Kelola Soal' }}
              ({{ quizStore.questions.filter(q => q.quiz_id === quiz.id).length }})
            </button>

            <div v-if="expandedQuizId === quiz.id" class="questions-section">
              <div class="questions-header">
                <h4>Daftar Soal</h4>
                <button class="btn btn-primary btn-sm" @click="openAddQuestionForm">+ Soal</button>
              </div>

              <div v-if="expandedQuizQuestions.length === 0" class="text-sm text-muted">
                Belum ada soal. Tambahkan soal sekarang.
              </div>

              <div v-for="(q, idx) in expandedQuizQuestions" :key="q.id" class="question-row">
                <div class="question-row-header">
                  <strong>Soal {{ idx + 1 }}</strong>
                  <div class="question-row-actions">
                    <button class="btn btn-ghost btn-sm" @click="openEditQuestionForm(q)">Edit</button>
                    <button class="btn btn-ghost btn-sm text-danger" @click="deleteQuestion(q.id)">Hapus</button>
                  </div>
                </div>

                <!-- Edit question inline form -->
                <div v-if="editQuestionId === q.id && expandedQuizId === quiz.id" class="edit-question-form">
                  <div class="form-group">
                    <label>Pertanyaan</label>
                    <textarea v-model="qFormPertanyaan" class="form-input" rows="2" placeholder="Tulis pertanyaan..." />
                  </div>
                  <div class="form-group">
                    <label>Pilihan A</label>
                    <input v-model="qFormPilihanA" type="text" class="form-input" placeholder="Pilihan A" />
                  </div>
                  <div class="form-group">
                    <label>Pilihan B</label>
                    <input v-model="qFormPilihanB" type="text" class="form-input" placeholder="Pilihan B" />
                  </div>
                  <div class="form-group">
                    <label>Pilihan C</label>
                    <input v-model="qFormPilihanC" type="text" class="form-input" placeholder="Pilihan C" />
                  </div>
                  <div class="form-group">
                    <label>Pilihan D</label>
                    <input v-model="qFormPilihanD" type="text" class="form-input" placeholder="Pilihan D" />
                  </div>
                  <div class="form-group">
                    <label>Jawaban Benar</label>
                    <select v-model="qFormJawabanBenar" class="form-input">
                      <option value="a">A</option>
                      <option value="b">B</option>
                      <option value="c">C</option>
                      <option value="d">D</option>
                    </select>
                  </div>
                  <div class="modal-actions">
                    <button class="btn btn-ghost btn-sm" @click="cancelQuestionForm">Batal</button>
                    <button class="btn btn-primary btn-sm" :disabled="savingQuestion" @click="saveQuestion">
                      {{ savingQuestion ? 'Menyimpan...' : 'Simpan Perubahan' }}
                    </button>
                  </div>
                </div>

                <!-- Question preview -->
                <template v-if="!(editQuestionId === q.id && expandedQuizId === quiz.id)">
                  <p class="question-text">{{ q.pertanyaan }}</p>
                  <div class="options-preview">
                    <div :class="{ 'correct-answer': q.jawaban_benar === 'a' }">A. {{ q.pilihan_a }}</div>
                    <div :class="{ 'correct-answer': q.jawaban_benar === 'b' }">B. {{ q.pilihan_b }}</div>
                    <div :class="{ 'correct-answer': q.jawaban_benar === 'c' }">C. {{ q.pilihan_c }}</div>
                    <div :class="{ 'correct-answer': q.jawaban_benar === 'd' }">D. {{ q.pilihan_d }}</div>
                  </div>
                </template>
              </div>

              <!-- Add question form -->
              <div v-if="showAddQuestion && expandedQuizId === quiz.id" class="card add-question-form">
                <h4>Tambah Soal Baru</h4>
                <div class="form-group">
                  <label>Pertanyaan</label>
                  <textarea v-model="qFormPertanyaan" class="form-input" rows="2" placeholder="Tulis pertanyaan..." />
                </div>
                <div class="form-group">
                  <label>Pilihan A</label>
                  <input v-model="qFormPilihanA" type="text" class="form-input" placeholder="Pilihan A" />
                </div>
                <div class="form-group">
                  <label>Pilihan B</label>
                  <input v-model="qFormPilihanB" type="text" class="form-input" placeholder="Pilihan B" />
                </div>
                <div class="form-group">
                  <label>Pilihan C</label>
                  <input v-model="qFormPilihanC" type="text" class="form-input" placeholder="Pilihan C" />
                </div>
                <div class="form-group">
                  <label>Pilihan D</label>
                  <input v-model="qFormPilihanD" type="text" class="form-input" placeholder="Pilihan D" />
                </div>
                <div class="form-group">
                  <label>Jawaban Benar</label>
                  <select v-model="qFormJawabanBenar" class="form-input">
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                  </select>
                </div>
                <div class="modal-actions">
                  <button class="btn btn-ghost btn-sm" @click="showAddQuestion = false">Batal</button>
                  <button class="btn btn-primary btn-sm" :disabled="savingQuestion" @click="saveQuestion">
                    {{ savingQuestion ? 'Menyimpan...' : 'Simpan Soal' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-quiz-page {
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.text-muted {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0;
}

/* ── Form Panel ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
}

.full-width {
  grid-column: 1 / -1;
}

.form-group {
  margin-bottom: 0.5rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--color-muted);
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--color-bg);
  color: var(--color-text);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* ── Course Groups ── */
.course-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.course-group-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.course-badge {
  font-size: 0.75rem;
  background: var(--color-primary-100, #dbeafe);
  color: var(--color-primary-700, #1d4ed8);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.count-badge {
  font-size: 0.75rem;
  background: var(--color-neutral-100, #f1f5f9);
  color: var(--text-muted, #94a3b8);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-weight: 400;
}

/* ── Quiz Cards ── */
.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quiz-card {
  padding: 1.25rem;
}

.quiz-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  gap: 0.75rem;
}

.quiz-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quiz-title-row h3 {
  margin: 0;
  font-size: 1rem;
}

.quiz-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.quiz-desc {
  font-size: 0.9rem;
  color: var(--color-muted);
  margin-bottom: 0.5rem;
}

.quiz-meta-row {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-muted);
  margin-bottom: 0.5rem;
}

.manage-questions-btn {
  margin-top: 0.25rem;
}

/* ── Questions ── */
.questions-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.questions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.questions-header h4 {
  margin: 0;
}

.question-row {
  padding: 0.75rem;
  background: var(--color-bg-secondary, #f8fafc);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.question-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.question-row-actions {
  display: flex;
  gap: 0.35rem;
}

.text-danger {
  color: var(--color-danger, #ef4444);
}

.question-text {
  font-size: 0.95rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
}

.options-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem 1rem;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.correct-answer {
  color: var(--color-success, #15803d);
  font-weight: 600;
}

.edit-question-form,
.add-question-form {
  padding: 0.75rem;
  margin: 0.5rem 0;
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.edit-question-form h4,
.add-question-form h4 {
  margin: 0 0 0.75rem;
}

/* ── Badges ── */
.badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-success {
  background: var(--color-success-bg, #dcfce7);
  color: var(--color-success, #15803d);
}

.badge-secondary {
  background: var(--color-neutral-100, #f1f5f9);
  color: var(--text-muted, #94a3b8);
}

.badge-danger {
  background: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  background: var(--color-bg);
  color: var(--color-text);
  transition: all 0.15s;
}

.btn:hover {
  opacity: 0.85;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary-500, #3b82f6);
  color: #fff;
  border-color: var(--color-primary-500, #3b82f6);
}

.btn-ghost {
  background: transparent;
  border-color: transparent;
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  color: #fff;
  border-color: var(--color-danger, #ef4444);
}

.btn-warning {
  background: var(--color-warning, #f59e0b);
  color: #fff;
  border-color: var(--color-warning, #f59e0b);
}

.btn-success {
  background: var(--color-success, #15803d);
  color: #fff;
  border-color: var(--color-success, #15803d);
}

.btn-sm {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
}

/* ── Empty State ── */
.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}

/* ── Misc ── */
.text-sm {
  font-size: 0.8125rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.75rem;
}
</style>
