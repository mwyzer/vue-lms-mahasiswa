-- ============================================
-- Seed: Level 5 Courses + Admin Fix
-- Jalankan di Supabase Dashboard → SQL Editor
--
-- NOTES:
-- ✅ Courses c14 (MK501), c15 (MK502) already seeded at level 4 via REST API
-- ✅ Lessons l20-l26 already seeded via REST API
-- ✅ Admin a1 already seeded as 'instructor' role (temp workaround)
-- 🔄 Run this script to: fix constraints, upgrade to level 5, add students
-- ============================================

-- 1. Fix: Izinkan level 1-5 di tabel courses
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE courses ADD CONSTRAINT courses_level_check
  CHECK (level BETWEEN 1 AND 5);

-- 2. Fix: Tambahkan role 'admin' & izinkan level 1-5 di tabel profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'instructor', 'admin'));
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_level_check
  CHECK (level BETWEEN 1 AND 5);

-- 3. Update: Ubah courses c14, c15 dari level 4 ke level 5
UPDATE courses SET level = 5 WHERE id IN ('c14', 'c15');

-- 4. Update: Admin a1 dari 'instructor' ke 'admin'
UPDATE profiles SET role = 'admin' WHERE id = 'a1';

-- 5. Seed: Students level 5 (jika belum ada)
INSERT INTO profiles (id, role, nama, npm, level, session_time, kelas)
VALUES
  ('s16', 'student', 'Putri Anggraini',  '20251001', 5, 'morning', '5A'),
  ('s17', 'student', 'Rizky Firmansyah', '20251002', 5, 'evening', '5B')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed: Enrollments untuk s16 & s17
INSERT INTO enrollments (student_id, course_id)
VALUES
  ('s16', 'c14'), ('s16', 'c15'),
  ('s17', 'c14'), ('s17', 'c15')
ON CONFLICT (student_id, course_id) DO NOTHING;
