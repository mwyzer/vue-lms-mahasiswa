-- ============================================
-- LMS Mahasiswa — Complete Database Setup
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables (safe for re-run)
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS lesson_progress CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 1. TABLES
-- ============================================

-- Profiles (students + instructors)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor')),
  nama VARCHAR(255) NOT NULL,
  npm VARCHAR(20) UNIQUE,
  kelas VARCHAR(10),
  level INTEGER CHECK (level BETWEEN 1 AND 4),
  session_time VARCHAR(10) CHECK (session_time IN ('morning', 'evening')),
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courses
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kode VARCHAR(20) NOT NULL UNIQUE,
  nama VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  session_time VARCHAR(10) NOT NULL CHECK (session_time IN ('morning', 'evening')),
  color VARCHAR(7),
  icon VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enrollments (student ↔ course)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

-- Lessons
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  konten TEXT,
  video_url TEXT,
  materi_url TEXT,
  urutan INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, urutan)
);

-- Lesson Progress (student ↔ lesson completion)
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, lesson_id)
);

-- Assignments
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  tenggat_waktu TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions (student → assignment)
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  jawaban TEXT,
  file_url TEXT,
  nilai INTEGER CHECK (nilai BETWEEN 0 AND 100),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  konten TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_npm ON profiles(npm);
CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id);

-- ============================================
-- 2. SEED DATA
-- ============================================

-- Instructors
INSERT INTO profiles (id, role, nama, email) VALUES
  ('i1', 'instructor', 'Dr. Andi Wijaya, M.Kom.', 'andi@lms.ac.id'),
  ('i2', 'instructor', 'Dr. Dewi Lestari, M.Pd.', 'dewi@lms.ac.id'),
  ('i3', 'instructor', 'Prof. Budi Hartono, Ph.D.', 'budi@lms.ac.id');

-- Students
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time) VALUES
  ('s1',  'student', 'Ahmad Fauzi',      '20241001', '1A', 1, 'morning'),
  ('s2',  'student', 'Budi Santoso',      '20241002', '1A', 1, 'morning'),
  ('s3',  'student', 'Citra Dewi',        '20241003', '1A', 1, 'morning'),
  ('s4',  'student', 'Dian Permata',      '20241004', '1B', 1, 'evening'),
  ('s5',  'student', 'Eka Putra',         '20241005', '1B', 1, 'evening'),
  ('s6',  'student', 'Fitri Handayani',   '20241006', '2A', 2, 'morning'),
  ('s7',  'student', 'Gilang Pratama',    '20241007', '2A', 2, 'morning'),
  ('s8',  'student', 'Hesti Wulandari',   '20241008', '2B', 2, 'evening'),
  ('s9',  'student', 'Irfan Hakim',       '20241009', '3A', 3, 'morning'),
  ('s10', 'student', 'Joko Susilo',       '20241010', '3A', 3, 'morning'),
  ('s11', 'student', 'Kartika Sari',      '20241011', '3B', 3, 'evening'),
  ('s12', 'student', 'Lintang Utami',     '20241012', '4A', 4, 'morning'),
  ('s13', 'student', 'Mega Puspita',      '20241013', '4A', 4, 'morning'),
  ('s14', 'student', 'Nanda Kusuma',      '20241014', '4B', 4, 'evening'),
  ('s15', 'student', 'Oscar Rafif',       '20241015', '4B', 4, 'evening');

-- Courses
INSERT INTO courses (id, instructor_id, kode, nama, deskripsi, level, session_time, color, icon) VALUES
  ('c1',  'i1', 'MK101', 'Pemrograman Dasar',                 'Belajar dasar-dasar pemrograman dengan Python.', 1, 'morning', '#3b82f6', '💻'),
  ('c2',  'i2', 'MK102', 'Matematika Diskrit',                'Konsep matematika untuk ilmu komputer.', 1, 'morning', '#8b5cf6', '🔢'),
  ('c3',  'i3', 'MK103', 'Logika Informatika',                'Logika proposisional dan predikat.', 1, 'evening', '#ec4899', '🧠'),
  ('c4',  'i1', 'MK104', 'Pengantar TI',                      'Pengantar Teknologi Informasi.', 1, 'evening', '#14b8a6', '🖥️'),
  ('c5',  'i1', 'MK201', 'Struktur Data',                     'Struktur data fundamental.', 2, 'morning', '#f59e0b', '📊'),
  ('c6',  'i2', 'MK202', 'Basis Data',                        'Konsep database SQL dan NoSQL.', 2, 'morning', '#10b981', '🗄️'),
  ('c7',  'i3', 'MK203', 'Pemrograman Web',                   'HTML, CSS, JavaScript.', 2, 'evening', '#ef4444', '🌐'),
  ('c8',  'i1', 'MK301', 'Pemrograman Berorientasi Objek',    'OOP dengan Java.', 3, 'morning', '#6366f1', '📦'),
  ('c9',  'i2', 'MK302', 'Analisis dan Desain Sistem',        'SDLC, UML, perancangan sistem.', 3, 'morning', '#a855f7', '📐'),
  ('c10', 'i3', 'MK303', 'Jaringan Komputer',                 'TCP/IP, routing, switching.', 3, 'evening', '#06b6d4', '🌐'),
  ('c11', 'i1', 'MK401', 'Rekayasa Perangkat Lunak',          'Metodologi pengembangan perangkat lunak.', 4, 'morning', '#84cc16', '🛠️'),
  ('c12', 'i2', 'MK402', 'Kecerdasan Buatan',                 'Machine learning, NLP, AI.', 4, 'morning', '#f97316', '🤖'),
  ('c13', 'i3', 'MK403', 'Keamanan Informasi',                'Kriptografi, ethical hacking.', 4, 'evening', '#dc2626', '🔒');

-- Enrollments (student → courses)
INSERT INTO enrollments (student_id, course_id) VALUES
  ('s1',  'c1'), ('s1',  'c2'),
  ('s2',  'c1'), ('s2',  'c2'),
  ('s3',  'c1'), ('s3',  'c2'),
  ('s4',  'c3'), ('s4',  'c4'),
  ('s5',  'c3'), ('s5',  'c4'),
  ('s6',  'c5'), ('s6',  'c6'),
  ('s7',  'c5'), ('s7',  'c6'),
  ('s8',  'c7'),
  ('s9',  'c8'), ('s9',  'c9'),
  ('s10', 'c8'), ('s10', 'c9'),
  ('s11', 'c10'),
  ('s12', 'c11'), ('s12', 'c12'),
  ('s13', 'c11'), ('s13', 'c12'),
  ('s14', 'c13'),
  ('s15', 'c13');

-- Lessons (c1: 4 lessons, c2: 2 lessons)
INSERT INTO lessons (id, course_id, judul, konten, urutan) VALUES
  ('l1', 'c1', 'Pengantar Pemrograman',  'Apa itu pemrograman?', 1),
  ('l2', 'c1', 'Variabel dan Tipe Data', 'Mengenal variabel dan tipe data.', 2),
  ('l3', 'c1', 'Percabangan (If-Else)',  'Logika percabangan.', 3),
  ('l4', 'c1', 'Perulangan (Looping)',   'For, while, do-while.', 4),
  ('l5', 'c2', 'Himpunan',              'Konsep dasar himpunan.', 1),
  ('l6', 'c2', 'Relasi dan Fungsi',     'Relasi dan fungsi dalam matematika.', 2);

-- Lesson Progress (sample completions)
INSERT INTO lesson_progress (student_id, lesson_id, completed, completed_at) VALUES
  ('s1', 'l1', TRUE,  NOW() - INTERVAL '3 days'),
  ('s1', 'l2', TRUE,  NOW() - INTERVAL '2 days'),
  ('s2', 'l1', TRUE,  NOW() - INTERVAL '1 day');

-- Assignments (5 assignments across courses)
INSERT INTO assignments (id, course_id, instructor_id, judul, deskripsi, tenggat_waktu) VALUES
  ('a1', 'c1', 'i1', 'Tugas 1: Hello World',        'Buat program Hello World dalam Python.',        NOW() + INTERVAL '7 days'),
  ('a2', 'c1', 'i1', 'Tugas 2: Kalkulator Sederhana', 'Buat kalkulator sederhana dengan Python.',     NOW() + INTERVAL '14 days'),
  ('a3', 'c2', 'i2', 'Tugas 1: Diagram Venn',        'Buat diagram Venn dari 3 himpunan.',            NOW() + INTERVAL '10 days'),
  ('a4', 'c5', 'i1', 'Tugas 1: Implementasi Array',  'Implementasikan operasi dasar array.',          NOW() + INTERVAL '30 days'),
  ('a5', 'c8', 'i1', 'Tugas 1: Class & Object',      'Buat class sederhana dengan enkapsulasi.',      NOW() + INTERVAL '45 days');

-- Submissions (sample)
INSERT INTO submissions (assignment_id, student_id, jawaban, submitted_at, nilai, feedback, graded_at) VALUES
  ('a1', 's1', 'print("Hello, World!")',             NOW() - INTERVAL '1 day', 90, 'Bagus! Codingan rapi.', NOW()),
  ('a1', 's2', 'print("Hello World")',               NOW() - INTERVAL '1 day', NULL, NULL, NULL),
  ('a2', 's1', '# Kalkulator sederhana\n...',         NOW() - INTERVAL '2 hours', NULL, NULL, NULL);

-- ============================================
-- 3. RLS POLICIES (permissive — app manages auth)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated requests (app-level auth, not Supabase Auth)
CREATE POLICY "Allow all reads" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON courses FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON enrollments FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON lessons FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON lesson_progress FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON assignments FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON submissions FOR SELECT USING (true);
CREATE POLICY "Allow all reads" ON announcements FOR SELECT USING (true);

-- Allow inserts/updates/deletes (app manages permissions)
CREATE POLICY "Allow all inserts" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON profiles FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON courses FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON courses FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all deletes" ON enrollments FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON lessons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON lessons FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON lessons FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON lesson_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON lesson_progress FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON lesson_progress FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON assignments FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON assignments FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON submissions FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON submissions FOR DELETE USING (true);

CREATE POLICY "Allow all inserts" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON announcements FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON announcements FOR DELETE USING (true);
