-- ============================================
-- LMS Mahasiswa — Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================
-- Students: can read own profile
CREATE POLICY "Students read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id AND role = 'student');

-- Instructors: can read all profiles (to see student rosters)
CREATE POLICY "Instructors read all profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'instructor'
  ));

-- ============================================
-- COURSES
-- ============================================
-- Students: can read courses they are enrolled in
CREATE POLICY "Students read enrolled courses"
  ON courses FOR SELECT
  USING (id IN (
    SELECT course_id FROM enrollments WHERE student_id = auth.uid()
  ));

-- Instructors: can CRUD their own courses
CREATE POLICY "Instructors insert courses"
  ON courses FOR INSERT
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors update own courses"
  ON courses FOR UPDATE
  USING (instructor_id = auth.uid());

CREATE POLICY "Instructors delete own courses"
  ON courses FOR DELETE
  USING (instructor_id = auth.uid());

CREATE POLICY "Instructors read own courses"
  ON courses FOR SELECT
  USING (instructor_id = auth.uid());

-- ============================================
-- ENROLLMENTS
-- ============================================
-- Students: can read own enrollments
CREATE POLICY "Students read own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

-- Instructors: can read enrollments for their courses
CREATE POLICY "Instructors read course enrollments"
  ON enrollments FOR SELECT
  USING (course_id IN (
    SELECT id FROM courses WHERE instructor_id = auth.uid()
  ));

-- ============================================
-- LESSONS
-- ============================================
-- Students: can read lessons for enrolled courses
CREATE POLICY "Students read course lessons"
  ON lessons FOR SELECT
  USING (course_id IN (
    SELECT course_id FROM enrollments WHERE student_id = auth.uid()
  ));

-- Instructors: can CRUD lessons for own courses
CREATE POLICY "Instructors manage lessons"
  ON lessons FOR ALL
  USING (course_id IN (
    SELECT id FROM courses WHERE instructor_id = auth.uid()
  ));

-- ============================================
-- LESSON PROGRESS
-- ============================================
-- Students: can read and update own progress
CREATE POLICY "Students manage own progress"
  ON lesson_progress FOR ALL
  USING (student_id = auth.uid());

-- Instructors: can read progress for their courses' lessons
CREATE POLICY "Instructors read lesson progress"
  ON lesson_progress FOR SELECT
  USING (lesson_id IN (
    SELECT id FROM lessons WHERE course_id IN (
      SELECT id FROM courses WHERE instructor_id = auth.uid()
    )
  ));

-- ============================================
-- ASSIGNMENTS
-- ============================================
-- Students: can read assignments for enrolled courses
CREATE POLICY "Students read course assignments"
  ON assignments FOR SELECT
  USING (course_id IN (
    SELECT course_id FROM enrollments WHERE student_id = auth.uid()
  ));

-- Instructors: can CRUD own assignments
CREATE POLICY "Instructors manage assignments"
  ON assignments FOR ALL
  USING (instructor_id = auth.uid());

-- ============================================
-- SUBMISSIONS
-- ============================================
-- Students: can CRUD own submissions
CREATE POLICY "Students manage own submissions"
  ON submissions FOR ALL
  USING (student_id = auth.uid());

-- Instructors: can read + grade submissions for their assignments
CREATE POLICY "Instructors read submissions"
  ON submissions FOR SELECT
  USING (assignment_id IN (
    SELECT id FROM assignments WHERE instructor_id = auth.uid()
  ));

CREATE POLICY "Instructors grade submissions"
  ON submissions FOR UPDATE
  USING (assignment_id IN (
    SELECT id FROM assignments WHERE instructor_id = auth.uid()
  ));

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
-- Students: can read announcements for enrolled courses
CREATE POLICY "Students read course announcements"
  ON announcements FOR SELECT
  USING (course_id IN (
    SELECT course_id FROM enrollments WHERE student_id = auth.uid()
  ));

-- Instructors: can CRUD own announcements
CREATE POLICY "Instructors manage announcements"
  ON announcements FOR ALL
  USING (instructor_id = auth.uid());
