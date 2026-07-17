<script setup lang="ts">
/**
 * Instructor Quiz Management Page — Create and manage quizzes for a course.
 */
import { useRoute } from 'vue-router'
import type { Quiz, QuizQuestion } from '~/types/database'
import { useQuizStore } from '~/stores/quiz'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'
import { useNotification } from '~/composables/useNotification'

const quizStore = useQuizStore()
const courseStore = useCoursesStore()
courseStore.init()
const auth = useAuthStore()
const notification = useNotification()
const route = useRoute()
const router = useRouter()

quizStore.init()

const courseId = route.params.id as string
const course = computed(() => courseStore.courses.find(c => c.id === courseId))

const courseQuizzes = computed(() => quizStore.quizzesByCourse(courseId))

// Add quiz modal
const showAddQuiz = ref(false)
const newJudul = ref('')
const newDeskripsi = ref('')
const newTimeLimit = ref(30)
const newPassingScore = ref(60)
const saving = ref(false)

function openAddQuiz() {
  newJudul.value = ''
  newDeskripsi.value = ''
  newTimeLimit.value = 30
  newPassingScore.value = 60
  showAddQuiz.value = true
}

function addQuiz() {
  if (!newJudul.value.trim()) {
    notification.warning('Judul kuis harus diisi.')
    return
  }
  saving.value = true
  setTimeout(() => {
    quizStore.addQuiz({
      course_id: courseId,
      instructor_id: auth.user?.id || 'i1',
      judul: newJudul.value.trim(),
      deskripsi: newDeskripsi.value.trim() || null,
      time_limit_minutes: newTimeLimit.value,
      passing_score: newPassingScore.value,
      is_active: true,
    })
    notification.success('Kuis berhasil ditambahkan!')
    showAddQuiz.value = false
    saving.value = false
  }, 200)
}

// Questions modal
const showQuestions = ref<string | null>(null)
const selectedQuiz = computed(() => {
  if (!showQuestions.value) return null
  return quizStore.quizzes.find(q => q.id === showQuestions.value)
})
const selectedQuizQuestions = computed(() => {
  if (!showQuestions.value) return []
  return quizStore.questionsForQuiz(showQuestions.value)
})

// Add question
const showAddQuestion = ref(false)
const newPertanyaan = ref('')
const newPilihanA = ref('')
const newPilihanB = ref('')
const newPilihanC = ref('')
const newPilihanD = ref('')
const newJawabanBenar = ref<'a' | 'b' | 'c' | 'd'>('a')
const savingQuestion = ref(false)

function openAddQuestion() {
  newPertanyaan.value = ''
  newPilihanA.value = ''
  newPilihanB.value = ''
  newPilihanC.value = ''
  newPilihanD.value = ''
  newJawabanBenar.value = 'a'
  showAddQuestion.value = true
}

function addQuestion() {
  if (!newPertanyaan.value.trim() || !newPilihanA.value.trim() || !newPilihanB.value.trim() ||
      !newPilihanC.value.trim() || !newPilihanD.value.trim()) {
    notification.warning('Semua field harus diisi.')
    return
  }
  savingQuestion.value = true
  const nextUrutan = selectedQuizQuestions.value.length + 1
  setTimeout(() => {
    quizStore.addQuestion({
      quiz_id: showQuestions.value!,
      pertanyaan: newPertanyaan.value.trim(),
      pilihan_a: newPilihanA.value.trim(),
      pilihan_b: newPilihanB.value.trim(),
      pilihan_c: newPilihanC.value.trim(),
      pilihan_d: newPilihanD.value.trim(),
      jawaban_benar: newJawabanBenar.value,
      urutan: nextUrutan,
    })
    notification.success('Soal berhasil ditambahkan!')
    showAddQuestion.value = false
    savingQuestion.value = false
  }, 200)
}

function deleteQuestion(id: string) {
  quizStore.deleteQuestion(id)
  notification.success('Soal berhasil dihapus.')
}

function toggleActive(quizId: string) {
  quizStore.toggleQuizActive(quizId)
  const q = quizStore.quizzes.find(q => q.id === quizId)
  notification.info(q?.is_active ? 'Kuis diaktifkan.' : 'Kuis dinonaktifkan.')
}

// ── Edit Quiz ──
const showEditQuiz = ref(false)
const editQuizId = ref<string | null>(null)
const editJudul = ref('')
const editDeskripsi = ref('')
const editTimeLimit = ref(30)
const editPassingScore = ref(60)
const savingEdit = ref(false)

function openEditQuiz(quiz: Quiz) {
  editQuizId.value = quiz.id
  editJudul.value = quiz.judul
  editDeskripsi.value = quiz.deskripsi || ''
  editTimeLimit.value = quiz.time_limit_minutes
  editPassingScore.value = quiz.passing_score
  showEditQuiz.value = true
}

async function saveEditQuiz() {
  if (!editJudul.value.trim()) {
    notification.warning('Judul kuis harus diisi.')
    return
  }
  savingEdit.value = true
  await quizStore.updateQuiz(editQuizId.value!, {
    judul: editJudul.value.trim(),
    deskripsi: editDeskripsi.value.trim() || null,
    time_limit_minutes: editTimeLimit.value,
    passing_score: editPassingScore.value,
  })
  notification.success('Kuis berhasil diperbarui!')
  showEditQuiz.value = false
  editQuizId.value = null
  savingEdit.value = false
}

// ── Edit Question ──
const editQuestionId = ref<string | null>(null)
const editPertanyaan = ref('')
const editPilihanA = ref('')
const editPilihanB = ref('')
const editPilihanC = ref('')
const editPilihanD = ref('')
const editJawabanBenar = ref<'a' | 'b' | 'c' | 'd'>('a')
const savingEditQuestion = ref(false)

function openEditQuestion(q: QuizQuestion) {
  editQuestionId.value = q.id
  editPertanyaan.value = q.pertanyaan
  editPilihanA.value = q.pilihan_a
  editPilihanB.value = q.pilihan_b
  editPilihanC.value = q.pilihan_c
  editPilihanD.value = q.pilihan_d
  editJawabanBenar.value = q.jawaban_benar
}

function cancelEditQuestion() {
  editQuestionId.value = null
}

async function saveEditQuestion() {
  if (!editPertanyaan.value.trim() || !editPilihanA.value.trim() ||
      !editPilihanB.value.trim() || !editPilihanC.value.trim() || !editPilihanD.value.trim()) {
    notification.warning('Semua field harus diisi.')
    return
  }
  savingEditQuestion.value = true
  await quizStore.updateQuestion(editQuestionId.value!, {
    pertanyaan: editPertanyaan.value.trim(),
    pilihan_a: editPilihanA.value.trim(),
    pilihan_b: editPilihanB.value.trim(),
    pilihan_c: editPilihanC.value.trim(),
    pilihan_d: editPilihanD.value.trim(),
    jawaban_benar: editJawabanBenar.value,
  })
  notification.success('Soal berhasil diperbarui!')
  editQuestionId.value = null
  savingEditQuestion.value = false
}

function deleteQuiz(quizId: string) {
  quizStore.deleteQuiz(quizId)
  notification.success('Kuis berhasil dihapus.')
}

function getStudentAttempts(quizId: string) {
  return quizStore.attemptsForQuiz(quizId)
}

function getStudentName(studentId: string): string {
  const names: Record<string, string> = {
    s1: 'Ahmad Fauzi', s2: 'Budi Santoso', s3: 'Citra Dewi',
    s4: 'Dian Permata', s5: 'Eko Prasetyo', s6: 'Fitri Handayani',
    s7: 'Gilang Ramadhan', s8: 'Hesti Purnamasari', s9: 'Irfan Hakim',
    s10: 'Joko Susilo', s11: 'Kartika Sari', s12: 'Lukman Hakim',
    s13: 'Maya Anggraini', s14: 'Nanda Pratama', s15: 'Olivia Putri',
  }
  return names[studentId] || studentId
}

function getStudentNpm(studentId: string): string {
  const npms: Record<string, string> = {
    s1: '20241001', s2: '20241002', s3: '20241003',
    s4: '20241004', s5: '20241005', s6: '20241006',
    s7: '20241007', s8: '20241008', s9: '20241009',
    s10: '20241010', s11: '20241011', s12: '20241012',
    s13: '20241013', s14: '20241014', s15: '20241015',
  }
  return npms[studentId] || '-'
}
</script>

<template>
  <div class="instructor-quiz-page">
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali
    </button>

    <div class="page-header-row">
      <div>
        <h1>Kuis & Ujian</h1>
        <p v-if="course" class="text-muted">{{ course.kode }} — {{ course.nama }}</p>
      </div>
      <button class="btn btn-primary" @click="openAddQuiz">+ Kuis Baru</button>
    </div>

    <!-- Add Quiz Modal -->
    <div v-if="showAddQuiz" class="modal-overlay" @click.self="showAddQuiz = false">
      <div class="modal card">
        <h3>Tambah Kuis Baru</h3>
        <div class="form-group">
          <label>Judul Kuis</label>
          <input v-model="newJudul" type="text" class="form-input" placeholder="Contoh: UTS Algoritma" />
        </div>
        <div class="form-group">
          <label>Deskripsi (opsional)</label>
          <textarea v-model="newDeskripsi" class="form-input" rows="2" placeholder="Deskripsi kuis..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Batas Waktu (menit)</label>
            <input v-model.number="newTimeLimit" type="number" class="form-input" min="1" max="180" />
          </div>
          <div class="form-group">
            <label>Nilai Lulus (%)</label>
            <input v-model.number="newPassingScore" type="number" class="form-input" min="0" max="100" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showAddQuiz = false">Batal</button>
          <button class="btn btn-primary" :disabled="saving" @click="addQuiz">
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Quiz Modal -->
    <div v-if="showEditQuiz" class="modal-overlay" @click.self="showEditQuiz = false">
      <div class="modal card">
        <h3>Edit Kuis</h3>
        <div class="form-group">
          <label>Judul Kuis</label>
          <input v-model="editJudul" type="text" class="form-input" placeholder="Contoh: UTS Algoritma" />
        </div>
        <div class="form-group">
          <label>Deskripsi (opsional)</label>
          <textarea v-model="editDeskripsi" class="form-input" rows="2" placeholder="Deskripsi kuis..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Batas Waktu (menit)</label>
            <input v-model.number="editTimeLimit" type="number" class="form-input" min="1" max="180" />
          </div>
          <div class="form-group">
            <label>Nilai Lulus (%)</label>
            <input v-model.number="editPassingScore" type="number" class="form-input" min="0" max="100" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showEditQuiz = false">Batal</button>
          <button class="btn btn-primary" :disabled="savingEdit" @click="saveEditQuiz">
            {{ savingEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Quiz List -->
    <div v-if="courseQuizzes.length === 0" class="card empty-state">
      <p>Belum ada kuis untuk mata kuliah ini.</p>
    </div>

    <div v-else class="quiz-list">
      <div v-for="quiz in courseQuizzes" :key="quiz.id" class="card quiz-card">
        <div class="quiz-header">
          <div class="quiz-title-row">
            <span class="badge" :class="quiz.is_active ? 'badge-success' : 'badge-secondary'">
              {{ quiz.is_active ? 'Aktif' : 'Nonaktif' }}
            </span>
            <h3>{{ quiz.judul }}</h3>
          </div>
          <div class="quiz-actions">
            <button class="btn btn-ghost btn-sm" @click="openEditQuiz(quiz)">Edit</button>
            <button
              class="btn btn-sm"
              :class="quiz.is_active ? 'btn-warning' : 'btn-success'"
              @click="toggleActive(quiz.id)"
            >
              {{ quiz.is_active ? 'Nonaktifkan' : 'Aktifkan' }}
            </button>
            <button class="btn btn-danger btn-sm" @click="deleteQuiz(quiz.id)">Hapus</button>
          </div>
        </div>

        <p v-if="quiz.deskripsi" class="quiz-desc">{{ quiz.deskripsi }}</p>

        <div class="quiz-meta-row">
          <span>⏱ {{ quiz.time_limit_minutes }} menit</span>
          <span>📋 Lulus ≥ {{ quiz.passing_score }}%</span>
          <span>📝 {{ quizStore.questions.filter(q => q.quiz_id === quiz.id).length }} soal</span>
        </div>

        <!-- Student Attempts -->
        <div class="attempts-section">
          <button
            class="btn btn-ghost btn-sm"
            @click="showQuestions = showQuestions === quiz.id ? null : quiz.id"
          >
            {{ showQuestions === quiz.id ? 'Sembunyikan' : 'Kelola Soal' }} ({{ quizStore.questions.filter(q => q.quiz_id === quiz.id).length }})
          </button>

          <div class="student-attempts">
            <span class="text-sm text-muted">
              {{ getStudentAttempts(quiz.id).length }} mahasiswa telah mengerjakan
            </span>
            <div v-if="getStudentAttempts(quiz.id).length > 0" class="attempts-list">
              <div
                v-for="att in getStudentAttempts(quiz.id)"
                :key="att.id"
                class="attempt-row"
              >
                <span>{{ getStudentName(att.student_id) }}</span>
                <span class="text-sm">{{ getStudentNpm(att.student_id) }}</span>
                <span
                  class="badge"
                  :class="att.percentage >= (quiz.passing_score || 60) ? 'badge-success' : 'badge-danger'"
                >
                  {{ att.percentage }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Questions management (expandable) -->
        <div v-if="showQuestions === quiz.id" class="questions-section">
          <div class="questions-header">
            <h4>Daftar Soal</h4>
            <button class="btn btn-primary btn-sm" @click="openAddQuestion">+ Soal</button>
          </div>

          <div v-if="selectedQuizQuestions.length === 0" class="text-sm text-muted">
            Belum ada soal. Tambahkan soal sekarang.
          </div>

          <div v-for="(q, idx) in selectedQuizQuestions" :key="q.id" class="question-row">
            <div class="question-row-header">
              <strong>Soal {{ idx + 1 }}</strong>
              <div class="question-row-actions">
                <button class="btn btn-ghost btn-sm" @click="openEditQuestion(q)">Edit</button>
                <button class="btn btn-ghost btn-sm text-danger" @click="deleteQuestion(q.id)">Hapus</button>
              </div>
            </div>

            <!-- Edit question inline form -->
            <div v-if="editQuestionId === q.id" class="edit-question-form">
              <div class="form-group">
                <label>Pertanyaan</label>
                <textarea v-model="editPertanyaan" class="form-input" rows="2" placeholder="Tulis pertanyaan..." />
              </div>
              <div class="form-group">
                <label>Pilihan A</label>
                <input v-model="editPilihanA" type="text" class="form-input" placeholder="Pilihan A" />
              </div>
              <div class="form-group">
                <label>Pilihan B</label>
                <input v-model="editPilihanB" type="text" class="form-input" placeholder="Pilihan B" />
              </div>
              <div class="form-group">
                <label>Pilihan C</label>
                <input v-model="editPilihanC" type="text" class="form-input" placeholder="Pilihan C" />
              </div>
              <div class="form-group">
                <label>Pilihan D</label>
                <input v-model="editPilihanD" type="text" class="form-input" placeholder="Pilihan D" />
              </div>
              <div class="form-group">
                <label>Jawaban Benar</label>
                <select v-model="editJawabanBenar" class="form-input">
                  <option value="a">A</option>
                  <option value="b">B</option>
                  <option value="c">C</option>
                  <option value="d">D</option>
                </select>
              </div>
              <div class="modal-actions">
                <button class="btn btn-ghost btn-sm" @click="cancelEditQuestion">Batal</button>
                <button class="btn btn-primary btn-sm" :disabled="savingEditQuestion" @click="saveEditQuestion">
                  {{ savingEditQuestion ? 'Menyimpan...' : 'Simpan Perubahan' }}
                </button>
              </div>
            </div>

            <!-- Question preview (hidden when editing) -->
            <template v-if="editQuestionId !== q.id">
              <p class="question-text">{{ q.pertanyaan }}</p>
              <div class="options-preview">
                <div :class="{ 'correct-answer': q.jawaban_benar === 'a' }">A. {{ q.pilihan_a }}</div>
                <div :class="{ 'correct-answer': q.jawaban_benar === 'b' }">B. {{ q.pilihan_b }}</div>
                <div :class="{ 'correct-answer': q.jawaban_benar === 'c' }">C. {{ q.pilihan_c }}</div>
                <div :class="{ 'correct-answer': q.jawaban_benar === 'd' }">D. {{ q.pilihan_d }}</div>
              </div>
            </template>
          </div>

          <!-- Add Question Form -->
          <div v-if="showAddQuestion" class="card add-question-form">
            <h4>Tambah Soal</h4>
            <div class="form-group">
              <label>Pertanyaan</label>
              <textarea v-model="newPertanyaan" class="form-input" rows="2" placeholder="Tulis pertanyaan..." />
            </div>
            <div class="form-group">
              <label>Pilihan A</label>
              <input v-model="newPilihanA" type="text" class="form-input" placeholder="Pilihan A" />
            </div>
            <div class="form-group">
              <label>Pilihan B</label>
              <input v-model="newPilihanB" type="text" class="form-input" placeholder="Pilihan B" />
            </div>
            <div class="form-group">
              <label>Pilihan C</label>
              <input v-model="newPilihanC" type="text" class="form-input" placeholder="Pilihan C" />
            </div>
            <div class="form-group">
              <label>Pilihan D</label>
              <input v-model="newPilihanD" type="text" class="form-input" placeholder="Pilihan D" />
            </div>
            <div class="form-group">
              <label>Jawaban Benar</label>
              <select v-model="newJawabanBenar" class="form-input">
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>
              </select>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost btn-sm" @click="showAddQuestion = false">Batal</button>
              <button class="btn btn-primary btn-sm" :disabled="savingQuestion" @click="addQuestion">
                {{ savingQuestion ? 'Menyimpan...' : 'Simpan Soal' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.instructor-quiz-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
}

.back-btn {
  margin-bottom: 0.75rem;
}

.page-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.page-header-row h1 {
  margin: 0;
  font-size: 1.35rem;
}

.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  margin-bottom: 0.75rem;
}

.quiz-meta-row {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-muted);
  margin-bottom: 0.75rem;
}

.attempts-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.student-attempts {
  font-size: 0.85rem;
}

.attempts-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.35rem;
}

.attempt-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border);
}

.attempt-row:last-child {
  border-bottom: none;
}

/* Questions section */
.questions-section {
  margin-top: 1rem;
  padding-top: 1rem;
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

.edit-question-form {
  padding: 0.75rem;
  margin: 0.5rem 0;
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border);
  border-radius: 6px;
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

.add-question-form {
  padding: 1rem;
  margin-top: 0.75rem;
  background: var(--color-bg-secondary, #f8fafc);
}

.add-question-form h4 {
  margin: 0 0 0.75rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  width: 100%;
  max-width: 500px;
  padding: 1.5rem;
}

.modal h3 {
  margin: 0 0 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
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

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

textarea.form-input {
  resize: vertical;
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.form-row .form-group {
  flex: 1;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--color-muted);
}

.badge-success {
  background: #dcfce7;
  color: #15803d;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-secondary {
  background: #f3f4f6;
  color: #6b7280;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-danger {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-warning {
  background: #fef3c7;
  color: #b45309;
  border: none;
}

.btn-success {
  background: #dcfce7;
  color: #15803d;
  border: none;
}

.text-danger {
  color: #dc2626;
}
</style>
