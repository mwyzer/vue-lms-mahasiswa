-- ============================================
-- LMS Mahasiswa — Add Missing Tables & Constraints
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/fmibyazumfxrgcehojys/sql/new
-- ============================================

-- 0. Drop tables from previous failed attempts (they may have wrong column types)
DROP TABLE IF EXISTS quiz_answers CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS academic_events CASCADE;

-- 0b. Fix constraints (role → add admin, level → 5)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'instructor', 'admin'));
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_level_check CHECK (level BETWEEN 1 AND 5);
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE courses ADD CONSTRAINT courses_level_check CHECK (level BETWEEN 1 AND 5);

-- 1. Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  passing_score INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL,
  pertanyaan TEXT NOT NULL,
  pilihan_a VARCHAR(255) NOT NULL,
  pilihan_b VARCHAR(255) NOT NULL,
  pilihan_c VARCHAR(255) NOT NULL,
  pilihan_d VARCHAR(255) NOT NULL,
  jawaban_benar CHAR(1) NOT NULL CHECK (jawaban_benar IN ('a', 'b', 'c', 'd')),
  urutan INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL,
  student_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Quiz Answers
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL,
  student_id TEXT NOT NULL,
  question_id UUID NOT NULL,
  jawaban CHAR(1) NOT NULL CHECK (jawaban IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Academic Events
CREATE TABLE IF NOT EXISTS academic_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id TEXT,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  tanggal_mulai TIMESTAMPTZ NOT NULL,
  tanggal_selesai TIMESTAMPTZ NOT NULL,
  tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('uts', 'uas', 'tugas', 'libur', 'acara')),
  color VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(10) NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha')),
  pertemuan INTEGER NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, student_id, pertemuan)
);

-- 7. Add foreign key constraints (separately to detect type mismatches)
ALTER TABLE quizzes ADD CONSTRAINT quizzes_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE quizzes ADD CONSTRAINT quizzes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_answers ADD CONSTRAINT quiz_answers_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
ALTER TABLE quiz_answers ADD CONSTRAINT quiz_answers_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_answers ADD CONSTRAINT quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
ALTER TABLE academic_events ADD CONSTRAINT academic_events_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT attendance_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT attendance_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 9. Enable RLS on new tables
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies — Allow all (auth handled at app level via custom cookie auth)
CREATE POLICY "Allow all on quizzes" ON quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quiz_questions" ON quiz_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quiz_attempts" ON quiz_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on quiz_answers" ON quiz_answers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on academic_events" ON academic_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- 11. Update existing level-5 courses — now that constraint allows 5
-- These were seeded at level 4 as workaround; now move to level 5
UPDATE courses SET level = 5 WHERE kode IN ('MK501', 'MK502') AND level = 4;

-- 12. Update admin role (was seeded as 'instructor' workaround)
UPDATE profiles SET role = 'admin' WHERE id = 'a1' AND role = 'instructor';

-- 13. Insert students s16, s17 (now that level constraint allows 5)
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time)
VALUES
  ('s16', 'student', 'Rina Wijaya', '20253016', 'A', 5, 'morning'),
  ('s17', 'student', 'Dewi Lestari', '20253017', 'B', 5, 'evening')
ON CONFLICT (id) DO NOTHING;

-- 14. Enroll s16, s17 in level-5 courses
INSERT INTO enrollments (student_id, course_id)
SELECT p.id, c.id
FROM (SELECT id FROM profiles WHERE id IN ('s16', 's17')) p
CROSS JOIN (SELECT id FROM courses WHERE kode IN ('MK501', 'MK502')) c
ON CONFLICT DO NOTHING;

-- 15. Also ensure s15 (already seeded) is enrolled in level-5 courses
INSERT INTO enrollments (student_id, course_id)
SELECT p.id, c.id
FROM (SELECT id FROM profiles WHERE id = 's15') p
CROSS JOIN (SELECT id FROM courses WHERE kode IN ('MK501', 'MK502')) c
ON CONFLICT DO NOTHING;
