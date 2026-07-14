/**
 * Database type definitions matching the Supabase schema.
 * These represent the raw row types from PostgreSQL tables.
 */

export interface Profile {
  id: string
  role: 'student' | 'instructor'
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
