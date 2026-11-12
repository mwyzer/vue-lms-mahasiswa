-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 3 (W3)
--   Rubrik penilaian per tugas + peer review anonim
--
-- Jalankan SETELAH schema.sql, policies.sql, migration-prioritas-1.sql
-- (butuh helper current_profile_id / is_course_member / is_course_staff
-- dan tabel notifications). Aman dijalankan ulang (idempotent).
--
-- Tabel:
--   rubrics          — satu rubrik per tugas + pengaturan peer review
--   rubric_criteria  — kriteria (nama, bobot %)
--   rubric_levels    — level deskriptor per kriteria (label, poin)
--   rubric_scores    — level yang dipilih dosen per (submission, kriteria)
--   peer_reviews     — penugasan + hasil review antar mahasiswa
--
-- Anonimitas: mahasiswa TIDAK bisa SELECT submissions milik orang lain maupun
-- reviewer_id review atas jawabannya. Keduanya diberikan lewat fungsi
-- SECURITY DEFINER yang tidak mengembalikan kolom identitas:
--   get_peer_review_tasks()      — jawaban yang harus direview (tanpa student_id)
--   get_received_peer_reviews()  — review atas jawaban sendiri (tanpa reviewer_id)
-- ============================================

-- ────────────────────────────────────────────
-- 0. Helper
-- ────────────────────────────────────────────

/** course_id dari sebuah tugas (SECURITY DEFINER → tidak kena rekursi RLS). */
CREATE OR REPLACE FUNCTION public.assignment_course_id(p_assignment_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT course_id FROM assignments WHERE id = p_assignment_id;
$$;

CREATE OR REPLACE FUNCTION public.rubric_course_id(p_rubric_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.course_id FROM rubrics r JOIN assignments a ON a.id = r.assignment_id WHERE r.id = p_rubric_id;
$$;

CREATE OR REPLACE FUNCTION public.criterion_course_id(p_criterion_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.course_id
  FROM rubric_criteria c
  JOIN rubrics r ON r.id = c.rubric_id
  JOIN assignments a ON a.id = r.assignment_id
  WHERE c.id = p_criterion_id;
$$;

CREATE OR REPLACE FUNCTION public.submission_course_id(p_submission_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.course_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = p_submission_id;
$$;

CREATE OR REPLACE FUNCTION public.is_submission_owner(p_submission_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM submissions s WHERE s.id = p_submission_id AND s.student_id = public.current_profile_id());
$$;

-- ============================================
-- 1. TABEL
-- ============================================

CREATE TABLE IF NOT EXISTS rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Peer review
  peer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  peer_reviewers INTEGER NOT NULL DEFAULT 2 CHECK (peer_reviewers BETWEEN 1 AND 5),
  peer_deadline TIMESTAMPTZ,
  peer_weight INTEGER NOT NULL DEFAULT 20 CHECK (peer_weight BETWEEN 0 AND 30),
  peer_assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rubrics_peer_deadline_required CHECK (NOT peer_enabled OR peer_deadline IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  nama VARCHAR(120) NOT NULL CHECK (length(trim(nama)) > 0),
  deskripsi TEXT CHECK (deskripsi IS NULL OR length(deskripsi) <= 500),
  bobot INTEGER NOT NULL CHECK (bobot BETWEEN 1 AND 100),
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Total bobot = 100 divalidasi di aplikasi (shared/rubric.ts → validateRubricCriteria),
-- karena kriteria disimpan baris per baris.

CREATE TABLE IF NOT EXISTS rubric_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  criterion_id UUID NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL CHECK (length(trim(label)) > 0),
  deskripsi TEXT CHECK (deskripsi IS NULL OR length(deskripsi) <= 500),
  poin NUMERIC(6,2) NOT NULL CHECK (poin BETWEEN 0 AND 1000),
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubric_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES rubric_levels(id) ON DELETE CASCADE,
  poin NUMERIC(6,2) NOT NULL,
  graded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'submitted')),
  selections JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { criterion_id: level_id }
  komentar TEXT CHECK (komentar IS NULL OR length(komentar) <= 2000),
  skor NUMERIC(5,1) CHECK (skor IS NULL OR skor BETWEEN 0 AND 100),
  override_skor NUMERIC(5,1) CHECK (override_skor IS NULL OR override_skor BETWEEN 0 AND 100),
  override_note TEXT CHECK (override_note IS NULL OR length(override_note) <= 500),
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON rubric_criteria(rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubric_levels_criterion ON rubric_levels(criterion_id);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_submission ON rubric_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_assignment ON peer_reviews(assignment_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON peer_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_submission ON peer_reviews(submission_id);

-- ── Integritas peer review ──
-- (1) Reviewer bukan pemilik jawaban dan submission milik tugas yang sama.
-- (2) Mahasiswa (bukan staf) hanya boleh mengubah selections/komentar/skor/status
--     miliknya sendiri, dan hanya sebelum tenggat review.
CREATE OR REPLACE FUNCTION public.peer_reviews_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_assignment UUID;
  v_deadline TIMESTAMPTZ;
BEGIN
  SELECT student_id, assignment_id INTO v_owner, v_assignment FROM submissions WHERE id = NEW.submission_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Submission tidak ditemukan'; END IF;
  IF v_owner = NEW.reviewer_id THEN RAISE EXCEPTION 'Mahasiswa tidak boleh mereview jawabannya sendiri'; END IF;
  IF v_assignment <> NEW.assignment_id THEN RAISE EXCEPTION 'Submission bukan milik tugas ini'; END IF;

  IF TG_OP = 'UPDATE' AND NOT public.is_course_staff(public.assignment_course_id(OLD.assignment_id)) THEN
    -- Kolom yang dikunci untuk mahasiswa.
    NEW.assignment_id := OLD.assignment_id;
    NEW.submission_id := OLD.submission_id;
    NEW.reviewer_id := OLD.reviewer_id;
    NEW.override_skor := OLD.override_skor;
    NEW.override_note := OLD.override_note;
    NEW.excluded := OLD.excluded;
    NEW.created_at := OLD.created_at;

    SELECT peer_deadline INTO v_deadline FROM rubrics WHERE assignment_id = OLD.assignment_id;
    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
      RAISE EXCEPTION 'Tenggat peer review sudah lewat';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_peer_reviews_guard ON peer_reviews;
CREATE TRIGGER trg_peer_reviews_guard
  BEFORE INSERT OR UPDATE ON peer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.peer_reviews_guard();

-- ============================================
-- 2. RLS
-- ============================================

ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;

-- Rubrik: dibaca anggota mata kuliah (mahasiswa melihat rubrik sebelum mengumpulkan), dikelola staf.
DROP POLICY IF EXISTS "Members read rubrics" ON rubrics;
CREATE POLICY "Members read rubrics"
  ON rubrics FOR SELECT USING (public.is_course_member(public.assignment_course_id(assignment_id)));

DROP POLICY IF EXISTS "Staff manage rubrics" ON rubrics;
CREATE POLICY "Staff manage rubrics"
  ON rubrics FOR ALL
  USING (public.is_course_staff(public.assignment_course_id(assignment_id)))
  WITH CHECK (public.is_course_staff(public.assignment_course_id(assignment_id)));

DROP POLICY IF EXISTS "Members read rubric criteria" ON rubric_criteria;
CREATE POLICY "Members read rubric criteria"
  ON rubric_criteria FOR SELECT USING (public.is_course_member(public.rubric_course_id(rubric_id)));

DROP POLICY IF EXISTS "Staff manage rubric criteria" ON rubric_criteria;
CREATE POLICY "Staff manage rubric criteria"
  ON rubric_criteria FOR ALL
  USING (public.is_course_staff(public.rubric_course_id(rubric_id)))
  WITH CHECK (public.is_course_staff(public.rubric_course_id(rubric_id)));

DROP POLICY IF EXISTS "Members read rubric levels" ON rubric_levels;
CREATE POLICY "Members read rubric levels"
  ON rubric_levels FOR SELECT USING (public.is_course_member(public.criterion_course_id(criterion_id)));

DROP POLICY IF EXISTS "Staff manage rubric levels" ON rubric_levels;
CREATE POLICY "Staff manage rubric levels"
  ON rubric_levels FOR ALL
  USING (public.is_course_staff(public.criterion_course_id(criterion_id)))
  WITH CHECK (public.is_course_staff(public.criterion_course_id(criterion_id)));

-- Skor rubrik dosen: pemilik jawaban membaca rincian skornya; staf mengelola.
DROP POLICY IF EXISTS "Owner reads rubric scores" ON rubric_scores;
CREATE POLICY "Owner reads rubric scores"
  ON rubric_scores FOR SELECT USING (public.is_submission_owner(submission_id));

DROP POLICY IF EXISTS "Staff manage rubric scores" ON rubric_scores;
CREATE POLICY "Staff manage rubric scores"
  ON rubric_scores FOR ALL
  USING (public.is_course_staff(public.submission_course_id(submission_id)))
  WITH CHECK (public.is_course_staff(public.submission_course_id(submission_id)));

-- Peer review: staf melihat & mengelola semuanya; reviewer melihat & mengisi barisnya sendiri.
-- Pemilik jawaban TIDAK punya SELECT langsung (agar reviewer_id tidak bocor) — pakai get_received_peer_reviews().
DROP POLICY IF EXISTS "Staff manage peer reviews" ON peer_reviews;
CREATE POLICY "Staff manage peer reviews"
  ON peer_reviews FOR ALL
  USING (public.is_course_staff(public.assignment_course_id(assignment_id)))
  WITH CHECK (public.is_course_staff(public.assignment_course_id(assignment_id)));

DROP POLICY IF EXISTS "Reviewer reads own peer reviews" ON peer_reviews;
CREATE POLICY "Reviewer reads own peer reviews"
  ON peer_reviews FOR SELECT USING (reviewer_id = public.current_profile_id());

DROP POLICY IF EXISTS "Reviewer submits own peer reviews" ON peer_reviews;
CREATE POLICY "Reviewer submits own peer reviews"
  ON peer_reviews FOR UPDATE
  USING (reviewer_id = public.current_profile_id())
  WITH CHECK (reviewer_id = public.current_profile_id());

-- ============================================
-- 3. RPC anonim
-- ============================================

/** Jawaban yang harus direview user login — tanpa identitas pemilik. */
CREATE OR REPLACE FUNCTION public.get_peer_review_tasks()
RETURNS TABLE (review_id UUID, assignment_id UUID, jawaban TEXT, file_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pr.id, pr.assignment_id, s.jawaban, s.file_name
  FROM peer_reviews pr
  JOIN submissions s ON s.id = pr.submission_id
  JOIN rubrics r ON r.assignment_id = pr.assignment_id AND r.peer_enabled
  WHERE pr.reviewer_id = public.current_profile_id();
$$;

/** Review yang dihitung atas jawaban milik user login — tanpa reviewer_id. Skor = override bila ada. */
CREATE OR REPLACE FUNCTION public.get_received_peer_reviews()
RETURNS TABLE (
  id UUID, assignment_id UUID, submission_id UUID, selections JSONB, komentar TEXT,
  skor NUMERIC, override_skor NUMERIC, excluded BOOLEAN, submitted_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pr.id, pr.assignment_id, pr.submission_id, pr.selections, pr.komentar,
         pr.skor, pr.override_skor, FALSE, pr.submitted_at
  FROM peer_reviews pr
  JOIN submissions s ON s.id = pr.submission_id
  JOIN rubrics r ON r.assignment_id = pr.assignment_id AND r.peer_enabled
  WHERE s.student_id = public.current_profile_id()
    AND NOT pr.excluded
    AND (pr.status = 'submitted' OR pr.override_skor IS NOT NULL)
  ORDER BY pr.id;
$$;

REVOKE ALL ON FUNCTION public.get_peer_review_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_received_peer_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_peer_review_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_received_peer_reviews() TO authenticated;

-- ============================================
-- 4. NOTIFIKASI
-- ============================================

-- Penugasan review → satu notifikasi per (reviewer, tugas, waktu penugasan).
CREATE OR REPLACE FUNCTION public.notify_peer_review_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_judul TEXT;
  v_deadline TIMESTAMPTZ;
BEGIN
  SELECT a.judul, r.peer_deadline INTO v_judul, v_deadline
  FROM assignments a LEFT JOIN rubrics r ON r.assignment_id = a.id
  WHERE a.id = NEW.assignment_id;

  INSERT INTO notifications (user_id, tipe, judul, pesan, link, dedupe_key)
  VALUES (
    NEW.reviewer_id, 'tugas', 'Peer review: ' || COALESCE(v_judul, 'Tugas'),
    'Anda diminta menilai jawaban teman secara anonim' ||
      COALESCE(' · tenggat ' || to_char(v_deadline AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB', ''),
    '/assignments/' || NEW.assignment_id,
    'peer-assign:' || NEW.assignment_id || ':' || to_char(NEW.created_at, 'YYYYMMDDHH24MISS')
  )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_peer_review_assigned ON peer_reviews;
CREATE TRIGGER trg_notify_peer_review_assigned
  AFTER INSERT ON peer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_peer_review_assigned();

-- Pengingat tenggat review (dipanggil cron /api/cron/deadline-reminders).
CREATE OR REPLACE FUNCTION public.notify_peer_review_deadlines(p_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO notifications (user_id, tipe, judul, pesan, link, dedupe_key)
  SELECT pr.reviewer_id, 'deadline', 'Tenggat peer review: ' || a.judul,
         count(*) || ' review belum dikirim · tenggat ' ||
           to_char(r.peer_deadline AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB',
         '/assignments/' || a.id,
         'peer-deadline:' || a.id || ':' || to_char(r.peer_deadline, 'YYYYMMDDHH24MI')
  FROM peer_reviews pr
  JOIN rubrics r ON r.assignment_id = pr.assignment_id AND r.peer_enabled
  JOIN assignments a ON a.id = pr.assignment_id
  WHERE pr.status = 'assigned'
    AND r.peer_deadline > NOW()
    AND r.peer_deadline <= NOW() + make_interval(hours => p_hours)
  GROUP BY pr.reviewer_id, a.id, a.judul, r.peer_deadline
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.notify_peer_review_deadlines(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_peer_review_deadlines(INTEGER) TO service_role;
