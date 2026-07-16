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
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
  nama VARCHAR(255) NOT NULL,
  npm VARCHAR(20) UNIQUE,
  kelas VARCHAR(10),
  level INTEGER CHECK (level BETWEEN 1 AND 4),
  session_time VARCHAR(10) CHECK (session_time IN ('morning', 'evening')),
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
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
-- Convention:
--   Demo accounts (is_demo=TRUE)  → short IDs (s1..s15, i1..i3, a1)
--   Real accounts (is_demo=FALSE) → proper UUIDs
-- ============================================

-- ───── A. DEMO ACCOUNTS  (is_demo = TRUE) ─────

-- Demo: Instructors
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('i1', 'instructor', 'Dr. Andi Wijaya, M.Kom.',   'andi@lms.ac.id',    TRUE),
  ('i2', 'instructor', 'Dr. Dewi Lestari, M.Pd.',   'dewi@lms.ac.id',    TRUE),
  ('i3', 'instructor', 'Prof. Budi Hartono, Ph.D.', 'budi@lms.ac.id',    TRUE);

-- Demo: Admin
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('a1', 'admin', 'Admin LMS', 'admin@lms.ac.id', TRUE);

-- Demo: Students
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time, is_demo) VALUES
  ('s1',  'student', 'Ahmad Fauzi',      '20241001', '1A', 1, 'morning', TRUE),
  ('s2',  'student', 'Budi Santoso',      '20241002', '1A', 1, 'morning', TRUE),
  ('s3',  'student', 'Citra Dewi',        '20241003', '1A', 1, 'morning', TRUE),
  ('s4',  'student', 'Dian Permata',      '20241004', '1B', 1, 'evening', TRUE),
  ('s5',  'student', 'Eka Putra',         '20241005', '1B', 1, 'evening', TRUE),
  ('s6',  'student', 'Fitri Handayani',   '20241006', '2A', 2, 'morning', TRUE),
  ('s7',  'student', 'Gilang Pratama',    '20241007', '2A', 2, 'morning', TRUE),
  ('s8',  'student', 'Hesti Wulandari',   '20241008', '2B', 2, 'evening', TRUE),
  ('s9',  'student', 'Irfan Hakim',       '20241009', '3A', 3, 'morning', TRUE),
  ('s10', 'student', 'Joko Susilo',       '20241010', '3A', 3, 'morning', TRUE),
  ('s11', 'student', 'Kartika Sari',      '20241011', '3B', 3, 'evening', TRUE),
  ('s12', 'student', 'Lintang Utami',     '20241012', '4A', 4, 'morning', TRUE),
  ('s13', 'student', 'Mega Puspita',      '20241013', '4A', 4, 'morning', TRUE),
  ('s14', 'student', 'Nanda Kusuma',      '20241014', '4B', 4, 'evening', TRUE),
  ('s15', 'student', 'Oscar Rafif',       '20241015', '4B', 4, 'evening', TRUE);

-- Demo: Courses
INSERT INTO courses (id, instructor_id, kode, nama, deskripsi, level, session_time, color, icon) VALUES
  ('c1',  'i1', 'MK101', 'Pemrograman Dasar',                 'Belajar dasar-dasar pemrograman dengan Python.', 1, 'morning', '#3b82f6', '💻'),
  ('c2',  'i2', 'MK102', 'Matematika Diskrit',                'Konsep matematika untuk ilmu komputer.',          1, 'morning', '#8b5cf6', '🔢'),
  ('c3',  'i3', 'MK103', 'Logika Informatika',                'Logika proposisional dan predikat.',               1, 'evening', '#ec4899', '🧠'),
  ('c4',  'i1', 'MK104', 'Pengantar TI',                      'Pengantar Teknologi Informasi.',                   1, 'evening', '#14b8a6', '🖥️'),
  ('c5',  'i1', 'MK201', 'Struktur Data',                     'Struktur data fundamental.',                       2, 'morning', '#f59e0b', '📊'),
  ('c6',  'i2', 'MK202', 'Basis Data',                        'Konsep database SQL dan NoSQL.',                   2, 'morning', '#10b981', '🗄️'),
  ('c7',  'i3', 'MK203', 'Pemrograman Web',                   'HTML, CSS, JavaScript.',                           2, 'evening', '#ef4444', '🌐'),
  ('c8',  'i1', 'MK301', 'Pemrograman Berorientasi Objek',    'OOP dengan Java.',                                 3, 'morning', '#6366f1', '📦'),
  ('c9',  'i2', 'MK302', 'Analisis dan Desain Sistem',        'SDLC, UML, perancangan sistem.',                   3, 'morning', '#a855f7', '📐'),
  ('c10', 'i3', 'MK303', 'Jaringan Komputer',                 'TCP/IP, routing, switching.',                      3, 'evening', '#06b6d4', '🌐'),
  ('c11', 'i1', 'MK401', 'Rekayasa Perangkat Lunak',          'Metodologi pengembangan perangkat lunak.',         4, 'morning', '#84cc16', '🛠️'),
  ('c12', 'i2', 'MK402', 'Kecerdasan Buatan',                 'Machine learning, NLP, AI.',                       4, 'morning', '#f97316', '🤖'),
  ('c13', 'i3', 'MK403', 'Keamanan Informasi',                'Kriptografi, ethical hacking.',                    4, 'evening', '#dc2626', '🔒');

-- Demo: Enrollments
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

-- Demo: Lessons (c1 & c2)
INSERT INTO lessons (id, course_id, judul, konten, urutan) VALUES
  ('l1', 'c1', 'Pengantar Pemrograman',  'Apa itu pemrograman?', 1),
  ('l2', 'c1', 'Variabel dan Tipe Data', 'Mengenal variabel dan tipe data.', 2),
  ('l3', 'c1', 'Percabangan (If-Else)',  'Logika percabangan.', 3),
  ('l4', 'c1', 'Perulangan (Looping)',   'For, while, do-while.', 4),
  ('l5', 'c2', 'Himpunan',              'Konsep dasar himpunan.', 1),
  ('l6', 'c2', 'Relasi dan Fungsi',     'Relasi dan fungsi dalam matematika.', 2);

-- Demo: Lesson Progress
INSERT INTO lesson_progress (student_id, lesson_id, completed, completed_at) VALUES
  ('s1', 'l1', TRUE,  NOW() - INTERVAL '3 days'),
  ('s1', 'l2', TRUE,  NOW() - INTERVAL '2 days'),
  ('s2', 'l1', TRUE,  NOW() - INTERVAL '1 day');

-- Demo: Assignments
INSERT INTO assignments (id, course_id, instructor_id, judul, deskripsi, tenggat_waktu) VALUES
  ('a1', 'c1', 'i1', 'Tugas 1: Hello World',          'Buat program Hello World dalam Python.',          NOW() + INTERVAL '7 days'),
  ('a2', 'c1', 'i1', 'Tugas 2: Kalkulator Sederhana', 'Buat kalkulator sederhana dengan Python.',        NOW() + INTERVAL '14 days'),
  ('a3', 'c2', 'i2', 'Tugas 1: Diagram Venn',          'Buat diagram Venn dari 3 himpunan.',              NOW() + INTERVAL '10 days'),
  ('a4', 'c5', 'i1', 'Tugas 1: Implementasi Array',    'Implementasikan operasi dasar array.',            NOW() + INTERVAL '30 days'),
  ('a5', 'c8', 'i1', 'Tugas 1: Class & Object',        'Buat class sederhana dengan enkapsulasi.',        NOW() + INTERVAL '45 days');

-- Demo: Submissions
INSERT INTO submissions (assignment_id, student_id, jawaban, submitted_at, nilai, feedback, graded_at) VALUES
  ('a1', 's1', 'print("Hello, World!")',             NOW() - INTERVAL '1 day', 90, 'Bagus! Codingan rapi.', NOW()),
  ('a1', 's2', 'print("Hello World")',               NOW() - INTERVAL '1 day', NULL, NULL, NULL),
  ('a2', 's1', '# Kalkulator sederhana\n...',         NOW() - INTERVAL '2 hours', NULL, NULL, NULL);


-- ───── B. REAL ACCOUNTS  (is_demo = FALSE) ─────
--    Production accounts — photos saved in DB.

-- Real: Instructors
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'instructor', 'Dr. Rina Marlina, S.Kom., M.TI.',  'rina@lms.ac.id',       FALSE),
  ('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'instructor', 'Dr. Hendra Gunawan, M.Eng.',       'hendra@lms.ac.id',     FALSE),
  ('550e8400-e29b-41d4-a716-446655440000', 'instructor', 'Prof. Siti Rahmawati, Ph.D.',       'siti@lms.ac.id',       FALSE);

-- Real: Admin
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'admin', 'Super Admin LMS', 'superadmin@lms.ac.id', FALSE);

-- Real: Students
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time, is_demo) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student', 'Aditya Pratama',     '20242001', '1A', 1, 'morning', FALSE),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'student', 'Bayu Aji Saputra',   '20242002', '1A', 1, 'morning', FALSE),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'student', 'Cindy Permata Sari', '20242003', '1B', 1, 'evening', FALSE),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'student', 'Dimas Ardiansyah',    '20242004', '2A', 2, 'morning', FALSE),
  ('e5f6a7b8-c9d0-1234-efab-345678901234', 'student', 'Elsa Febriyanti',     '20242005', '2B', 2, 'evening', FALSE),
  ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'student', 'Fajar Ramadhan',      '20242006', '3A', 3, 'morning', FALSE);

-- Real: Courses
INSERT INTO courses (id, instructor_id, kode, nama, deskripsi, level, session_time, color, icon) VALUES
  ('c101', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'MK501', 'Pembelajaran Mesin',      'Pengantar machine learning dengan Python.',        3, 'morning', '#7c3aed', '🤖'),
  ('c102', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'MK502', 'Sistem Terdistribusi',   'Konsep sistem terdistribusi dan cloud computing.', 4, 'morning', '#0891b2', '☁️'),
  ('c103', '550e8400-e29b-41d4-a716-446655440000', 'MK503', 'Pemrosesan Citra Digital', 'Teknik pemrosesan dan analisis citra.',            3, 'evening', '#d946ef', '🖼️');

-- Real: Enrollments
INSERT INTO enrollments (student_id, course_id) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c101'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'c101'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'c102'),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'c102'),
  ('e5f6a7b8-c9d0-1234-efab-345678901234', 'c103'),
  ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'c103');

-- Real: Lessons
INSERT INTO lessons (id, course_id, judul, konten, urutan) VALUES
  ('l101', 'c101', 'Pengantar Machine Learning', 'Apa itu ML? supervised vs unsupervised.', 1),
  ('l102', 'c101', 'Regresi Linear',             'Konsep regresi linear dan implementasi.',  2),
  ('l103', 'c102', 'Arsitektur Microservices',   'Pola arsitektur microservices.',           1),
  ('l104', 'c103', 'Pengolahan Citra',           'Dasar-dasar pengolahan citra digital.',    1);

-- Real: Assignments
INSERT INTO assignments (id, course_id, instructor_id, judul, deskripsi, tenggat_waktu) VALUES
  ('a101', 'c101', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Tugas 1: Klasifikasi',  'Buat model klasifikasi sederhana dengan Scikit-Learn.', NOW() + INTERVAL '14 days'),
  ('a102', 'c102', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'Tugas 1: REST API',     'Buat REST API sederhana dengan Node.js.',                NOW() + INTERVAL '10 days');

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
