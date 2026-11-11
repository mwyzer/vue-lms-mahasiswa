/**
 * Database type definitions matching the Supabase schema.
 * These represent the raw row types from PostgreSQL tables.
 */

/** Campus — institution/branch a user or course belongs to (multi-campus). */
export interface Campus {
  id: string
  kode: string
  nama: string
  alamat?: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  role: 'student' | 'instructor' | 'admin'
  nama: string
  npm?: string | null
  kelas?: string | null
  level?: number | null
  session_time?: string | null
  email?: string | null
  avatar_url?: string | null
  campus_id?: string | null
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  instructor_id: string
  kode: string
  nama: string
  deskripsi?: string | null
  level: number
  session_time: 'morning' | 'evening'
  color?: string | null
  icon?: string | null
  campus_id?: string | null
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  student_id: string
  course_id: string
  enrolled_at: string
}

export interface Lesson {
  id: string
  course_id: string
  judul: string
  konten?: string | null
  video_url?: string | null
  materi_url?: string | null
  urutan: number
  created_at: string
  updated_at: string
}

export interface LessonProgress {
  id: string
  student_id: string
  lesson_id: string
  completed: boolean
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  course_id: string
  instructor_id: string
  judul: string
  deskripsi?: string | null
  tenggat_waktu?: string | null
  /** Optional reference file attached to the assignment brief. */
  file_url?: string | null
  file_name?: string | null
  created_at: string
  updated_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  jawaban?: string | null
  file_url?: string | null
  file_name?: string | null
  nilai?: number | null
  feedback?: string | null
  submitted_at: string
  graded_at?: string | null
}

export interface Announcement {
  id: string
  course_id: string
  instructor_id: string
  judul: string
  konten: string
  created_at: string
  updated_at: string
}

/** Quiz & QuizQuestion — interactive quiz system */
export interface Quiz {
  id: string
  course_id: string
  instructor_id: string
  judul: string
  deskripsi?: string | null
  time_limit_minutes: number
  passing_score: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  pertanyaan: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  jawaban_benar: 'a' | 'b' | 'c' | 'd'
  urutan: number
  created_at: string
}

export interface QuizAnswer {
  id: string
  quiz_id: string
  student_id: string
  question_id: string
  jawaban: 'a' | 'b' | 'c' | 'd'
  is_correct: boolean
  submitted_at: string
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  student_id: string
  score: number
  total_questions: number
  percentage: number
  started_at: string
  submitted_at: string
}

/** Attendance — student attendance/presensi records */
export interface Attendance {
  id: string
  course_id: string
  student_id: string
  instructor_id: string
  tanggal: string
  status: 'hadir' | 'izin' | 'sakit' | 'alpha'
  pertemuan: number
  keterangan?: string | null
  created_at: string
  updated_at: string
}

/** AcademicEvent — academic calendar events */
export interface AcademicEvent {
  id: string
  course_id?: string | null
  judul: string
  deskripsi?: string | null
  kelas?: string | null
  class_name?: string | null
  tanggal_mulai: string
  tanggal_selesai: string
  tipe: 'uts' | 'uas' | 'tugas' | 'libur' | 'acara'
  color?: string | null
  created_at: string
  updated_at: string
}

/** In-app notification (notification center). */
export type NotificationType = 'tugas' | 'nilai' | 'pengumuman' | 'forum' | 'deadline' | 'sistem'

export interface AppNotification {
  id: string
  user_id: string
  tipe: NotificationType
  judul: string
  pesan?: string | null
  /** In-app route to open when the notification is clicked. */
  link?: string | null
  /** Prevents duplicates (e.g. one deadline reminder per assignment). */
  dedupe_key?: string | null
  read_at?: string | null
  created_at: string
}

/** Forum diskusi — thread per mata kuliah (opsional terkait satu materi). */
export interface ForumThread {
  id: string
  course_id: string
  lesson_id?: string | null
  author_id: string
  judul: string
  konten: string
  is_pinned: boolean
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface ForumReply {
  id: string
  thread_id: string
  author_id: string
  konten: string
  /** Marked by the instructor as the accepted answer. */
  is_answer: boolean
  created_at: string
}

/** Gradebook — bobot komponen nilai per mata kuliah (total 100). */
export interface GradeWeights {
  course_id: string
  bobot_tugas: number
  bobot_kuis: number
  bobot_presensi: number
  bobot_uts: number
  bobot_uas: number
  updated_at?: string
}

/** Nilai UTS/UAS yang diinput manual oleh instruktur. */
export interface ExamScore {
  id: string
  course_id: string
  student_id: string
  tipe: 'uts' | 'uas'
  nilai: number
  updated_at?: string
}
