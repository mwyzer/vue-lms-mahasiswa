/**
 * Database type definitions matching the Supabase schema.
 * These represent the raw row types from PostgreSQL tables.
 */

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
  created_at: string
  updated_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  jawaban?: string | null
  file_url?: string | null
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
