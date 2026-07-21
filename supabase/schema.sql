-- ============================================
-- LMS Mahasiswa — Database Schema
-- Supabase PostgreSQL
-- ============================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles (students + instructors)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
  nama VARCHAR(255) NOT NULL,
  npm VARCHAR(20) UNIQUE,                    -- only for students
  kelas VARCHAR(10),                         -- only for students (e.g. '1A', '2B')
  level INTEGER CHECK (level BETWEEN 1 AND 5), -- only for students
  session_time VARCHAR(10) CHECK (session_time IN ('morning', 'evening')), -- only for students
  email VARCHAR(255) UNIQUE,                 -- only for instructors
  avatar_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kode VARCHAR(20) NOT NULL UNIQUE,
  nama VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  session_time VARCHAR(10) NOT NULL CHECK (session_time IN ('morning', 'evening')),
  color VARCHAR(7),
  icon VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enrollments (student ↔ course)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

-- 4. Lessons
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  konten TEXT,
  video_url TEXT,
  materi_url TEXT,
  urutan INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, urutan)
);

-- 5. Lesson Progress (student ↔ lesson completion)
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, lesson_id)
);

-- 6. Assignments
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  tenggat_waktu TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Submissions (student → assignment)
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  jawaban TEXT,
  file_url TEXT,
  nilai INTEGER CHECK (nilai BETWEEN 0 AND 100),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

-- 8. Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  konten TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_npm ON profiles(npm);
CREATE INDEX idx_courses_level ON courses(level);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_lessons_course ON lessons(course_id);
CREATE INDEX idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX idx_assignments_course ON assignments(course_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_announcements_course ON announcements(course_id);

-- 9. Quizzes
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  passing_score INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  pertanyaan TEXT NOT NULL,
  pilihan_a VARCHAR(255) NOT NULL,
  pilihan_b VARCHAR(255) NOT NULL,
  pilihan_c VARCHAR(255) NOT NULL,
  pilihan_d VARCHAR(255) NOT NULL,
  jawaban_benar CHAR(1) NOT NULL CHECK (jawaban_benar IN ('a', 'b', 'c', 'd')),
  urutan INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  jawaban CHAR(1) NOT NULL CHECK (jawaban IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Academic Calendar Events
CREATE TABLE academic_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  tanggal_mulai TIMESTAMPTZ NOT NULL,
  tanggal_selesai TIMESTAMPTZ NOT NULL,
  tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('uts', 'uas', 'tugas', 'libur', 'acara')),
  color VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Attendance (Presensi)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(10) NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha')),
  pertemuan INTEGER NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, student_id, pertemuan)
);

CREATE INDEX idx_attendance_course ON attendance(course_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- Indexes for new tables
CREATE INDEX idx_quizzes_course ON quizzes(course_id);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX idx_quiz_answers_quiz ON quiz_answers(quiz_id);
CREATE INDEX idx_quiz_answers_question ON quiz_answers(question_id);
CREATE INDEX idx_academic_events_course ON academic_events(course_id);
CREATE INDEX idx_academic_events_date ON academic_events(tanggal_mulai);
