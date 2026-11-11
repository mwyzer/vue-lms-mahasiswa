-- ============================================
-- LMS Mahasiswa — Migrasi Prioritas 1
--   1. Supabase Storage untuk lampiran tugas
--   2. Notification center + pengingat deadline
--   3. Forum diskusi per mata kuliah
--   4. Gradebook berbobot (bobot komponen + nilai UTS/UAS)
--
-- Jalankan SETELAH schema.sql dan policies.sql.
-- Aman dijalankan ulang (idempotent).
-- ============================================

-- ────────────────────────────────────────────
-- 0. Helper functions (SECURITY DEFINER → tidak kena rekursi RLS)
-- ────────────────────────────────────────────

/**
 * Profil milik user yang sedang login lewat Supabase Auth.
 * Mendukung dua skema yang ada di repo ini:
 *   a) profiles.id = auth.uid()                      (schema.sql + policies.sql)
 *   b) profil di-seed dengan UUID sendiri, login pakai email
 *      instruktur/admin = profiles.email, mahasiswa = '<npm>@lms.ac.id'
 *      (lihat app/stores/auth.ts → signInWithPassword)
 */
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id
  FROM profiles p
  WHERE auth.uid() IS NOT NULL
    AND (
      p.id = auth.uid()
      OR (p.email IS NOT NULL AND lower(p.email) = lower(auth.jwt() ->> 'email'))
      OR (p.npm IS NOT NULL AND lower(p.npm || '@lms.ac.id') = lower(auth.jwt() ->> 'email'))
    )
  ORDER BY (p.id = auth.uid()) DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id = public.current_profile_id();
$$;

/** TRUE jika user login adalah anggota mata kuliah: mahasiswa terdaftar, instruktur pengampu, atau admin. */
CREATE OR REPLACE FUNCTION public.is_course_member(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = p_course_id AND e.student_id = public.current_profile_id())
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = p_course_id AND c.instructor_id = public.current_profile_id())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = public.current_profile_id() AND p.role = 'admin');
$$;

/** TRUE jika user login adalah instruktur pengampu mata kuliah, atau admin. */
CREATE OR REPLACE FUNCTION public.is_course_staff(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM courses c WHERE c.id = p_course_id AND c.instructor_id = public.current_profile_id())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = public.current_profile_id() AND p.role = 'admin');
$$;

-- ============================================
-- 1. STORAGE — bucket privat "attachments"
-- ============================================
-- Konvensi path:
--   assignments/{course_id}/{uploader_id}/{timestamp}-{nama-file}
--   submissions/{assignment_id}/{uploader_id}/{timestamp}-{nama-file}
-- Kolom file_url di tabel assignments/submissions menyimpan
--   storage://attachments/<path>
-- dan klien membuat signed URL saat mengunduh.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', FALSE, 20971520) -- 20 MB
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "attachments upload own folder" ON storage.objects;
CREATE POLICY "attachments upload own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[3] = public.current_profile_id()::text
    AND (
      -- lampiran soal: hanya instruktur/admin
      ((storage.foldername(name))[1] = 'assignments' AND public.current_user_role() IN ('instructor', 'admin'))
      -- file jawaban: mahasiswa
      OR ((storage.foldername(name))[1] = 'submissions' AND public.current_user_role() = 'student')
    )
  );

DROP POLICY IF EXISTS "attachments read" ON storage.objects;
CREATE POLICY "attachments read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      -- lampiran soal: semua user login boleh mengunduh
      (storage.foldername(name))[1] = 'assignments'
      -- file jawaban: pemilik, instruktur, atau admin
      OR (storage.foldername(name))[3] = public.current_profile_id()::text
      OR public.current_user_role() IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS "attachments delete own" ON storage.objects;
CREATE POLICY "attachments delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND ((storage.foldername(name))[3] = public.current_profile_id()::text OR public.current_user_role() = 'admin')
  );

-- ============================================
-- 2. NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('tugas', 'nilai', 'pengumuman', 'forum', 'deadline', 'sistem')),
  judul VARCHAR(255) NOT NULL,
  pesan TEXT,
  link TEXT,                       -- rute in-app, mis. /assignments/<id>
  dedupe_key TEXT,                 -- mencegah notifikasi ganda (mis. pengingat deadline)
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Baca/ubah/hapus milik sendiri. INSERT hanya lewat trigger (SECURITY DEFINER) atau service role.
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT USING (user_id = public.current_profile_id());

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE USING (user_id = public.current_profile_id()) WITH CHECK (user_id = public.current_profile_id());

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE USING (user_id = public.current_profile_id());

-- Realtime: klien subscribe ke INSERT pada baris miliknya.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ── Trigger: tugas baru → semua mahasiswa terdaftar ──
CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, tipe, judul, pesan, link)
  SELECT e.student_id, 'tugas', 'Tugas baru: ' || NEW.judul,
         'Mata kuliah ' || c.nama ||
           COALESCE(' · tenggat ' || to_char(NEW.tenggat_waktu AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB', ''),
         '/assignments/' || NEW.id
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.course_id = NEW.course_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_assignment ON assignments;
CREATE TRIGGER trg_notify_new_assignment
  AFTER INSERT ON assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_assignment();

-- ── Trigger: nilai keluar/berubah → mahasiswa ybs ──
CREATE OR REPLACE FUNCTION public.notify_graded_submission()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_judul TEXT;
BEGIN
  IF NEW.nilai IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.nilai IS NOT DISTINCT FROM NEW.nilai THEN RETURN NEW; END IF;

  SELECT judul INTO v_judul FROM assignments WHERE id = NEW.assignment_id;

  INSERT INTO notifications (user_id, tipe, judul, pesan, link)
  VALUES (NEW.student_id, 'nilai', 'Nilai keluar: ' || COALESCE(v_judul, 'Tugas'),
          'Nilai Anda: ' || NEW.nilai, '/assignments/' || NEW.assignment_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_graded_submission ON submissions;
CREATE TRIGGER trg_notify_graded_submission
  AFTER INSERT OR UPDATE OF nilai ON submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_graded_submission();

-- ── Trigger: pengumuman baru → semua mahasiswa terdaftar ──
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, tipe, judul, pesan, link)
  SELECT e.student_id, 'pengumuman', 'Pengumuman: ' || NEW.judul, left(NEW.konten, 160), '/courses/' || NEW.course_id
  FROM enrollments e
  WHERE e.course_id = NEW.course_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_announcement ON announcements;
CREATE TRIGGER trg_notify_new_announcement
  AFTER INSERT ON announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_announcement();

-- ── Pengingat deadline (dipanggil cron: /api/cron/deadline-reminders atau pg_cron) ──
-- Membuat satu notifikasi per (tugas, mahasiswa) untuk tugas yang tenggatnya
-- dalam p_hours jam ke depan dan belum dikumpulkan. dedupe_key mencegah duplikat.
CREATE OR REPLACE FUNCTION public.notify_upcoming_deadlines(p_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO notifications (user_id, tipe, judul, pesan, link, dedupe_key)
  SELECT e.student_id, 'deadline', 'Tenggat mendekat: ' || a.judul,
         'Belum dikumpulkan · tenggat ' ||
           to_char(a.tenggat_waktu AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB',
         '/assignments/' || a.id,
         'deadline:' || a.id
  FROM assignments a
  JOIN enrollments e ON e.course_id = a.course_id
  WHERE a.tenggat_waktu > NOW()
    AND a.tenggat_waktu <= NOW() + make_interval(hours => p_hours)
    AND NOT EXISTS (
      SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = e.student_id
    )
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Hanya service role yang boleh memanggil (bukan klien biasa).
REVOKE ALL ON FUNCTION public.notify_upcoming_deadlines(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_upcoming_deadlines(INTEGER) TO service_role;

-- Alternatif tanpa Vercel Cron (aktifkan extension pg_cron dulu di dashboard Supabase):
--   SELECT cron.schedule('lms-deadline-reminders', '0 * * * *', $$SELECT public.notify_upcoming_deadlines(24)$$);

-- ============================================
-- 3. FORUM DISKUSI
-- ============================================

CREATE TABLE IF NOT EXISTS forum_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,  -- opsional: diskusi untuk materi tertentu
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  judul VARCHAR(255) NOT NULL,
  konten TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  konten TEXT NOT NULL,
  is_answer BOOLEAN NOT NULL DEFAULT FALSE,   -- ditandai instruktur sebagai jawaban
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_course ON forum_threads(course_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON forum_replies(thread_id, created_at);

ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

-- Threads
DROP POLICY IF EXISTS "Members read threads" ON forum_threads;
CREATE POLICY "Members read threads"
  ON forum_threads FOR SELECT USING (public.is_course_member(course_id));

DROP POLICY IF EXISTS "Members create threads" ON forum_threads;
CREATE POLICY "Members create threads"
  ON forum_threads FOR INSERT
  WITH CHECK (author_id = public.current_profile_id() AND public.is_course_member(course_id));

-- Catatan: pin/kunci thread hanya ditampilkan untuk instruktur di UI. Penulis thread
-- secara teknis juga lolos policy UPDATE ini; batasi lewat trigger jika perlu lebih ketat.
DROP POLICY IF EXISTS "Author or staff update threads" ON forum_threads;
CREATE POLICY "Author or staff update threads"
  ON forum_threads FOR UPDATE
  USING (author_id = public.current_profile_id() OR public.is_course_staff(course_id));

DROP POLICY IF EXISTS "Author or staff delete threads" ON forum_threads;
CREATE POLICY "Author or staff delete threads"
  ON forum_threads FOR DELETE
  USING (author_id = public.current_profile_id() OR public.is_course_staff(course_id));

-- Replies
DROP POLICY IF EXISTS "Members read replies" ON forum_replies;
CREATE POLICY "Members read replies"
  ON forum_replies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM forum_threads t WHERE t.id = thread_id AND public.is_course_member(t.course_id)
  ));

DROP POLICY IF EXISTS "Members create replies" ON forum_replies;
CREATE POLICY "Members create replies"
  ON forum_replies FOR INSERT
  WITH CHECK (
    author_id = public.current_profile_id()
    AND is_answer = FALSE
    AND EXISTS (
      SELECT 1 FROM forum_threads t
      WHERE t.id = thread_id
        AND public.is_course_member(t.course_id)
        AND (t.is_locked = FALSE OR public.is_course_staff(t.course_id))
    )
  );

-- Hanya staf yang boleh UPDATE balasan (untuk menandai jawaban).
DROP POLICY IF EXISTS "Staff update replies" ON forum_replies;
CREATE POLICY "Staff update replies"
  ON forum_replies FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM forum_threads t WHERE t.id = thread_id AND public.is_course_staff(t.course_id)
  ));

DROP POLICY IF EXISTS "Author or staff delete replies" ON forum_replies;
CREATE POLICY "Author or staff delete replies"
  ON forum_replies FOR DELETE
  USING (
    author_id = public.current_profile_id()
    OR EXISTS (SELECT 1 FROM forum_threads t WHERE t.id = thread_id AND public.is_course_staff(t.course_id))
  );

-- ── Trigger: balasan baru → sentuh updated_at thread + notifikasi ke penulis thread ──
CREATE OR REPLACE FUNCTION public.on_forum_reply()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_thread forum_threads%ROWTYPE;
  v_nama TEXT;
  v_role TEXT;
BEGIN
  UPDATE forum_threads SET updated_at = NOW() WHERE id = NEW.thread_id RETURNING * INTO v_thread;

  IF v_thread.author_id <> NEW.author_id THEN
    SELECT nama INTO v_nama FROM profiles WHERE id = NEW.author_id;
    SELECT role INTO v_role FROM profiles WHERE id = v_thread.author_id;

    INSERT INTO notifications (user_id, tipe, judul, pesan, link)
    VALUES (
      v_thread.author_id, 'forum',
      COALESCE(v_nama, 'Seseorang') || ' membalas diskusi Anda',
      v_thread.judul,
      CASE WHEN v_role = 'student'
        THEN '/courses/' || v_thread.course_id || '/forum/' || v_thread.id
        ELSE '/instructor/courses/' || v_thread.course_id || '/forum/' || v_thread.id
      END
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_on_forum_reply ON forum_replies;
CREATE TRIGGER trg_on_forum_reply
  AFTER INSERT ON forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.on_forum_reply();

-- ============================================
-- 4. GRADEBOOK BERBOBOT
-- ============================================

-- Bobot komponen nilai per mata kuliah (total harus 100).
CREATE TABLE IF NOT EXISTS grade_weights (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  bobot_tugas INTEGER NOT NULL DEFAULT 25 CHECK (bobot_tugas BETWEEN 0 AND 100),
  bobot_kuis INTEGER NOT NULL DEFAULT 15 CHECK (bobot_kuis BETWEEN 0 AND 100),
  bobot_presensi INTEGER NOT NULL DEFAULT 10 CHECK (bobot_presensi BETWEEN 0 AND 100),
  bobot_uts INTEGER NOT NULL DEFAULT 20 CHECK (bobot_uts BETWEEN 0 AND 100),
  bobot_uas INTEGER NOT NULL DEFAULT 30 CHECK (bobot_uas BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grade_weights_total_100
    CHECK (bobot_tugas + bobot_kuis + bobot_presensi + bobot_uts + bobot_uas = 100)
);

-- Nilai UTS/UAS (diinput manual oleh instruktur).
CREATE TABLE IF NOT EXISTS exam_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipe VARCHAR(3) NOT NULL CHECK (tipe IN ('uts', 'uas')),
  nilai INTEGER NOT NULL CHECK (nilai BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, student_id, tipe)
);

CREATE INDEX IF NOT EXISTS idx_exam_scores_course ON exam_scores(course_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_student ON exam_scores(student_id);

ALTER TABLE grade_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read grade weights" ON grade_weights;
CREATE POLICY "Members read grade weights"
  ON grade_weights FOR SELECT USING (public.is_course_member(course_id));

DROP POLICY IF EXISTS "Staff manage grade weights" ON grade_weights;
CREATE POLICY "Staff manage grade weights"
  ON grade_weights FOR ALL
  USING (public.is_course_staff(course_id))
  WITH CHECK (public.is_course_staff(course_id));

DROP POLICY IF EXISTS "Students read own exam scores" ON exam_scores;
CREATE POLICY "Students read own exam scores"
  ON exam_scores FOR SELECT USING (student_id = public.current_profile_id());

DROP POLICY IF EXISTS "Staff manage exam scores" ON exam_scores;
CREATE POLICY "Staff manage exam scores"
  ON exam_scores FOR ALL
  USING (public.is_course_staff(course_id))
  WITH CHECK (public.is_course_staff(course_id));
