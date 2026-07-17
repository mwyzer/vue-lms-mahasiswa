/**
 * Quiz Store — Manages interactive quiz questions and student attempts.
 * Follows the Pinia demo-data pattern from assignments.ts / courses.ts stores.
 */
import { defineStore } from 'pinia'
import type { Quiz, QuizQuestion, QuizAttempt } from '~/types/database'
import type { QuizWithCourse } from '~/types/quiz'

export type QuizUpdateData = {
  judul?: string
  deskripsi?: string | null
  time_limit_minutes?: number
  passing_score?: number
  is_active?: boolean
}

export type QuestionUpdateData = {
  pertanyaan?: string
  pilihan_a?: string
  pilihan_b?: string
  pilihan_c?: string
  pilihan_d?: string
  jawaban_benar?: 'a' | 'b' | 'c' | 'd'
  urutan?: number
}

// ── Demo Quizzes ──────────────────────────────────────────────
const DEMO_QUIZZES: Quiz[] = [
  {
    id: 'qz1', course_id: 'c1', instructor_id: 'i1',
    judul: 'UTS — Algoritma & Pemrograman',
    deskripsi: 'Ujian Tengah Semester mencakup materi pertemuan 1-7.',
    time_limit_minutes: 90, passing_score: 60,
    is_active: true,
    created_at: '2025-10-01T00:00:00Z', updated_at: '2025-10-01T00:00:00Z',
  },
  {
    id: 'qz2', course_id: 'c1', instructor_id: 'i1',
    judul: 'Kuis 1 — Variabel & Tipe Data',
    deskripsi: 'Kuis singkat tentang variabel, konstanta, dan tipe data dasar.',
    time_limit_minutes: 15, passing_score: 70,
    is_active: true,
    created_at: '2025-09-10T00:00:00Z', updated_at: '2025-09-10T00:00:00Z',
  },
  {
    id: 'qz3', course_id: 'c2', instructor_id: 'i2',
    judul: 'UTS — Struktur Data',
    deskripsi: 'Ujian Tengah Semester Struktur Data.',
    time_limit_minutes: 90, passing_score: 60,
    is_active: true,
    created_at: '2025-10-05T00:00:00Z', updated_at: '2025-10-05T00:00:00Z',
  },
  {
    id: 'qz4', course_id: 'c3', instructor_id: 'i3',
    judul: 'Kuis 2 — Basis Data SQL',
    deskripsi: 'Kuis tentang query SELECT, JOIN, dan subquery.',
    time_limit_minutes: 20, passing_score: 65,
    is_active: true,
    created_at: '2025-09-20T00:00:00Z', updated_at: '2025-09-20T00:00:00Z',
  },
  {
    id: 'qz5', course_id: 'c1', instructor_id: 'i1',
    judul: 'UAS — Algoritma & Pemrograman',
    deskripsi: 'Ujian Akhir Semester mencakup seluruh materi.',
    time_limit_minutes: 120, passing_score: 60,
    is_active: false,
    created_at: '2025-12-01T00:00:00Z', updated_at: '2025-12-01T00:00:00Z',
  },
]

// ── Demo Quiz Questions ──────────────────────────────────────
const DEMO_QUESTIONS: QuizQuestion[] = [
  // qz1 — UTS Algoritma
  { id: 'qq1', quiz_id: 'qz1', pertanyaan: 'Apa kepanjangan dari IDE?', pilihan_a: 'Integrated Development Environment', pilihan_b: 'Internal Development Engine', pilihan_c: 'Internet Data Exchange', pilihan_d: 'Integrated Design Editor', jawaban_benar: 'a', urutan: 1, created_at: '2025-10-01T00:00:00Z' },
  { id: 'qq2', quiz_id: 'qz1', pertanyaan: 'Tipe data manakah yang digunakan untuk menyimpan bilangan desimal di Python?', pilihan_a: 'int', pilihan_b: 'float', pilihan_c: 'string', pilihan_d: 'bool', jawaban_benar: 'b', urutan: 2, created_at: '2025-10-01T00:00:00Z' },
  { id: 'qq3', quiz_id: 'qz1', pertanyaan: 'Apa fungsi dari operator "==" dalam pemrograman?', pilihan_a: 'Assignment', pilihan_b: 'Perbandingan', pilihan_c: 'Penugasan', pilihan_d: 'Increment', jawaban_benar: 'b', urutan: 3, created_at: '2025-10-01T00:00:00Z' },
  { id: 'qq4', quiz_id: 'qz1', pertanyaan: 'Struktur perulangan yang pasti menjalankan kode minimal satu kali adalah...', pilihan_a: 'for', pilihan_b: 'while', pilihan_c: 'do-while', pilihan_d: 'if', jawaban_benar: 'c', urutan: 4, created_at: '2025-10-01T00:00:00Z' },
  { id: 'qq5', quiz_id: 'qz1', pertanyaan: 'Array dalam pemrograman digunakan untuk...', pilihan_a: 'Menyimpan banyak nilai dalam satu variabel', pilihan_b: 'Menyimpan satu nilai saja', pilihan_c: 'Menghapus data', pilihan_d: 'Mencetak output', jawaban_benar: 'a', urutan: 5, created_at: '2025-10-01T00:00:00Z' },
  // qz2 — Kuis 1 Variabel
  { id: 'qq6', quiz_id: 'qz2', pertanyaan: 'Manakah cara yang benar untuk mendeklarasikan variabel di Python?', pilihan_a: 'var x = 10', pilihan_b: 'x = 10', pilihan_c: 'int x = 10', pilihan_d: 'declare x = 10', jawaban_benar: 'b', urutan: 1, created_at: '2025-09-10T00:00:00Z' },
  { id: 'qq7', quiz_id: 'qz2', pertanyaan: 'Tipe data apakah yang dihasilkan oleh ekspresi "5 + 3.14"?', pilihan_a: 'int', pilihan_b: 'float', pilihan_c: 'string', pilihan_d: 'complex', jawaban_benar: 'b', urutan: 2, created_at: '2025-09-10T00:00:00Z' },
  { id: 'qq8', quiz_id: 'qz2', pertanyaan: 'String "Hello" + "World" akan menghasilkan...', pilihan_a: 'HelloWorld', pilihan_b: 'Hello World', pilihan_c: 'Hello+World', pilihan_d: 'Error', jawaban_benar: 'a', urutan: 3, created_at: '2025-09-10T00:00:00Z' },
  // qz3 — UTS Struktur Data
  { id: 'qq9', quiz_id: 'qz3', pertanyaan: 'Struktur data yang menggunakan prinsip LIFO adalah...', pilihan_a: 'Queue', pilihan_b: 'Stack', pilihan_c: 'Tree', pilihan_d: 'Graph', jawaban_benar: 'b', urutan: 1, created_at: '2025-10-05T00:00:00Z' },
  { id: 'qq10', quiz_id: 'qz3', pertanyaan: 'Kompleksitas waktu dari Binary Search adalah...', pilihan_a: 'O(n)', pilihan_b: 'O(n²)', pilihan_c: 'O(log n)', pilihan_d: 'O(1)', jawaban_benar: 'c', urutan: 2, created_at: '2025-10-05T00:00:00Z' },
  { id: 'qq11', quiz_id: 'qz3', pertanyaan: 'Linked List terdiri dari node-node yang berisi...', pilihan_a: 'Data saja', pilihan_b: 'Data dan pointer', pilihan_c: 'Pointer saja', pilihan_d: 'Data dan index', jawaban_benar: 'b', urutan: 3, created_at: '2025-10-05T00:00:00Z' },
  // qz4 — Basis Data SQL
  { id: 'qq12', quiz_id: 'qz4', pertanyaan: 'Perintah SQL untuk mengambil data adalah...', pilihan_a: 'INSERT', pilihan_b: 'UPDATE', pilihan_c: 'SELECT', pilihan_d: 'DELETE', jawaban_benar: 'c', urutan: 1, created_at: '2025-09-20T00:00:00Z' },
  { id: 'qq13', quiz_id: 'qz4', pertanyaan: 'JOIN yang mengembalikan semua baris dari kedua tabel adalah...', pilihan_a: 'INNER JOIN', pilihan_b: 'LEFT JOIN', pilihan_c: 'RIGHT JOIN', pilihan_d: 'FULL OUTER JOIN', jawaban_benar: 'd', urutan: 2, created_at: '2025-09-20T00:00:00Z' },
  { id: 'qq14', quiz_id: 'qz4', pertanyaan: 'Fungsi agregat untuk menghitung jumlah baris adalah...', pilihan_a: 'SUM', pilihan_b: 'COUNT', pilihan_c: 'AVG', pilihan_d: 'MAX', jawaban_benar: 'b', urutan: 3, created_at: '2025-09-20T00:00:00Z' },
]

// ── Demo Quiz Attempts ───────────────────────────────────────
const DEMO_ATTEMPTS: QuizAttempt[] = [
  { id: 'qa1', quiz_id: 'qz2', student_id: 's1', score: 3, total_questions: 3, percentage: 100, started_at: '2025-09-11T08:00:00Z', submitted_at: '2025-09-11T08:12:00Z' },
  { id: 'qa2', quiz_id: 'qz2', student_id: 's2', score: 2, total_questions: 3, percentage: 67, started_at: '2025-09-11T09:00:00Z', submitted_at: '2025-09-11T09:10:00Z' },
  { id: 'qa3', quiz_id: 'qz1', student_id: 's1', score: 4, total_questions: 5, percentage: 80, started_at: '2025-10-02T08:00:00Z', submitted_at: '2025-10-02T09:25:00Z' },
  { id: 'qa4', quiz_id: 'qz4', student_id: 's3', score: 2, total_questions: 3, percentage: 67, started_at: '2025-09-21T10:00:00Z', submitted_at: '2025-09-21T10:18:00Z' },
]

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    isDemoMode: true,
    initialized: false,
    loading: false,
    error: null as string | null,
    demoVersion: 0,

    quizzes: [] as Quiz[],
    questions: [] as QuizQuestion[],
    attempts: [] as QuizAttempt[],

    // Supabase caches
    sbQuizzes: [] as Quiz[],
    sbQuestions: [] as QuizQuestion[],
    sbAttempts: [] as QuizAttempt[],

    /** Current quiz being taken (in-progress) */
    currentQuizId: null as string | null,
    currentAnswers: {} as Record<string, 'a' | 'b' | 'c' | 'd'>,
    quizStartTime: null as string | null,
  }),

  getters: {
    /** All quizzes with computed metadata */
    allQuizzes(): QuizWithCourse[] {
      return this.quizzes.map(q => ({
        ...q,
        questionCount: this.questions.filter(qq => qq.quiz_id === q.id).length,
      }))
    },

    /** Quizzes for a specific course */
    quizzesByCourse(): (courseId: string) => Quiz[] {
      return (courseId: string) =>
        this.quizzes.filter(q => q.course_id === courseId)
    },

    /** Active quizzes for a specific course */
    activeQuizzesByCourse(): (courseId: string) => Quiz[] {
      return (courseId: string) =>
        this.quizzes.filter(q => q.course_id === courseId && q.is_active)
    },

    /** Questions for a specific quiz */
    questionsForQuiz(): (quizId: string) => QuizQuestion[] {
      return (quizId: string) =>
        this.questions.filter(q => q.quiz_id === quizId).sort((a, b) => a.urutan - b.urutan)
    },

    /** Student's attempts for a specific quiz */
    studentAttemptForQuiz(): (quizId: string, studentId: string) => QuizAttempt | undefined {
      return (quizId: string, studentId: string) =>
        this.attempts.find(a => a.quiz_id === quizId && a.student_id === studentId)
    },

    /** All attempts for a specific quiz (for instructors) */
    attemptsForQuiz(): (quizId: string) => QuizAttempt[] {
      return (quizId: string) =>
        this.attempts.filter(a => a.quiz_id === quizId)
    },

    /** All attempts by a student */
    attemptsByStudent(): (studentId: string) => (QuizAttempt & { quiz_title?: string })[] {
      return (studentId: string) =>
        this.attempts
          .filter(a => a.student_id === studentId)
          .map(a => {
            const quiz = this.quizzes.find(q => q.id === a.quiz_id)
            return { ...a, quiz_title: quiz?.judul }
          })
    },

    /** Whether a student has already attempted a quiz */
    hasAttempted(): (quizId: string, studentId: string) => boolean {
      return (quizId: string, studentId: string) =>
        !!this.attempts.find(a => a.quiz_id === quizId && a.student_id === studentId)
    },

    /** Current in-progress quiz session */
    currentQuiz(): Quiz | null {
      if (!this.currentQuizId) return null
      return this.quizzes.find(q => q.id === this.currentQuizId) || null
    },

    /** Number of answered questions in current session */
    answeredCount(): number {
      return Object.keys(this.currentAnswers).length
    },

    /** Total questions in current quiz */
    totalQuestionsCurrent(): number {
      if (!this.currentQuizId) return 0
      return this.questions.filter(q => q.quiz_id === this.currentQuizId).length
    },
  },

  actions: {
    /**
     * Initialize store: use demo data or fetch from Supabase in production mode.
     */
    async init() {
      if (this.initialized) return
      const config = useRuntimeConfig()
      this.isDemoMode = config.public.demoMode !== 'false'

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          this.loading = true

          // Fetch quizzes
          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('*')
            .order('created_at')

          if (quizzes) {
            this.sbQuizzes = quizzes as Quiz[]
          }

          // Fetch questions
          const { data: questions } = await supabase
            .from('quiz_questions')
            .select('*')
            .order('urutan')

          if (questions) {
            this.sbQuestions = questions as QuizQuestion[]
          }

          // Fetch attempts
          const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('*')
            .order('submitted_at', { ascending: false })

          if (attempts) {
            this.sbAttempts = attempts as QuizAttempt[]
          }
        } catch (err) {
          console.error('Failed to fetch quizzes from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      // Populate reactive state from either demo or Supabase sources
      const src = this.isDemoMode
        ? { quizzes: DEMO_QUIZZES, questions: DEMO_QUESTIONS, attempts: DEMO_ATTEMPTS }
        : { quizzes: this.sbQuizzes, questions: this.sbQuestions, attempts: this.sbAttempts }

      this.quizzes = src.quizzes
      this.questions = src.questions
      this.attempts = src.attempts
      this.initialized = true
    },

    /** Force re-sync reactive state from the active data source */
    _syncState() {
      if (this.isDemoMode) {
        // Demo arrays are mutated in-place; state arrays are references to them
        // We force reactivity by re-assigning
        this.quizzes = DEMO_QUIZZES
        this.questions = DEMO_QUESTIONS
        this.attempts = DEMO_ATTEMPTS
      } else {
        this.quizzes = [...this.sbQuizzes]
        this.questions = [...this.sbQuestions]
        this.attempts = [...this.sbAttempts]
      }
      this.demoVersion++
    },

    /** Get course name for a course ID */
    getCourseName(courseId: string): string {
      const names: Record<string, string> = {
        c1: 'Algoritma & Pemrograman',
        c2: 'Struktur Data',
        c3: 'Basis Data',
        c4: 'Pemrograman Web',
        c5: 'Jaringan Komputer',
      }
      return names[courseId] || courseId
    },

    /** Start a quiz attempt */
    startQuiz(quizId: string) {
      this.currentQuizId = quizId
      this.currentAnswers = {}
      this.quizStartTime = new Date().toISOString()
    },

    /** Answer a question */
    answerQuestion(questionId: string, jawaban: 'a' | 'b' | 'c' | 'd') {
      this.currentAnswers[questionId] = jawaban
      // Bump version for reactivity
      this.demoVersion++
    },

    /** Submit the quiz and auto-grade */
    submitQuiz(studentId: string): QuizAttempt | null {
      if (!this.currentQuizId) return null

      const quizQuestions = this.questions.filter(q => q.quiz_id === this.currentQuizId)
      let score = 0
      for (const q of quizQuestions) {
        const userAnswer = this.currentAnswers[q.id]
        if (userAnswer && userAnswer === q.jawaban_benar) {
          score++
        }
      }

      const now = new Date().toISOString()
      const attempt: QuizAttempt = {
        id: `qa${Date.now()}`,
        quiz_id: this.currentQuizId,
        student_id: studentId,
        score,
        total_questions: quizQuestions.length,
        percentage: quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0,
        started_at: this.quizStartTime || now,
        submitted_at: now,
      }

      this.attempts.push(attempt)
      this.demoVersion++

      // Reset current session
      this.currentQuizId = null
      this.currentAnswers = {}
      this.quizStartTime = null

      return attempt
    },

    /** Cancel current quiz */
    cancelQuiz() {
      this.currentQuizId = null
      this.currentAnswers = {}
      this.quizStartTime = null
    },

    // ── Instructor / Admin CRUD actions ──

    /** Add a new quiz */
    async addQuiz(quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>) {
      const now = new Date().toISOString()
      const newQuiz: Quiz = {
        ...quiz,
        id: `qz${Date.now()}`,
        created_at: now,
        updated_at: now,
      }

      if (this.isDemoMode) {
        DEMO_QUIZZES.push(newQuiz)
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          await supabase.from('quizzes').insert({
            course_id: quiz.course_id,
            instructor_id: quiz.instructor_id,
            judul: quiz.judul,
            deskripsi: quiz.deskripsi,
            time_limit_minutes: quiz.time_limit_minutes,
            passing_score: quiz.passing_score,
            is_active: quiz.is_active,
          })
          // Refresh quizzes from Supabase
          const { data } = await supabase.from('quizzes').select('*').order('created_at')
          if (data) this.sbQuizzes = data as Quiz[]
        } catch (err) {
          console.error('Failed to add quiz to Supabase:', err)
          return null
        }
      }

      this._syncState()
      return newQuiz
    },

    /** Update an existing quiz */
    async updateQuiz(quizId: string, data: QuizUpdateData) {
      if (this.isDemoMode) {
        const idx = DEMO_QUIZZES.findIndex(q => q.id === quizId)
        if (idx >= 0) {
          if (data.judul !== undefined) DEMO_QUIZZES[idx].judul = data.judul
          if (data.deskripsi !== undefined) DEMO_QUIZZES[idx].deskripsi = data.deskripsi
          if (data.time_limit_minutes !== undefined) DEMO_QUIZZES[idx].time_limit_minutes = data.time_limit_minutes
          if (data.passing_score !== undefined) DEMO_QUIZZES[idx].passing_score = data.passing_score
          if (data.is_active !== undefined) DEMO_QUIZZES[idx].is_active = data.is_active
          DEMO_QUIZZES[idx].updated_at = new Date().toISOString()
        }
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (data.judul !== undefined) payload.judul = data.judul
          if (data.deskripsi !== undefined) payload.deskripsi = data.deskripsi
          if (data.time_limit_minutes !== undefined) payload.time_limit_minutes = data.time_limit_minutes
          if (data.passing_score !== undefined) payload.passing_score = data.passing_score
          if (data.is_active !== undefined) payload.is_active = data.is_active

          await supabase.from('quizzes').update(payload).eq('id', quizId)

          const idx = this.sbQuizzes.findIndex(q => q.id === quizId)
          if (idx >= 0) Object.assign(this.sbQuizzes[idx], payload)
        } catch (err) {
          console.error('Failed to update quiz in Supabase:', err)
        }
      }

      this._syncState()
    },

    /** Toggle quiz active status */
    toggleQuizActive(quizId: string) {
      const q = this.quizzes.find(q => q.id === quizId)
      if (q) {
        q.is_active = !q.is_active
        q.updated_at = new Date().toISOString()
        if (!this.isDemoMode) {
          const supabase = useNuxtApp().$supabase
          supabase.from('quizzes').update({ is_active: q.is_active, updated_at: q.updated_at }).eq('id', quizId)
            .catch(err => console.error('Failed to toggle quiz in Supabase:', err))
        }
        this.demoVersion++
      }
    },

    /** Delete a quiz and its questions & attempts */
    async deleteQuiz(quizId: string) {
      if (this.isDemoMode) {
        const idx = DEMO_QUIZZES.findIndex(q => q.id === quizId)
        if (idx >= 0) DEMO_QUIZZES.splice(idx, 1)
        for (let i = DEMO_QUESTIONS.length - 1; i >= 0; i--) {
          if (DEMO_QUESTIONS[i].quiz_id === quizId) DEMO_QUESTIONS.splice(i, 1)
        }
        for (let i = DEMO_ATTEMPTS.length - 1; i >= 0; i--) {
          if (DEMO_ATTEMPTS[i].quiz_id === quizId) DEMO_ATTEMPTS.splice(i, 1)
        }
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          await supabase.from('quiz_answers').delete().eq('quiz_id', quizId)
          await supabase.from('quiz_attempts').delete().eq('quiz_id', quizId)
          await supabase.from('quiz_questions').delete().eq('quiz_id', quizId)
          await supabase.from('quizzes').delete().eq('id', quizId)

          this.sbQuizzes = this.sbQuizzes.filter(q => q.id !== quizId)
          this.sbQuestions = this.sbQuestions.filter(q => q.quiz_id !== quizId)
          this.sbAttempts = this.sbAttempts.filter(a => a.quiz_id !== quizId)
        } catch (err) {
          console.error('Failed to delete quiz from Supabase:', err)
        }
      }

      this._syncState()
    },

    /** Add a question to a quiz */
    async addQuestion(question: Omit<QuizQuestion, 'id' | 'created_at'>) {
      const newQ: QuizQuestion = {
        ...question,
        id: `qq${Date.now()}`,
        created_at: new Date().toISOString(),
      }

      if (this.isDemoMode) {
        DEMO_QUESTIONS.push(newQ)
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          await supabase.from('quiz_questions').insert({
            quiz_id: question.quiz_id,
            pertanyaan: question.pertanyaan,
            pilihan_a: question.pilihan_a,
            pilihan_b: question.pilihan_b,
            pilihan_c: question.pilihan_c,
            pilihan_d: question.pilihan_d,
            jawaban_benar: question.jawaban_benar,
            urutan: question.urutan,
          })
          const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', question.quiz_id).order('urutan')
          if (data) {
            // Replace questions for this quiz in sbQuestions
            this.sbQuestions = this.sbQuestions.filter(q => q.quiz_id !== question.quiz_id).concat(data as QuizQuestion[])
          }
        } catch (err) {
          console.error('Failed to add question to Supabase:', err)
          return null
        }
      }

      this._syncState()
      return newQ
    },

    /** Update an existing question */
    async updateQuestion(questionId: string, data: QuestionUpdateData) {
      if (this.isDemoMode) {
        const idx = DEMO_QUESTIONS.findIndex(q => q.id === questionId)
        if (idx >= 0) {
          if (data.pertanyaan !== undefined) DEMO_QUESTIONS[idx].pertanyaan = data.pertanyaan
          if (data.pilihan_a !== undefined) DEMO_QUESTIONS[idx].pilihan_a = data.pilihan_a
          if (data.pilihan_b !== undefined) DEMO_QUESTIONS[idx].pilihan_b = data.pilihan_b
          if (data.pilihan_c !== undefined) DEMO_QUESTIONS[idx].pilihan_c = data.pilihan_c
          if (data.pilihan_d !== undefined) DEMO_QUESTIONS[idx].pilihan_d = data.pilihan_d
          if (data.jawaban_benar !== undefined) DEMO_QUESTIONS[idx].jawaban_benar = data.jawaban_benar
          if (data.urutan !== undefined) DEMO_QUESTIONS[idx].urutan = data.urutan
        }
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          const payload: Record<string, unknown> = {}
          if (data.pertanyaan !== undefined) payload.pertanyaan = data.pertanyaan
          if (data.pilihan_a !== undefined) payload.pilihan_a = data.pilihan_a
          if (data.pilihan_b !== undefined) payload.pilihan_b = data.pilihan_b
          if (data.pilihan_c !== undefined) payload.pilihan_c = data.pilihan_c
          if (data.pilihan_d !== undefined) payload.pilihan_d = data.pilihan_d
          if (data.jawaban_benar !== undefined) payload.jawaban_benar = data.jawaban_benar
          if (data.urutan !== undefined) payload.urutan = data.urutan

          await supabase.from('quiz_questions').update(payload).eq('id', questionId)

          const idx = this.sbQuestions.findIndex(q => q.id === questionId)
          if (idx >= 0) Object.assign(this.sbQuestions[idx], payload)
        } catch (err) {
          console.error('Failed to update question in Supabase:', err)
        }
      }

      this._syncState()
    },

    /** Delete a question */
    async deleteQuestion(questionId: string) {
      if (this.isDemoMode) {
        const idx = DEMO_QUESTIONS.findIndex(q => q.id === questionId)
        if (idx >= 0) DEMO_QUESTIONS.splice(idx, 1)
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          await supabase.from('quiz_questions').delete().eq('id', questionId)
          this.sbQuestions = this.sbQuestions.filter(q => q.id !== questionId)
        } catch (err) {
          console.error('Failed to delete question from Supabase:', err)
        }
      }

      this._syncState()
    },
  },
})
