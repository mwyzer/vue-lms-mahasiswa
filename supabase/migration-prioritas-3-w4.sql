-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 3 (W4): mahasiswa berisiko + impor/ekspor
--   1. risk_interventions  — log "Kirim pengingat" dan "Tandai sudah ditindaklanjuti"
--   2. send_risk_reminder  — RPC: buat notifikasi ke mahasiswa + catat intervensi
--   3. import_jobs         — riwayat impor CSV mahasiswa (ditulis endpoint server)
--
-- Jalankan SETELAH migration-prioritas-1.sql (butuh public.current_profile_id,
-- public.current_user_role, public.is_course_staff dan tabel notifications).
-- Aman dijalankan ulang (idempotent).
-- ============================================

-- ────────────────────────────────────────────
-- 1. RISK INTERVENTIONS
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risk_interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('reminder', 'followup')),
  catatan TEXT CHECK (catatan IS NULL OR char_length(catatan) <= 2000),
  risk_score INTEGER CHECK (risk_score IS NULL OR risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(10) CHECK (risk_level IS NULL OR risk_level IN ('rendah', 'sedang', 'tinggi')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_interventions_course_student
  ON public.risk_interventions(course_id, student_id, created_at DESC);

ALTER TABLE public.risk_interventions ENABLE ROW LEVEL SECURITY;

-- Dosen pengampu (dan admin) membaca & menambah intervensi di mata kuliahnya.
DROP POLICY IF EXISTS "Staff read risk interventions" ON public.risk_interventions;
CREATE POLICY "Staff read risk interventions"
  ON public.risk_interventions FOR SELECT
  USING (public.is_course_staff(course_id));

DROP POLICY IF EXISTS "Staff insert risk interventions" ON public.risk_interventions;
CREATE POLICY "Staff insert risk interventions"
  ON public.risk_interventions FOR INSERT
  WITH CHECK (public.is_course_staff(course_id) AND actor_id = public.current_profile_id());

-- Hanya admin yang boleh menghapus (koreksi data). Tidak ada UPDATE: log bersifat append-only.
DROP POLICY IF EXISTS "Admin delete risk interventions" ON public.risk_interventions;
CREATE POLICY "Admin delete risk interventions"
  ON public.risk_interventions FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ────────────────────────────────────────────
-- 2. RPC send_risk_reminder
-- ────────────────────────────────────────────
-- Klien tidak boleh INSERT langsung ke notifications (RLS Prioritas 1), jadi
-- pengingat lewat fungsi SECURITY DEFINER yang memeriksa sendiri bahwa pemanggil
-- adalah dosen pengampu/admin dan mahasiswanya terdaftar di mata kuliah itu.
CREATE OR REPLACE FUNCTION public.send_risk_reminder(
  p_course_id UUID,
  p_student_id UUID,
  p_judul TEXT,
  p_pesan TEXT,
  p_risk_score INTEGER DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL
)
RETURNS public.risk_interventions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor UUID := public.current_profile_id();
  v_row public.risk_interventions;
BEGIN
  IF v_actor IS NULL OR NOT public.is_course_staff(p_course_id) THEN
    RAISE EXCEPTION 'Hanya dosen pengampu atau admin yang dapat mengirim pengingat.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM enrollments e WHERE e.course_id = p_course_id AND e.student_id = p_student_id
  ) AND NOT EXISTS (
    -- Enrolment level + sesi (dipakai gradebook dan dashboard risiko)
    SELECT 1 FROM profiles p JOIN courses c ON c.id = p_course_id
    WHERE p.id = p_student_id AND p.role = 'student'
      AND p.level = c.level AND p.session_time = c.session_time
  ) THEN
    RAISE EXCEPTION 'Mahasiswa tidak terdaftar di mata kuliah ini.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(btrim(p_pesan), '') = '' THEN
    RAISE EXCEPTION 'Pesan pengingat kosong.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO notifications (user_id, tipe, judul, pesan, link)
  VALUES (p_student_id, 'sistem', left(coalesce(p_judul, 'Pengingat dari dosen'), 255), left(p_pesan, 1000),
          '/courses/' || p_course_id);

  INSERT INTO public.risk_interventions (course_id, student_id, actor_id, actor_name, tipe, catatan, risk_score, risk_level)
  SELECT p_course_id, p_student_id, v_actor, pr.nama, 'reminder', left(p_pesan, 1000),
         CASE WHEN p_risk_score BETWEEN 0 AND 100 THEN p_risk_score END,
         CASE WHEN p_risk_level IN ('rendah', 'sedang', 'tinggi') THEN p_risk_level END
  FROM profiles pr WHERE pr.id = v_actor
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.send_risk_reminder(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_risk_reminder(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;

-- ────────────────────────────────────────────
-- 3. IMPORT JOBS
-- ────────────────────────────────────────────
-- Ditulis oleh POST /api/import/students (service role). Klien hanya membaca.
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role VARCHAR(20),
  kind VARCHAR(20) NOT NULL DEFAULT 'students' CHECK (kind IN ('students')),
  file_name TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_actor ON public.import_jobs(actor_id, created_at DESC);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own import jobs" ON public.import_jobs;
CREATE POLICY "Read own import jobs"
  ON public.import_jobs FOR SELECT
  USING (actor_id = public.current_profile_id() OR public.current_user_role() = 'admin');
-- Tidak ada policy INSERT/UPDATE/DELETE: hanya service role (bypass RLS) yang menulis.
