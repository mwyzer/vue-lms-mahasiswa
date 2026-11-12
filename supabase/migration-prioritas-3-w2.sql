-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 3 · W2 (progres, gamifikasi, sertifikat)
--   1. user_activity  — log aktivitas belajar (streak harian)
--   2. user_badges    — badge yang sudah didapat (+ trigger notifikasi)
--   3. certificates   — sertifikat penyelesaian mata kuliah (kode verifikasi)
--
-- Jalankan SETELAH migration-prioritas-1.sql (butuh public.current_profile_id,
-- public.is_course_staff dan tabel notifications). Aman dijalankan ulang.
--
-- Definisi badge ada di kode (app/data/badges.ts); badge_id di sini hanya teks.
-- Sistem demo: penilaian badge dilakukan di klien, jadi baris badge/sertifikat
-- bisa ditulis sendiri oleh mahasiswa (tidak di-hardening).
-- ============================================

-- ============================================
-- 1. USER ACTIVITY
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('lesson_completed', 'quiz_submitted', 'assignment_submitted', 'flashcard_reviewed', 'forum_post')),
  -- id materi/kuis/tugas/thread/dek (TEXT agar tidak terikat ke satu tabel)
  ref_id TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON public.user_activity (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_course ON public.user_activity (course_id);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own activity" ON public.user_activity;
CREATE POLICY "Users read own activity"
  ON public.user_activity FOR SELECT
  USING (user_id = public.current_profile_id() OR (course_id IS NOT NULL AND public.is_course_staff(course_id)));

DROP POLICY IF EXISTS "Users insert own activity" ON public.user_activity;
CREATE POLICY "Users insert own activity"
  ON public.user_activity FOR INSERT
  WITH CHECK (user_id = public.current_profile_id());

DROP POLICY IF EXISTS "Users delete own activity" ON public.user_activity;
CREATE POLICY "Users delete own activity"
  ON public.user_activity FOR DELETE
  USING (user_id = public.current_profile_id());

-- ============================================
-- 2. USER BADGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL CHECK (char_length(badge_id) BETWEEN 1 AND 64),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges (user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badge bersifat publik di dalam kampus (mis. untuk papan peringkat), tetapi hanya pemilik yang menulis.
DROP POLICY IF EXISTS "Authenticated read badges" ON public.user_badges;
CREATE POLICY "Authenticated read badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users insert own badges" ON public.user_badges;
CREATE POLICY "Users insert own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (user_id = public.current_profile_id());

-- Tidak ada UPDATE/DELETE untuk klien: badge tidak dicabut.

-- Notifikasi otomatis saat badge baru tercatat (klien produksi tidak membuat notifikasi sendiri).
CREATE OR REPLACE FUNCTION public.notify_badge_earned()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, tipe, judul, pesan, link, dedupe_key)
  VALUES (NEW.user_id, 'sistem', 'Badge baru didapat 🏅', 'Lihat badge Anda di halaman Progres.', '/student/progress',
          'badge:' || NEW.badge_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_badge_earned ON public.user_badges;
CREATE TRIGGER trg_notify_badge_earned
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.notify_badge_earned();

-- ============================================
-- 3. CERTIFICATES
-- ============================================
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL UNIQUE CHECK (verification_code ~ '^LMS-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates (user_id);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own or taught certificates" ON public.certificates;
CREATE POLICY "Read own or taught certificates"
  ON public.certificates FOR SELECT
  USING (user_id = public.current_profile_id() OR public.is_course_staff(course_id));

-- Mahasiswa hanya boleh menerbitkan sertifikat untuk mata kuliah yang ia ikuti.
DROP POLICY IF EXISTS "Students insert own certificates" ON public.certificates;
CREATE POLICY "Students insert own certificates"
  ON public.certificates FOR INSERT
  WITH CHECK (
    user_id = public.current_profile_id()
    AND EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = certificates.course_id AND e.student_id = certificates.user_id)
  );

/**
 * Verifikasi publik kode sertifikat (mis. halaman verifikasi di masa depan).
 * Hanya mengembalikan nama, mata kuliah, dan tanggal — bukan data lain.
 */
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code TEXT)
RETURNS TABLE (student_name TEXT, course_kode TEXT, course_nama TEXT, issued_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.nama::text, c.kode::text, c.nama::text, cert.issued_at
  FROM certificates cert
  JOIN profiles p ON p.id = cert.user_id
  JOIN courses c ON c.id = cert.course_id
  WHERE cert.verification_code = upper(trim(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated;
