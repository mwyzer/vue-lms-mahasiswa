<script setup lang="ts">
/**
 * Instructor Assignments Management — View, create, and grade assignments.
 */
definePageMeta({
  layout: 'instructor',
  middleware: ['auth', 'instructor']
})

const route = useRoute()
const router = useRouter()
const coursesStore = useCoursesStore()
const assignmentsStore = useAssignmentsStore()
const auth = useAuthStore()
const notification = useNotification()
const { exportCourseGrades } = useExportGrades()

const courseId = computed(() => route.params.id as string)
const showAddForm = ref(false)
const showEditForm = ref<string | null>(null)
const showGrading = ref<string | null>(null)
// Direct grading state
const directGradeAssignmentId = ref<string | null>(null)
const directGradeStudents = ref<{ studentId: string; nilai: number; feedback: string }[]>([])
const directGradingSave = ref(false)

// New/Edit assignment form
const formJudul = ref('')
const formDeskripsi = ref('')
const formTenggat = ref('')
const saving = ref(false)

// Grading form
const gradeNilai = ref<number>(0)
const gradeFeedback = ref('')
const grading = ref(false)
const selectedSubmissionId = ref<string | null>(null)

onMounted(async () => {
  await coursesStore.init()
  await assignmentsStore.init()
  coursesStore.setCurrentCourse(courseId.value)
})

const course = computed(() => coursesStore.currentCourse)
const myAssignments = computed(() => assignmentsStore.myAssignments as any[])

// Filter assignments for this course
const courseAssignments = computed(() =>
  myAssignments.value.filter((a: any) => a.course_id === courseId.value)
)

const students = computed(() => auth.studentRoster as any[])

function getStudentName(studentId: string): string {
  const s = students.value.find((s: any) => s.id === studentId)
  return s?.nama || studentId
}

function getStudentNpm(studentId: string): string {
  const s = students.value.find((s: any) => s.id === studentId)
  return s?.npm || ''
}

function openAddForm() {
  showEditForm.value = null
  formJudul.value = ''
  formDeskripsi.value = ''
  formTenggat.value = ''
  showAddForm.value = true
}

function openEditForm(a: any) {
  showAddForm.value = false
  showEditForm.value = a.id
  formJudul.value = a.judul
  formDeskripsi.value = a.deskripsi || ''
  formTenggat.value = a.tenggat_waktu ? new Date(a.tenggat_waktu).toISOString().slice(0, 16) : ''
}

function cancelForm() {
  showAddForm.value = false
  showEditForm.value = null
}

async function saveAssignment() {
  if (!formJudul.value.trim()) {
    notification.warning('Judul tugas harus diisi.')
    return
  }
  if (!formTenggat.value) {
    notification.warning('Deadline harus diisi.')
    return
  }
  saving.value = true
  const deadlineISO = new Date(formTenggat.value).toISOString()

  if (showEditForm.value) {
    await assignmentsStore.updateAssignment(showEditForm.value, {
      judul: formJudul.value.trim(),
      deskripsi: formDeskripsi.value.trim(),
      tenggat_waktu: deadlineISO,
    })
    notification.success('Tugas berhasil diperbarui!')
    showEditForm.value = null
  } else {
    await assignmentsStore.addAssignment(courseId.value, formJudul.value.trim(), formDeskripsi.value.trim(), deadlineISO)
    notification.success('Tugas berhasil ditambahkan!')
    showAddForm.value = false
  }
  saving.value = false
}

async function confirmDeleteAssignment(assignmentId: string) {
  if (!confirm('Hapus tugas ini beserta semua pengumpulan?')) return
  await assignmentsStore.deleteAssignment(assignmentId)
  notification.success('Tugas berhasil dihapus.')
}

function openGrading(assignmentId: string) {
  showGrading.value = assignmentId
  assignmentsStore.setCurrentAssignment(assignmentId)
  gradeNilai.value = 0
  gradeFeedback.value = ''
  selectedSubmissionId.value = null
}

function cancelGrading() {
  showGrading.value = null
}

// Direct grading for all students
function openDirectGrade(assignmentId: string) {
  directGradeAssignmentId.value = assignmentId
  directGradeStudents.value = students.value.map(s => {
    // Pre-fill if already graded
    const existing = getSubmissions(assignmentId).find(sub => sub.student_id === s.id)
    return {
      studentId: s.id,
      nilai: existing?.nilai ?? 100,
      feedback: existing?.feedback ?? '',
    }
  })
}

function cancelDirectGrade() {
  directGradeAssignmentId.value = null
  directGradeStudents.value = []
}

async function saveDirectGrade() {
  if (!directGradeAssignmentId.value) return
  directGradingSave.value = true
  let saved = 0
  for (const g of directGradeStudents.value) {
    const ok = await assignmentsStore.directGradeStudent(
      courseId.value,
      directGradeAssignmentId.value,
      g.studentId,
      g.nilai,
      g.feedback,
    )
    if (ok) saved++
  }
  notification.success(`Nilai langsung disimpan untuk ${saved} mahasiswa!`)
  directGradingSave.value = false
  directGradeAssignmentId.value = null
  directGradeStudents.value = []
}

function getSubmissions(assignmentId: string): any[] {
  const subs = assignmentsStore.submissionsForAssignment(assignmentId)
  return subs.map((s: any) => ({
    ...s,
    student_name: getStudentName(s.student_id),
    student_npm: getStudentNpm(s.student_id),
  }))
}

function submitGrade(submissionId: string) {
  if (gradeNilai.value < 0 || gradeNilai.value > 100) {
    notification.warning('Nilai harus antara 0-100.')
    return
  }
  grading.value = true
  setTimeout(() => {
    assignmentsStore.gradeSubmission(submissionId, gradeNilai.value, gradeFeedback.value)
    notification.success('Nilai berhasil disimpan!')
    showGrading.value = null
    grading.value = false
  }, 200)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="instructor-assignments-page">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm back-btn" @click="router.back()">
      ← Kembali ke Mata Kuliah
    </button>

    <div v-if="!course" class="empty-state card">
      <p>Mata kuliah tidak ditemukan.</p>
    </div>

    <template v-else>
      <div class="page-header">
        <div>
          <h1>Tugas: {{ course.nama }}</h1>
          <p class="text-muted">{{ course.kode }} • Kelola tugas dan penilaian</p>
        </div>
        <div class="header-actions">
          <button
            v-if="courseAssignments.length > 0"
            class="btn btn-success btn-sm"
            @click="exportCourseGrades(course.nama, courseAssignments, getSubmissions)"
          >
            📥 Export Nilai ke Excel
          </button>
          <button v-if="!showAddForm && !showEditForm" class="btn btn-primary btn-sm" @click="openAddForm">
            + Buat Tugas
          </button>
        </div>
      </div>

      <!-- Add/Edit assignment form -->
      <div v-if="showAddForm || showEditForm" class="card form-card">
        <h3>{{ showEditForm ? 'Edit Tugas' : 'Buat Tugas Baru' }}</h3>
        <div class="form-group">
          <label class="form-label">Judul Tugas</label>
          <input
            v-model="formJudul"
            type="text"
            class="form-input"
            placeholder="Contoh: Tugas 1: Implementasi Array"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Deskripsi</label>
          <textarea
            v-model="formDeskripsi"
            class="form-textarea"
            rows="3"
            placeholder="Deskripsi tugas..."
          />
        </div>
        <div class="form-group">
          <label class="form-label">Deadline</label>
          <input
            v-model="formTenggat"
            type="datetime-local"
            class="form-input"
          />
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost btn-sm" @click="cancelForm">Batal</button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="saving || !formJudul.trim() || !formTenggat"
            @click="saveAssignment"
          >
            {{ saving ? 'Menyimpan...' : (showEditForm ? 'Perbarui' : 'Simpan') }}
          </button>
        </div>
      </div>

      <!-- Assignment list -->
      <div v-if="courseAssignments.length === 0 && !showAddForm && !showEditForm" class="empty-state card">
        <p>Belum ada tugas. Klik "Buat Tugas" untuk memulai.</p>
      </div>

      <div v-else class="assignment-list">
        <div
          v-for="a in courseAssignments"
          :key="a.id"
          class="card assignment-card"
        >
          <div class="assignment-header-card">
            <div>
              <h3>{{ a.judul }}</h3>
              <p class="text-sm text-muted">Deadline: {{ formatDate(a.tenggat_waktu) }}</p>
            </div>
            <div class="assignment-actions">
              <button class="btn btn-ghost btn-sm" @click="openEditForm(a)">✏️ Edit</button>
              <button
                class="btn btn-ghost btn-sm"
                @click="openGrading(a.id)"
              >
                📋 Nilai
              </button>
              <button class="btn btn-secondary btn-sm" @click="openDirectGrade(a.id)">
                🏆 Nilai Semua
              </button>
              <button class="btn btn-danger btn-sm" @click="confirmDeleteAssignment(a.id)">🗑️ Hapus</button>
            </div>
          </div>
          <p v-if="a.deskripsi" class="assignment-desc">{{ a.deskripsi }}</p>

          <!-- Submissions -->
          <div class="submissions-section">
            <p class="submissions-title">Pengumpulan:</p>

            <div v-if="getSubmissions(a.id).length === 0" class="text-sm text-muted">
              Belum ada pengumpulan.
            </div>

            <div
              v-for="sub in getSubmissions(a.id)"
              :key="sub.id"
              class="submission-row"
            >
              <div class="submission-info">
                <span class="submission-student">{{ sub.student_name }}</span>
                <span class="text-sm text-muted">{{ sub.student_npm }}</span>
                <span class="text-sm text-muted">{{ formatDate(sub.submitted_at) }}</span>
                <span v-if="sub.nilai != null" class="badge badge-success">
                  {{ sub.nilai }}
                </span>
                <span v-else class="badge badge-neutral">Belum Dinilai</span>
              </div>

              <div v-if="showGrading === a.id" class="grading-form">
                <div class="grade-fields">
                  <div class="form-group">
                    <label class="form-label">Jawaban:</label>
                    <pre class="jawaban-text">{{ sub.jawaban }}</pre>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nilai (0-100)</label>
                    <input
                      v-model.number="gradeNilai"
                      type="number"
                      class="form-input"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Feedback</label>
                    <textarea
                      v-model="gradeFeedback"
                      class="form-textarea"
                      rows="2"
                      placeholder="Tulis feedback..."
                    />
                  </div>
                  <div class="form-actions">
                    <button class="btn btn-ghost btn-sm" @click="cancelGrading">Batal</button>
                    <button
                      class="btn btn-primary btn-sm"
                      :disabled="grading || !selectedSubmissionId"
                      @click="submitGrade(selectedSubmissionId!)"
                    >
                      {{ grading ? 'Menyimpan...' : 'Simpan Nilai' }}
                    </button>
                  </div>
                </div>
              </div>

              <button
                v-if="showGrading !== a.id"
                class="btn btn-ghost btn-sm"
                @click="openGrading(a.id); selectedSubmissionId = sub.id; gradeNilai = sub.nilai || 0; gradeFeedback = sub.feedback || ''"
              >
                {{ sub.nilai != null ? 'Edit Nilai' : 'Beri Nilai' }}
              </button>
            </div>
          </div>

          <!-- Direct Grade All Students -->
          <div v-if="directGradeAssignmentId === a.id" class="direct-grade-section">
            <div class="direct-grade-header">
              <h4>🏆 Nilai Semua Mahasiswa</h4>
              <button class="btn btn-ghost btn-sm" @click="cancelDirectGrade">Tutup</button>
            </div>
            <p class="text-sm text-muted">Beri nilai langsung untuk setiap mahasiswa (tanpa perlu pengumpulan).</p>

            <div class="direct-grade-table">
              <div class="direct-grade-row header-row">
                <span class="dg-name">Nama</span>
                <span class="dg-npm">NPM</span>
                <span class="dg-nilai">Nilai</span>
                <span class="dg-feedback">Feedback</span>
              </div>
              <div
                v-for="dg in directGradeStudents"
                :key="dg.studentId"
                class="direct-grade-row"
              >
                <span class="dg-name">{{ getStudentName(dg.studentId) }}</span>
                <span class="dg-npm text-sm text-muted">{{ getStudentNpm(dg.studentId) }}</span>
                <input
                  v-model.number="dg.nilai"
                  type="number"
                  class="form-input dg-nilai-input"
                  min="0"
                  max="100"
                  placeholder="0-100"
                />
                <input
                  v-model="dg.feedback"
                  type="text"
                  class="form-input dg-feedback-input"
                  placeholder="Feedback opsional..."
                />
              </div>
            </div>

            <div class="form-actions">
              <button class="btn btn-ghost btn-sm" @click="cancelDirectGrade">Batal</button>
              <button class="btn btn-primary btn-sm" :disabled="directGradingSave" @click="saveDirectGrade">
                {{ directGradingSave ? 'Menyimpan...' : '💾 Simpan Semua Nilai' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.instructor-assignments-page {
  max-width: 720px;
}

.back-btn {
  margin-bottom: 1rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-success {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.text-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.form-card {
  margin-bottom: 1rem;
}

.form-card h3 {
  font-size: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 0.375rem;
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  background-color: white;
  color: var(--color-neutral-800);
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  background-color: white;
  color: var(--color-neutral-800);
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.assignment-card {
  padding: 1rem;
}

.assignment-header-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.assignment-header-card h3 {
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.assignment-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.assignment-desc {
  font-size: 0.875rem;
  color: var(--color-neutral-600);
  margin: 0.5rem 0;
}

.submissions-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
}

.submissions-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-600);
  margin-bottom: 0.5rem;
}

.submission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-neutral-100);
  flex-wrap: wrap;
}

.submission-row:last-child {
  border-bottom: none;
}

.submission-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.submission-student {
  font-weight: 500;
  font-size: 0.875rem;
}

.grading-form {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: var(--color-neutral-50);
  border-radius: 8px;
}

.grade-fields {
  display: flex;
  flex-direction: column;
}

.jawaban-text {
  font-size: 0.8125rem;
  background-color: white;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--color-neutral-200);
  white-space: pre-wrap;
  line-height: 1.5;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-neutral-500);
}

/* Direct grade all students */
.direct-grade-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 2px solid var(--color-primary-200);
}

.direct-grade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.direct-grade-header h4 {
  font-size: 0.9375rem;
  color: var(--color-primary-700);
}

.direct-grade-table {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.direct-grade-row {
  display: grid;
  grid-template-columns: 1fr 100px 80px 1fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-neutral-100);
}

.direct-grade-row.header-row {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-500);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dg-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.dg-nilai-input {
  width: 70px !important;
  text-align: center;
}

.dg-feedback-input {
  width: 100% !important;
}

.btn-secondary {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
  border: 1px solid var(--color-neutral-300);
}

.btn-secondary:hover {
  background: var(--color-neutral-200);
}
</style>
